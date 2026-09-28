import { validateProject } from "./pixels.js";
export function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
export class Document {
  constructor(w = 128, h = 128) {
    this.width = w;
    this.height = h;
    this.name = "Untitled";
    this.fps = 10;
    this.layers = [
      {
        name: "Layer 1",
        visible: true,
        locked: false,
        opacity: 1,
        blend: "source-over",
      },
    ];
    this.frames = [[canvas(w, h)]];
    this.frame = 0;
    this.layer = 0;
    this.undoStack = [];
    this.redoStack = [];
  }
  get current() {
    return this.frames[this.frame][this.layer];
  }
  composite(frame = this.frame) {
    const out = canvas(this.width, this.height),
      ctx = out.getContext("2d");
    this.layers.forEach((l, i) => {
      if (l.visible) {
        ctx.globalAlpha = l.opacity;
        ctx.globalCompositeOperation = l.blend;
        ctx.drawImage(this.frames[frame][i], 0, 0);
      }
    });
    return out;
  }
  snapshot() {
    return {
      width: this.width,
      height: this.height,
      name: this.name,
      fps: this.fps,
      layers: structuredClone(this.layers),
      frames: this.frames.map((f) =>
        f.map((c) =>
          c.getContext("2d").getImageData(0, 0, this.width, this.height),
        ),
      ),
      frame: this.frame,
      layer: this.layer,
    };
  }
  checkpoint() {
    this.undoStack.push(this.snapshot());
    const max = Math.max(
      2,
      Math.min(
        25,
        Math.floor(
          48e6 /
            (this.width *
              this.height *
              4 *
              this.layers.length *
              this.frames.length),
        ),
      ),
    );
    while (this.undoStack.length > max) this.undoStack.shift();
    this.redoStack = [];
  }
  restore(s) {
    for (const k of ["width", "height", "name", "fps", "frame", "layer"])
      this[k] = s[k];
    this.layers = structuredClone(s.layers);
    this.frames = s.frames.map((f) =>
      f.map((im) => {
        const c = canvas(this.width, this.height);
        c.getContext("2d").putImageData(im, 0, 0);
        return c;
      }),
    );
  }
  undo() {
    if (!this.undoStack.length) return false;
    this.redoStack.push(this.snapshot());
    this.restore(this.undoStack.pop());
    return true;
  }
  redo() {
    if (!this.redoStack.length) return false;
    this.undoStack.push(this.snapshot());
    this.restore(this.redoStack.pop());
    return true;
  }
  budget(layers, frames) {
    if (this.width * this.height * layers * frames > 16e6)
      throw Error("Working pixel budget reached. Use fewer frames or layers.");
  }
  addLayer() {
    if (this.layers.length >= 12) throw Error("Maximum 12 layers.");
    this.budget(this.layers.length + 1, this.frames.length);
    this.checkpoint();
    this.layers.push({
      name: `Layer ${this.layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      blend: "source-over",
    });
    for (const f of this.frames) f.push(canvas(this.width, this.height));
    this.layer = this.layers.length - 1;
  }
  addFrame(duplicate = false) {
    if (this.frames.length >= 48) throw Error("Maximum 48 frames.");
    this.budget(this.layers.length, this.frames.length + 1);
    this.checkpoint();
    const f = this.layers.map((_, i) => {
      const c = canvas(this.width, this.height);
      if (duplicate)
        c.getContext("2d").drawImage(this.frames[this.frame][i], 0, 0);
      return c;
    });
    this.frames.splice(this.frame + 1, 0, f);
    this.frame++;
  }
  deleteFrame() {
    if (this.frames.length === 1) return;
    this.checkpoint();
    this.frames.splice(this.frame, 1);
    this.frame = Math.min(this.frame, this.frames.length - 1);
  }
  deleteLayer() {
    if (this.layers.length === 1) return;
    this.checkpoint();
    this.layers.splice(this.layer, 1);
    for (const f of this.frames) f.splice(this.layer, 1);
    this.layer = Math.min(this.layer, this.layers.length - 1);
  }
  reorder(delta) {
    const to = this.layer + delta;
    if (to < 0 || to >= this.layers.length) return;
    this.checkpoint();
    [this.layers[this.layer], this.layers[to]] = [
      this.layers[to],
      this.layers[this.layer],
    ];
    for (const f of this.frames)
      [f[this.layer], f[to]] = [f[to], f[this.layer]];
    this.layer = to;
  }
  merge() {
    const i = this.layer;
    if (i === 0) return false;
    const lower = this.layers[i - 1],
      upper = this.layers[i];
    if (lower.locked || upper.locked)
      throw Error("Unlock both layers before merging.");
    if (lower.blend !== "source-over" || upper.blend !== "source-over")
      throw Error(
        "Set both layers to Normal before merging to preserve their appearance.",
      );
    this.checkpoint();
    for (const f of this.frames) {
      const c = canvas(this.width, this.height),
        ctx = c.getContext("2d");
      for (const j of [i - 1, i]) {
        const l = this.layers[j];
        if (l.visible) {
          ctx.globalAlpha = l.opacity;
          ctx.drawImage(f[j], 0, 0);
        }
      }
      f[i - 1] = c;
      f.splice(i, 1);
    }
    this.layers[i - 1] = { ...lower, opacity: 1, visible: true };
    this.layers.splice(i, 1);
    this.layer--;
    return true;
  }
  serialize() {
    return {
      format: "LAYER",
      version: 1,
      name: this.name,
      width: this.width,
      height: this.height,
      fps: this.fps,
      layers: this.layers,
      frames: this.frames.map((f) => f.map((c) => c.toDataURL("image/png"))),
    };
  }
  static async parse(data) {
    validateProject(data);
    const d = new Document(data.width, data.height);
    d.name = String(data.name || "Untitled").slice(0, 80);
    d.fps = Math.max(1, Math.min(30, Number(data.fps) || 10));
    d.layers = structuredClone(data.layers);
    d.frames = [];
    for (const f of data.frames) {
      const out = [];
      for (const uri of f) {
        const im = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(Error("Could not decode a frame."));
          img.src = uri;
        });
        if (im.width !== d.width || im.height !== d.height)
          throw Error("Frame dimensions do not match the project.");
        const c = canvas(d.width, d.height);
        c.getContext("2d").drawImage(im, 0, 0);
        out.push(c);
      }
      d.frames.push(out);
    }
    return d;
  }
}
export function demo() {
  const d = new Document(160, 120);
  d.name = "Quiet hours";
  d.layers = [
    "Sky & stars",
    "Distant peaks",
    "Pines & shore",
    "Water & lanterns",
  ].map((name) => ({
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blend: "source-over",
  }));
  d.frames = [];
  for (let f = 0; f < 8; f++) {
    const layers = d.layers.map(() => canvas(160, 120));
    let x = layers[0].getContext("2d");
    const colors = ["#253c4a", "#334958", "#515b65", "#8c7874", "#cd9c79"];
    for (let y = 0; y < 82; y++) {
      x.fillStyle = colors[Math.min(4, Math.floor(y / 17))];
      x.fillRect(0, y, 160, 1);
    }
    x.fillStyle = "#f4d6a0";
    x.beginPath();
    x.arc(114, 35, 12, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#253c4a";
    x.beginPath();
    x.arc(109, 30, 11, 0, Math.PI * 2);
    x.fill();
    for (let i = 0; i < 30; i++) {
      x.fillStyle = i % 3 === f % 3 ? "#b5cac2" : "#7d98a0";
      x.fillRect((i * 47 + 8) % 160, (i * 17 + 5) % 45, 1, 1);
    }
    x = layers[1].getContext("2d");
    x.fillStyle = "#67767b";
    x.beginPath();
    x.moveTo(0, 78);
    for (let i = 0; i <= 160; i += 8)
      x.lineTo(i, 55 + Math.sin(i * 0.12) * 12 + Math.cos(i * 0.29) * 5);
    x.lineTo(160, 95);
    x.lineTo(0, 95);
    x.fill();
    x.fillStyle = "#3b5860";
    x.beginPath();
    x.moveTo(0, 90);
    for (let i = 0; i <= 160; i += 6) x.lineTo(i, 73 + Math.sin(i * 0.1) * 9);
    x.lineTo(160, 105);
    x.lineTo(0, 105);
    x.fill();
    x = layers[2].getContext("2d");
    x.fillStyle = "#203c3f";
    x.fillRect(0, 87, 160, 33);
    for (let i = 0; i < 23; i++) {
      const tx = (i * 19) % 160,
        ty = 78 + Math.sin(i) * 5,
        h = 9 + ((i * 7) % 17);
      x.fillRect(tx - 1, ty - h, 2, h + 2);
      x.beginPath();
      x.moveTo(tx, ty - h);
      x.lineTo(tx - 6, ty);
      x.lineTo(tx + 6, ty);
      x.fill();
    }
    x = layers[3].getContext("2d");
    x.fillStyle = "#304f52";
    x.fillRect(0, 93, 160, 27);
    for (let i = 0; i < 45; i++) {
      x.fillStyle = ["#416567", "#4c7372", "#698b7f"][i % 3];
      x.fillRect(
        (((i * 23 + f * (i % 2 ? 1 : -1)) % 165) + 165) % 165,
        94 + ((i * 7) % 25),
        3 + (i % 6),
        1,
      );
    }
    for (let i = 0; i < 8; i++) {
      x.fillStyle = i % 2 ? "#aa9671" : "#d5ac79";
      x.fillRect(102 - i * 2 + (f % 3), 95 + i * 3, 10 + i * 3, 1);
    }
    x.fillStyle = "#102e30";
    x.fillRect(12, 107, 28, 3);
    x.fillRect(20, 106, 2, 14);
    x.fillStyle = "#d4a574";
    x.fillRect(25, 102, 3, 4);
    x.fillStyle = "#f6d991";
    x.fillRect(26, 102, 1, 3);
    d.frames.push(layers);
  }
  d.frame = 0;
  d.layer = 3;
  return d;
}
