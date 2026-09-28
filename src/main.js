import "./style.css";
import { Document, demo, canvas } from "./model.js";
import { floodFill, hexRGBA, linePoints } from "./pixels.js";
import { download, png, gif, sheet, saveLocal, loadLocal } from "./export.js";
const $ = (id) => document.getElementById(id);
let doc = demo(),
  tool = "pencil",
  color = "#f3b86c",
  size = 2,
  playing = false,
  playFrame = 0,
  playTime = 0,
  selection = null,
  clipboard = null,
  stroke = null,
  workshop = null,
  autosaveTimer,
  dirtyVersion = 0,
  threeMode = false,
  busy = false;
const tools = [
  ["pencil", "✎", "Pencil", "B"],
  ["erase", "▱", "Eraser", "E"],
  ["fill", "◒", "Flood fill", "F"],
  ["picker", "⌾", "Color picker", "I"],
  ["line", "╱", "Line", "L"],
  ["rect", "□", "Rectangle", "R"],
  ["ellipse", "○", "Ellipse", "O"],
  ["triangle", "△", "Triangle", "T"],
  ["select", "▧", "Select", "S"],
  ["move", "✥", "Move selection", "V"],
];
const palettes = {
  Wildwater: [
    "#142b30",
    "#203b40",
    "#305357",
    "#497274",
    "#72968b",
    "#a8c1a3",
    "#d5ddbe",
    "#f4ebcc",
    "#253c4a",
    "#515b65",
    "#8c7874",
    "#c59475",
    "#f3b86c",
    "#ead09d",
    "#ce7664",
    "#ac5c60",
  ],
  Gameboy: [
    "#0f380f",
    "#306230",
    "#8bac0f",
    "#9bbc0f",
    "#071c11",
    "#164733",
    "#4a8762",
    "#b3d58c",
  ],
  Sunset: [
    "#261f39",
    "#433051",
    "#6e3c61",
    "#a64c67",
    "#d6706c",
    "#ed9b78",
    "#facb92",
    "#fff0c7",
    "#27334e",
    "#475d7b",
    "#7295a0",
    "#adcbc0",
    "#623c45",
    "#92604e",
    "#bd8d67",
    "#ead9a7",
  ],
  Studio: [
    "#141414",
    "#424242",
    "#757575",
    "#a8a8a8",
    "#d0d0d0",
    "#ffffff",
    "#ec4141",
    "#fa9161",
    "#f5cf56",
    "#a5d75c",
    "#56b988",
    "#52c7cb",
    "#5b93d9",
    "#8069c5",
    "#be77c5",
    "#f29abd",
  ],
};
function status(s) {
  $("status").textContent = s;
}
function safe(fn) {
  return async (...args) => {
    if (busy) return;
    try {
      await fn(...args);
    } catch (e) {
      status(e.message);
    }
  };
}
function modal(title, html) {
  playing = false;
  $("dialog-title").textContent = title;
  $("dialog-content").innerHTML = html;
  $("dialog").showModal();
}
$("dialog-close").onclick = () => $("dialog").close();
$("dialog").addEventListener("click", (e) => {
  if (e.target === $("dialog")) $("dialog").close();
});
function setTool(t) {
  tool = t;
  $("tool-name").textContent = tools.find((x) => x[0] === tool)[2];
  document.querySelectorAll("[data-tool]").forEach((b) => {
    b.classList.toggle("active", b.dataset.tool === tool);
    b.setAttribute("aria-pressed", b.dataset.tool === tool);
  });
  status(`${tools.find((x) => x[0] === tool)[2]} selected.`);
}
$("tools").innerHTML = tools
  .map(
    ([id, icon, name, key]) =>
      `<button data-tool="${id}" title="${name} (${key})" aria-label="${name}">${icon}</button>`,
  )
  .join("");
document
  .querySelectorAll("[data-tool]")
  .forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
