import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { canvas } from "./model.js";
export function download(data, name, type = "application/octet-stream") {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 30000);
}
export async function png(c, name) {
  const b = await new Promise((r) => c.toBlob(r, "image/png"));
  if (!b) throw Error("Could not create PNG.");
  download(b, name);
}
export async function gif(doc, scale = 1) {
  const gif = GIFEncoder(),
    w = doc.width * scale,
    h = doc.height * scale;
  for (let i = 0; i < doc.frames.length; i++) {
    const c = canvas(w, h),
      ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(doc.composite(i), 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data,
      palette = quantize(data, 256, { format: "rgba4444", oneBitAlpha: true }),
      index = applyPalette(data, palette, "rgba4444"),
      transparentIndex = palette.findIndex((c) => c[3] === 0);
    gif.writeFrame(index, w, h, {
      palette,
      delay: Math.round(1000 / doc.fps),
      repeat: 0,
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
      dispose: 2,
    });
    await new Promise((r) => setTimeout(r, 0));
  }
  gif.finish();
  return gif.bytes();
}
export function sheet(doc) {
  const columns = Math.min(8, doc.frames.length),
    rows = Math.ceil(doc.frames.length / columns),
    c = canvas(columns * doc.width, rows * doc.height),
    ctx = c.getContext("2d");
  const frames = [];
  for (let i = 0; i < doc.frames.length; i++) {
    const x = (i % columns) * doc.width,
      y = Math.floor(i / columns) * doc.height;
    ctx.drawImage(doc.composite(i), x, y);
    frames.push({
      name: `frame_${i}`,
      x,
      y,
      width: doc.width,
      height: doc.height,
      duration: 1000 / doc.fps,
    });
  }
  return {
    canvas: c,
    metadata: {
      image: doc.name + ".png",
      width: c.width,
      height: c.height,
      frames,
    },
  };
}
export async function saveLocal(data) {
  const db = await database();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(data, "autosave");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
export async function loadLocal() {
  const db = await database();
  const result = await new Promise((resolve, reject) => {
    const tx = db.transaction("projects"),
      req = tx.objectStore("projects").get("autosave");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}
function database() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("layer-studio", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("projects");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
