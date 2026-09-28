import { test } from "node:test";
import assert from "node:assert/strict";
import { floodFill, linePoints, validateProject } from "../src/pixels.js";
test("connected flood fill respects boundaries, transparency, and same-color fills", () => {
  const d = new Uint8ClampedArray(4 * 4 * 4);
  for (let y = 0; y < 4; y++) d[(y * 4 + 2) * 4 + 3] = 255;
  floodFill(d, 4, 4, 0, 0, [255, 0, 0, 255]);
  assert.deepEqual(Array.from(d.slice(0, 4)), [255, 0, 0, 255]);
  assert.equal(d[(0 * 4 + 3) * 4 + 3], 0);
  assert.equal(d[(3 * 4 + 1) * 4], 255);
  const before = d.slice();
  floodFill(d, 4, 4, 0, 0, [255, 0, 0, 255]);
  assert.deepEqual(d, before);
  floodFill(d, 4, 4, -1, 0, [0, 0, 0, 0]);
  assert.deepEqual(d, before);
});
test("line rasterization has continuous points in all octants", () => {
  for (const [x, y] of [
    [10, 3],
    [-10, 3],
    [3, 10],
    [3, -10],
    [-5, -8],
    [0, 0],
  ]) {
    const p = linePoints(0, 0, x, y);
    assert.deepEqual(p[0], [0, 0]);
    assert.deepEqual(p.at(-1), [x, y]);
    for (let i = 1; i < p.length; i++) {
      assert.ok(Math.abs(p[i][0] - p[i - 1][0]) <= 1);
      assert.ok(Math.abs(p[i][1] - p[i - 1][1]) <= 1);
    }
  }
});
test("project validation rejects malformed data and working-memory overflow", () => {
  assert.throws(() => validateProject({}), /supported/);
  assert.throws(
    () =>
      validateProject({
        format: "LAYER",
        version: 1,
        width: 9999,
        height: 128,
      }),
    /dimensions/,
  );
  assert.throws(
    () =>
      validateProject({
        format: "LAYER",
        version: 1,
        width: 512,
        height: 512,
        layers: Array(12).fill({}),
        frames: Array(48).fill([]),
      }),
    /budget/,
  );
});
