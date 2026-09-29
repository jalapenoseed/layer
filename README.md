# LAYER

**MS Paint meets pixel animation and Three.js — open source, local-first, and built for the browser.**

## Start here

New to the project? Read [ELI5.md](docs/ELI5.md). For release copy, search wording, and social descriptions, see [SEO.md](docs/SEO.md).

A modern JavaScript paint and animation studio inspired by the original LAYER / PocketPaint experiments and MS Paint / Jasc Animation Shop. Canvas 2D handles exact pixel editing; Three.js powers the image-to-mesh workshop.

## Run

Node 22.12+ required (Node 24 recommended).

```sh
npm ci
npm run dev -- --port 5176
npm test
npm run build
```

`dist/` is a portable static web build; no server-side processing or API keys. Touch and mouse work. Phone users can open the inspector with **Panels**.

## Tools

Pencil, eraser, connected flood fill, eyedropper, line, rectangle, ellipse, triangle, selection, movement, copy/cut/paste, mirror pencil, filled/outlined shapes, zoom and pixel grid. Layer visibility, locks, opacity, five blend modes, reordering, naming, deletion and alpha-aware normal-layer merge. Bounded undo/redo history.

Frame add/duplicate/delete, onion skin, 1–30 FPS preview, image sequence import, and four palettes. The built-in Quiet hours animation has eight frames and four independent layers. Limits: 512 × 512 canvas, 12 layers, 48 frames, 16 million working pixels; combinations are bounded to avoid excessive memory use.

PNG, transparent looping GIF, sprite-sheet PNG, frame metadata JSON, and editable `.layer` project export. Browser autosave uses IndexedDB. Import and export happen on the device. A project download is the portable backup; clearing browser data removes autosave.

## Image → Three.js

Import a photograph or use your artwork, then switch to **3D workshop**. Make a sprite card, brightness-based relief mesh, or texture cube. Adjust depth, orbit/zoom, and export a GLB with embedded texture. GLB can be imported into Three.js, Blender, Godot and other tools. This deterministic image-to-mesh route does not infer unseen geometry or perform AI object reconstruction.

## Shortcuts

B pencil, E erase, F fill, I picker, L line, R rectangle, O ellipse, T triangle, S select, V move. Space plays animation. Ctrl/Command Z undo; Shift Z redo; C/X/V clipboard; S downloads the project. Delete clears selection. Escape deselects.

## Architecture

`model.js` owns layers, per-frame cels, history and project serialization. `pixels.js` provides testable fill/raster algorithms and validation. `main.js` owns input and editor UI. `export.js` provides PNG/GIF/sheet/project and autosave. `workshop.js` lazy-loads Three.js, OrbitControls and GLTFExporter.

Three.js 0.186.1 · Vite 8.3.1 · gifenc 1.0.3. Tests cover fill boundaries, line continuity and malformed-project rejection. Exported GIF uses 1-bit alpha; PNG and GLB preserve full texture alpha. The original LAYER source archive was not found; this is a fresh rebuild from recovered feature notes.

On Windows, double-click `START.cmd` to install dependencies if needed and open the app.

## License

MIT. See [LICENSE](LICENSE).