function setColor(c) {
  color = c;
  $("color").value = c;
  $("hex").textContent = c.toUpperCase();
  document
    .querySelectorAll(".swatch")
    .forEach((b) => b.classList.toggle("active", b.dataset.color === c));
}
function palette() {
  const colors = palettes[$("palette-select").value];
  $("palette").innerHTML = colors
    .map(
      (c) =>
        `<button class="swatch" data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`,
    )
    .join("");
  document
    .querySelectorAll(".swatch")
    .forEach((b) => (b.onclick = () => setColor(b.dataset.color)));
  setColor(color);
}
$("palette-select").onchange = palette;
$("color").oninput = (e) => setColor(e.target.value);
$("swap").onclick = () => {
  const c = color;
  setColor($("background-color").value);
  $("background-color").value = c;
};
$("size").oninput = (e) => {
  size = +e.target.value;
  $("size-value").textContent = size + " px";
};
function dimensions() {
  for (const id of ["art", "overlay", "preview"]) {
    const c = $(id);
    if (c.width !== doc.width || c.height !== doc.height) {
      c.width = doc.width;
      c.height = doc.height;
    }
  }
  $("doc-name").value = doc.name;
  $("fps").value = doc.fps;
  $("doc-info").textContent = `${doc.width} × ${doc.height} · RGBA`;
  $("coords").textContent = `${doc.width} × ${doc.height} px`;
  fit();
}
function fit() {
  const rect = $("canvas-space").getBoundingClientRect();
  let scale =
    $("zoom").value === "fit"
      ? Math.max(
          0.25,
          Math.min(
            (rect.width - 60) / doc.width,
            (rect.height - 75) / doc.height,
          ),
        )
      : +$("zoom").value;
  $("canvas-wrap").style.width = doc.width * scale + "px";
  $("canvas-wrap").style.height = doc.height * scale + "px";
}
new ResizeObserver(fit).observe($("canvas-space"));
$("zoom").onchange = fit;
function draw() {
  const ctx = $("art").getContext("2d");
  ctx.clearRect(0, 0, doc.width, doc.height);
  if ($("onion").checked && doc.frames.length > 1 && !playing) {
    ctx.globalAlpha = 0.22;
    ctx.drawImage(
      doc.composite((doc.frame + doc.frames.length - 1) % doc.frames.length),
      0,
      0,
    );
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(doc.composite(), 0, 0);
  overlay();
  preview(playing ? playFrame : doc.frame);
}
function preview(f) {
  const ctx = $("preview").getContext("2d");
  ctx.clearRect(0, 0, doc.width, doc.height);
  ctx.drawImage(doc.composite(f), 0, 0);
  $("frame-number").textContent =
    `${String(f + 1).padStart(2, "0")} / ${String(doc.frames.length).padStart(2, "0")}`;
}
function overlay() {
  const ctx = $("overlay").getContext("2d");
  ctx.clearRect(0, 0, doc.width, doc.height);
  if ($("grid").checked) {
    ctx.strokeStyle = "#ffffff18";
    ctx.lineWidth = 0.15;
    ctx.beginPath();
    for (let i = 0; i <= doc.width; i++) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, doc.height);
    }
    for (let i = 0; i <= doc.height; i++) {
      ctx.moveTo(0, i);
      ctx.lineTo(doc.width, i);
    }
    ctx.stroke();
  }
  if (selection) {
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.65;
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(
      selection.x + 0.25,
      selection.y + 0.25,
      selection.w,
      selection.h,
    );
    ctx.restore();
  }
}
function renderLayers() {
  const root = $("layers");
  root.replaceChildren();
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const l = doc.layers[i],
      row = document.createElement("div");
    row.className = "layer" + (i === doc.layer ? " active" : "");
    row.dataset.layer = i;
    const eye = document.createElement("button");
    eye.textContent = l.visible ? "◉" : "○";
    eye.title = l.visible ? "Hide layer" : "Show layer";
    eye.onclick = (e) => {
      e.stopPropagation();
      doc.checkpoint();
      l.visible = !l.visible;
      changed();
    };
    const thumb = canvas(30, 30);
    thumb.getContext("2d").drawImage(doc.frames[doc.frame][i], 0, 0, 30, 30);
    const name = document.createElement("span");
    name.className = "layer-name";
    name.textContent = l.name;
    name.ondblclick = (e) => {
      e.stopPropagation();
      renameLayer(i);
    };
    const lock = document.createElement("button");
    lock.textContent = l.locked ? "▣" : "◇";
    lock.title = l.locked ? "Unlock layer" : "Lock layer";
    lock.onclick = (e) => {
      e.stopPropagation();
      doc.checkpoint();
      l.locked = !l.locked;
      changed();
    };
    row.append(eye, thumb, name, lock);
    row.onclick = () => {
      selection = null;
      doc.layer = i;
      renderLayers();
      draw();
    };
    root.append(row);
  }
  $("opacity").value = doc.layers[doc.layer].opacity;
  $("blend").value = doc.layers[doc.layer].blend;
}
function renameLayer(i) {
  modal(
    "Name this layer",
    '<label>Layer name <input id="layer-name-input" type="text" maxlength="80"></label><button id="rename-confirm" class="accent">Rename</button>',
  );
  $("layer-name-input").value = doc.layers[i].name;
  $("rename-confirm").onclick = () => {
    doc.checkpoint();
    doc.layers[i].name = $("layer-name-input").value.trim() || "Layer";
    $("dialog").close();
    changed();
  };
}
function renderFrames() {
  const root = $("frames");
  root.replaceChildren();
  doc.frames.forEach((_, i) => {
    const b = document.createElement("button");
    b.className = "frame" + (i === doc.frame ? " active" : "");
    b.title = `Frame ${i + 1}`;
    b.dataset.frame = i;
    const thumb = canvas(80, 60),
      ctx = thumb.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(doc.composite(i), 0, 0, 80, 60);
    const label = document.createElement("span");
    label.textContent = String(i + 1).padStart(2, "0");
    b.append(thumb, label);
    b.onclick = () => {
      playing = false;
      doc.frame = i;
      selection = null;
      draw();
      renderLayers();
      renderFrames();
    };
    root.append(b);
  });
}
function changed() {
  dirtyVersion++;
  draw();
  renderLayers();
  renderFrames();
  $("undo").disabled = !doc.undoStack.length;
  $("redo").disabled = !doc.redoStack.length;
  $("save-status").textContent = "Saving…";
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    try {
      await saveLocal(doc.serialize());
      $("save-status").textContent = "Saved on this device";
    } catch {
      $("save-status").textContent = "Use Save project to keep a copy";
    }
  }, 900);
}
function editable() {
  if (playing) {
    status("Pause the animation before drawing.");
    return false;
  }
  if (doc.layers[doc.layer].locked) {
    status("This layer is locked. Unlock it in Layers.");
    return false;
  }
  if (!doc.layers[doc.layer].visible) {
    status("This layer is hidden. Show it in Layers.");
    return false;
  }
  return true;
}
function point(e) {
  const r = $("overlay").getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(
        doc.width - 1,
        Math.floor(((e.clientX - r.left) / r.width) * doc.width),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        doc.height - 1,
        Math.floor(((e.clientY - r.top) / r.height) * doc.height),
      ),
    ),
  };
}
function clip(ctx) {
  if (selection && tool !== "select" && tool !== "move") {
    ctx.beginPath();
    ctx.rect(selection.x, selection.y, selection.w, selection.h);
    ctx.clip();
  }
}
function stamp(ctx, x, y) {
  ctx.fillRect(x - Math.floor(size / 2), y - Math.floor(size / 2), size, size);
  if ($("mirror").checked)
    ctx.fillRect(
      doc.width - 1 - x - Math.floor(size / 2),
      y - Math.floor(size / 2),
      size,
      size,
    );
}
function pencil(a, b) {
  const ctx = doc.current.getContext("2d");
  ctx.save();
  clip(ctx);
  ctx.globalCompositeOperation =
    tool === "erase" ? "destination-out" : "source-over";
  ctx.fillStyle = color;
  for (const [x, y] of linePoints(a.x, a.y, b.x, b.y)) stamp(ctx, x, y);
  ctx.restore();
}
function shape(a, b) {
  const ctx = doc.current.getContext("2d");
  ctx.save();
  clip(ctx);
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = size;
  const x = Math.min(a.x, b.x),
    y = Math.min(a.y, b.y),
    w = Math.max(1, Math.abs(a.x - b.x)),
    h = Math.max(1, Math.abs(a.y - b.y));
  ctx.beginPath();
  if (tool === "line") {
    for (const [x, y] of linePoints(a.x, a.y, b.x, b.y)) stamp(ctx, x, y);
  } else if (tool === "rect") {
    $("filled").checked
      ? ctx.fillRect(x, y, w, h)
      : ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  } else {
    if (tool === "ellipse")
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else {
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    }
    $("filled").checked ? ctx.fill() : ctx.stroke();
  }
  ctx.restore();
}
$("overlay").onpointerdown = (e) => {
  if (busy || threeMode || e.button !== 0) return;
  e.preventDefault();
  const p = point(e);
  if (tool === "picker") {
    const d = doc
      .composite()
      .getContext("2d")
      .getImageData(p.x, p.y, 1, 1).data;
    setColor(
      "#" +
        Array.from(d.slice(0, 3))
          .map((v) => v.toString(16).padStart(2, "0"))
          .join(""),
    );
    return;
  }
  if (!editable()) return;
  $("overlay").setPointerCapture(e.pointerId);
  if (tool === "select") {
    selection = { x: p.x, y: p.y, w: 1, h: 1 };
    stroke = { start: p, last: p };
    overlay();
    return;
  }
  if (tool === "move") {
    if (!selection) {
      status("Use Select to mark an area first.");
      return;
    }
    doc.checkpoint();
    const ctx = doc.current.getContext("2d"),
      im = ctx.getImageData(selection.x, selection.y, selection.w, selection.h);
    ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
    stroke = {
      start: p,
      last: p,
      base: ctx.getImageData(0, 0, doc.width, doc.height),
      im,
      selection: { ...selection },
    };
    return;
  }
  doc.checkpoint();
  stroke = {
    start: p,
    last: p,
    base: doc.current
      .getContext("2d")
      .getImageData(0, 0, doc.width, doc.height),
  };
  if (tool === "fill") {
    const ctx = doc.current.getContext("2d");
    if (selection) {
      const im = ctx.getImageData(
        selection.x,
        selection.y,
        selection.w,
        selection.h,
      );
      floodFill(
        im.data,
        selection.w,
        selection.h,
        p.x - selection.x,
        p.y - selection.y,
        hexRGBA(color),
      );
      ctx.putImageData(im, selection.x, selection.y);
    } else {
      const im = ctx.getImageData(0, 0, doc.width, doc.height);
      floodFill(im.data, doc.width, doc.height, p.x, p.y, hexRGBA(color));
      ctx.putImageData(im, 0, 0);
    }
    stroke = null;
    changed();
    return;
  }
  if (tool === "pencil" || tool === "erase") pencil(p, p);
  else shape(p, p);
  draw();
};
$("overlay").onpointermove = (e) => {
  const p = point(e);
  $("coords").textContent = `${p.x}, ${p.y} · ${doc.width} × ${doc.height}`;
  if (!stroke) return;
  if (tool === "select") {
    selection = {
      x: Math.min(p.x, stroke.start.x),
      y: Math.min(p.y, stroke.start.y),
      w: Math.abs(p.x - stroke.start.x) + 1,
      h: Math.abs(p.y - stroke.start.y) + 1,
    };
    overlay();
  } else if (tool === "move") {
    const ctx = doc.current.getContext("2d");
    ctx.putImageData(stroke.base, 0, 0);
    const x = Math.max(
        0,
        Math.min(
          doc.width - stroke.selection.w,
          stroke.selection.x + p.x - stroke.start.x,
        ),
      ),
      y = Math.max(
        0,
        Math.min(
          doc.height - stroke.selection.h,
          stroke.selection.y + p.y - stroke.start.y,
        ),
      );
    const patch = canvas(stroke.im.width, stroke.im.height);
    patch.getContext("2d").putImageData(stroke.im, 0, 0);
    ctx.drawImage(patch, x, y);
    selection = { ...stroke.selection, x, y };
    draw();
  } else if (tool === "pencil" || tool === "erase") {
    pencil(stroke.last, p);
    draw();
  } else {
    doc.current.getContext("2d").putImageData(stroke.base, 0, 0);
    shape(stroke.start, p);
    draw();
  }
  stroke.last = p;
};
function endStroke() {
  if (!stroke) return;
  if (
    tool === "move" &&
    stroke.start.x === stroke.last.x &&
    stroke.start.y === stroke.last.y
  )
    doc.current
      .getContext("2d")
      .putImageData(stroke.im, stroke.selection.x, stroke.selection.y);
  stroke = null;
  if (tool === "select") {
    status("Selection ready. Choose Move, Copy, or Cut.");
    overlay();
  } else changed();
}
$("overlay").onpointerup = endStroke;
$("overlay").onpointercancel = endStroke;
$("overlay").onlostpointercapture = endStroke;
function copy(cut = false) {
  if (!selection) {
    status("Select an area first.");
    return;
  }
  if (cut && !editable()) return;
  const ctx = doc.current.getContext("2d");
  clipboard = ctx.getImageData(
    selection.x,
    selection.y,
    selection.w,
    selection.h,
  );
  if (cut) {
    doc.checkpoint();
    ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
    changed();
  }
  status(cut ? "Cut selection." : "Copied selection.");
}
function paste() {
  if (!clipboard) {
    status("Copy a selection first.");
    return;
  }
  if (!editable()) return;
  doc.checkpoint();
  const patch = canvas(clipboard.width, clipboard.height);
  patch.getContext("2d").putImageData(clipboard, 0, 0);
  const x = selection?.x || 0,
    y = selection?.y || 0;
  doc.current.getContext("2d").drawImage(patch, x, y);
  selection = {
    x,
    y,
    w: Math.min(clipboard.width, doc.width - x),
    h: Math.min(clipboard.height, doc.height - y),
  };
  setTool("move");
  changed();
}
$("copy").onclick = () => copy();
$("cut").onclick = () => copy(true);
$("paste").onclick = paste;
$("clear-selection").onclick = () => {
  selection = null;
  overlay();
};
function undo() {
  if (doc.undo()) {
    selection = null;
    dimensions();
    changed();
  }
}
function redo() {
  if (doc.redo()) {
    selection = null;
    dimensions();
    changed();
  }
}
$("undo").onclick = undo;
$("redo").onclick = redo;
for (const [id, fn] of [
  ["add-layer", () => doc.addLayer()],
  ["delete-layer", () => doc.deleteLayer()],
  ["layer-up", () => doc.reorder(1)],
  ["layer-down", () => doc.reorder(-1)],
  ["merge", () => doc.merge()],
  ["add-frame", () => doc.addFrame()],
  ["duplicate-frame", () => doc.addFrame(true)],
  ["delete-frame", () => doc.deleteFrame()],
])
  $(id).onclick = safe(() => {
    playing = false;
    selection = null;
    fn();
    changed();
  });
