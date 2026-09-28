export function floodFill(data, width, height, x, y, rgba, tolerance = 0) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const start = (y * width + x) * 4,
    target = Array.from(data.slice(start, start + 4));
  if (target.every((v, i) => v === rgba[i])) return;
  const seen = new Uint8Array(width * height),
    stack = [y * width + x];
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const j = p * 4;
    if (!target.every((v, i) => Math.abs(v - data[j + i]) <= tolerance))
      continue;
    for (let k = 0; k < 4; k++) data[j + k] = rgba[k];
    const px = p % width,
      py = Math.floor(p / width);
    if (px > 0) stack.push(p - 1);
    if (px < width - 1) stack.push(p + 1);
    if (py > 0) stack.push(p - width);
    if (py < height - 1) stack.push(p + width);
  }
}
export function hexRGBA(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
    255,
  ];
}
export function linePoints(x0, y0, x1, y1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const out = [],
    dx = Math.abs(x1 - x0),
    sx = x0 < x1 ? 1 : -1,
    dy = -Math.abs(y1 - y0),
    sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e = 2 * err;
    if (e >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}
export function validateProject(d) {
  if (!d || d.format !== "LAYER" || d.version !== 1)
    throw Error("This is not a supported LAYER project.");
  if (
    !Number.isInteger(d.width) ||
    !Number.isInteger(d.height) ||
    d.width < 8 ||
    d.height < 8 ||
    d.width > 512 ||
    d.height > 512
  )
    throw Error("Canvas dimensions must be between 8 and 512.");
  if (!Array.isArray(d.layers) || !d.layers.length || d.layers.length > 12)
    throw Error("Projects support 1–12 layers.");
  if (!Array.isArray(d.frames) || !d.frames.length || d.frames.length > 48)
    throw Error("Projects support 1–48 frames.");
  if (d.width * d.height * d.layers.length * d.frames.length > 16e6)
    throw Error("This project exceeds the 16 million pixel working budget.");
  if (
    !d.layers.every(
      (l) =>
        l &&
        typeof l.name === "string" &&
        l.name.length <= 80 &&
        typeof l.visible === "boolean" &&
        typeof l.locked === "boolean" &&
        Number.isFinite(l.opacity) &&
        l.opacity >= 0 &&
        l.opacity <= 1 &&
        ["source-over", "multiply", "screen", "overlay", "lighter"].includes(
          l.blend,
        ),
    )
  )
    throw Error("Invalid layer settings.");
  if (
    !d.frames.every(
      (f) =>
        Array.isArray(f) &&
        f.length === d.layers.length &&
        f.every(
          (s) =>
            typeof s === "string" &&
            s.startsWith("data:image/png;base64,") &&
            s.length < 3e6,
        ),
    )
  )
    throw Error("Invalid frame image data.");
  return true;
}