$("opacity").onpointerdown = () => doc.checkpoint();
$("opacity").onkeydown = (e) => {
  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
    doc.checkpoint();
};
$("opacity").oninput = (e) => {
  doc.layers[doc.layer].opacity = +e.target.value;
  changed();
};
$("blend").onchange = (e) => {
  doc.checkpoint();
  doc.layers[doc.layer].blend = e.target.value;
  changed();
};
$("doc-name").onchange = (e) => {
  doc.name = e.target.value.trim().slice(0, 80) || "Untitled";
  changed();
};
$("onion").onchange = draw;
$("grid").onchange = overlay;
$("fps").onchange = (e) => {
  doc.fps = Math.max(1, Math.min(30, Math.round(+e.target.value) || 10));
  e.target.value = doc.fps;
  changed();
};
function togglePlay() {
  playing = !playing;
  playFrame = doc.frame;
  playTime = 0;
  $("play").textContent = playing ? "Ⅱ" : "▶";
  $("play").setAttribute(
    "aria-label",
    playing ? "Pause animation" : "Play animation",
  );
  if (!playing) draw();
}
$("play").onclick = togglePlay;
let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  $("play").textContent = playing ? "Ⅱ" : "▶";
  if (playing && !document.hidden) {
    playTime += dt;
    if (playTime >= 1 / doc.fps) {
      playTime = 0;
      playFrame = (playFrame + 1) % doc.frames.length;
      preview(playFrame);
      if (threeMode && workshop)
        workshop.updateTexture(doc.composite(playFrame));
      const ctx = $("art").getContext("2d");
      ctx.clearRect(0, 0, doc.width, doc.height);
      ctx.drawImage(doc.composite(playFrame), 0, 0);
    }
  }
}
requestAnimationFrame(animate);
function setDocument(d) {
  doc = d;
  playing = false;
  selection = null;
  stroke = null;
  dimensions();
  changed();
  if (threeMode) update3d();
}
$("new").onclick = () => {
  modal(
    "A fresh sheet of possibility",
    '<p>Your current project stays available until you create a new one. Download a project copy to keep it.</p><label>Canvas size <select id="new-size"><option value="32">32 × 32 · Icon</option><option value="64">64 × 64 · Sprite</option><option value="128" selected>128 × 128 · Pixel art</option><option value="256">256 × 256 · Illustration</option><option value="512">512 × 512 · Texture</option></select></label><button id="new-confirm" class="accent">Create canvas</button><button id="demo">Load Quiet hours demo</button>',
  );
  $("new-confirm").onclick = () => {
    setDocument(new Document(+$("new-size").value, +$("new-size").value));
    $("dialog").close();
    status("Fresh canvas. Go make something.");
  };
  $("demo").onclick = () => {
    setDocument(demo());
    $("dialog").close();
  };
};
function saveProject() {
  download(
    JSON.stringify(doc.serialize()),
    doc.name + ".layer",
    "application/json",
  );
  status("Project downloaded, including every layer and frame.");
}
$("save").onclick = saveProject;
$("open").onclick = () => $("project-input").click();
$("project-input").onchange = safe(async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 60e6)
    throw Error("Please open a project smaller than 60 MB.");
  busy = true;
  try {
    status("Opening project…");
    const d = await Document.parse(JSON.parse(await file.text()));
    setDocument(d);
    status("Project opened.");
  } finally {
    busy = false;
    e.target.value = "";
  }
});
$("import").onclick = () => $("file-input").click();
$("file-input").onchange = safe(async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  busy = true;
  try {
    if (files.length > 48 - doc.frames.length + 1)
      throw Error("Too many images for the 48-frame limit.");
    status("Importing images…");
    const decoded = [];
    for (const f of files) {
      if (f.size > 20e6) throw Error("Please use images under 20 MB each.");
      decoded.push(await createImageBitmap(f));
    }
    doc.budget(doc.layers.length + 1, doc.frames.length + decoded.length - 1);
    doc.addLayer();
    doc.layers[doc.layer].name =
      files.length === 1 ? files[0].name.slice(0, 80) : "Imported sequence";
    for (let i = 0; i < decoded.length; i++) {
      if (i > 0) doc.addFrame(true);
      const ctx = doc.current.getContext("2d"),
        img = decoded[i];
      ctx.clearRect(0, 0, doc.width, doc.height);
      const scale = Math.min(doc.width / img.width, doc.height / img.height),
        w = Math.round(img.width * scale),
        h = Math.round(img.height * scale);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        img,
        Math.floor((doc.width - w) / 2),
        Math.floor((doc.height - h) / 2),
        w,
        h,
      );
      img.close();
    }
    selection = null;
    changed();
    status(
      `${files.length} image${files.length > 1 ? "s imported as animation frames" : " imported on a new layer"}.`,
    );
  } finally {
    busy = false;
    e.target.value = "";
  }
});
$("export").onclick = () => {
  modal(
    "Out of the canvas. Into the world.",
    '<div class="export-grid"><button id="png-export">Still image ↗<small>PNG · Current composite frame</small></button><button id="gif-export">Animation ↗<small>GIF · Transparent, looping</small></button><button id="sheet-export">Sprite sheet ↗<small>PNG · All frames in a grid</small></button><button id="meta-export">Frame metadata ↗<small>JSON · Coordinates and timing</small></button><button id="project-export">LAYER project ↗<small>Editable layers and frames</small></button><button id="workshop-export">3D workshop ↗<small>Textured GLB · Three.js ready</small></button></div><p>PNG and GLB preserve full alpha. GIF uses one-bit transparency. Your images are processed on your device.</p>',
  );
  $("png-export").onclick = safe(async () => {
    await png(doc.composite(), doc.name + ".png");
    status("PNG exported.");
  });
  $("gif-export").onclick = safe(async () => {
    busy = true;
    $("gif-export").disabled = true;
    status("Encoding animation…");
    try {
      const bytes = await gif(doc);
      download(bytes, doc.name + ".gif", "image/gif");
      status("Animated GIF exported.");
    } finally {
      busy = false;
      if ($("gif-export")) $("gif-export").disabled = false;
    }
  });
  $("sheet-export").onclick = safe(async () => {
    await png(sheet(doc).canvas, doc.name + "-sheet.png");
    status("Sprite sheet exported.");
  });
  $("meta-export").onclick = () => {
    const meta = sheet(doc).metadata;
    meta.image = doc.name + "-sheet.png";
    download(
      JSON.stringify(meta, null, 2),
      doc.name + "-sheet.json",
      "application/json",
    );
  };
  $("project-export").onclick = saveProject;
  $("workshop-export").onclick = () => {
    $("dialog").close();
    show3d();
  };
};
async function show3d() {
  playing = false;
  threeMode = true;
  $("three-space").hidden = false;
  $("canvas-space").hidden = true;
  $("three-tab").classList.add("active");
  $("paint-tab").classList.remove("active");
  try {
    if (!workshop) {
      const { Workshop } = await import("./workshop.js");
      workshop = new Workshop($("three-canvas"));
    }
    workshop.active = true;
    update3d();
  } catch (e) {
    status("3D requires WebGL 2. The drawing editor is still available.");
    console.error(e);
  }
}
function update3d() {
  if (workshop) {
    workshop.build(doc.composite(), $("mesh-type").value, +$("depth").value);
    status("Artwork rebuilt as a textured 3D mesh.");
  }
}
$("three-tab").onclick = show3d;
$("paint-tab").onclick = () => {
  threeMode = false;
  if (workshop) workshop.active = false;
  $("three-space").hidden = true;
  $("canvas-space").hidden = false;
  $("paint-tab").classList.add("active");
  $("three-tab").classList.remove("active");
  fit();
};
$("refresh-3d").onclick = update3d;
$("mesh-type").onchange = update3d;
$("depth").onchange = update3d;
$("export-glb").onclick = safe(async () => {
  if (!workshop) throw Error("3D renderer is unavailable.");
  status("Exporting GLB…");
  download(await workshop.export(), doc.name + ".glb", "model/gltf-binary");
  status("GLB exported. Import it into Three.js, Blender, Godot or Unreal.");
});
$("panels").onclick = () =>
  document.querySelector(".inspector").classList.toggle("visible");
$("help").onclick = () =>
  modal(
    "Small tools. Endless possibilities.",
    "<p><b>B</b> pencil · <b>E</b> erase · <b>F</b> fill · <b>I</b> picker<br><b>L</b> line · <b>R</b> rectangle · <b>O</b> ellipse · <b>T</b> triangle<br><b>S</b> select · <b>V</b> move · <b>Space</b> play / pause</p><p><b>Ctrl/⌘ Z</b> undo · <b>Ctrl/⌘ Shift Z</b> redo<br><b>Ctrl/⌘ C / X / V</b> copy / cut / paste<br><b>Ctrl/⌘ S</b> download project · <b>Delete</b> clear selection</p><p>Use the layer eye to hide artwork and the diamond to lock it. Double-click a layer name to rename it. Each animation frame has its own complete set of layers. Import several images to make a frame sequence.</p><p>The 3D workshop turns image brightness into mesh height, or maps artwork onto a card or cube. This is a deterministic image-to-mesh tool, not automatic AI object reconstruction.</p><p>Projects autosave on this browser. Export a .layer file for a portable backup. On phones, tap Panels to open layers and palettes.</p>",
  );
addEventListener("keydown", (e) => {
  if (
    ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) ||
    $("dialog").open ||
    busy
  )
    return;
  const cmd = e.ctrlKey || e.metaKey,
    k = e.key.toLowerCase();
  if (cmd && ["z", "y", "c", "x", "v", "s"].includes(k)) {
    e.preventDefault();
    if (k === "z") e.shiftKey ? redo() : undo();
    if (k === "y") redo();
    if (k === "c") copy();
    if (k === "x") copy(true);
    if (k === "v") paste();
    if (k === "s") saveProject();
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
    return;
  }
  const t = tools.find((t) => t[3].toLowerCase() === k);
  if (t) setTool(t[0]);
  if (k === "escape") {
    selection = null;
    overlay();
  }
  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    selection &&
    editable()
  ) {
    e.preventDefault();
    doc.checkpoint();
    doc.current
      .getContext("2d")
      .clearRect(selection.x, selection.y, selection.w, selection.h);
    changed();
  }
});
setTool("pencil");
palette();
dimensions();
draw();
renderLayers();
renderFrames();
const initialVersion = dirtyVersion;
loadLocal()
  .then(async (data) => {
    if (data && dirtyVersion === initialVersion) {
      const saved = await Document.parse(data);
      if (dirtyVersion === initialVersion) {
        doc = saved;
        dimensions();
        draw();
        renderLayers();
        renderFrames();
        status("Restored your last session.");
        $("save-status").textContent = "Restored from this device";
      }
    }
  })
  .catch(() =>
    status("Autosave unavailable. Use Save project to keep your work."),
  );
