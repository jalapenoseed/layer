# LAYER — ELI5

LAYER is a free, browser-based drawing and animation studio.

Think **classic MS Paint + pixel art + Jasc Animation Shop + a small Three.js workshop**.

You can draw, work with layers, animate frame-by-frame, export GIFs and sprite sheets, and turn artwork into simple 3D GLB assets.

## The simple mental model

A LAYER project has:

- one canvas size,
- several layers,
- several animation frames,
- one little canvas for every layer inside every frame.

If a project has 4 layers and 8 frames, LAYER is managing 32 small canvases and combining the visible ones for you.

## What can it do?

- Pencil, eraser, fill, color picker, line and shape tools
- Selection, move, copy, cut and paste
- Layers with visibility, locks, opacity and blend modes
- Frame-by-frame animation
- Onion skinning
- 1–30 FPS preview
- PNG export
- Transparent animated GIF export
- Sprite-sheet PNG + frame metadata JSON
- Editable `.layer` project files
- Browser autosave with IndexedDB
- Image import
- Three.js sprite card, relief mesh and texture cube generation
- GLB export for Three.js, Blender, Godot and other 3D tools

## Run it

Requires Node.js 22.12+.

### Windows

Double-click:

```
START.cmd
```

### Terminal

```sh
npm ci
npm run dev -- --port 5176
```

Then open the local address Vite prints.

To verify the project:

```sh
npm test
npm run build
```

## Where is everything?

```
index.html        Main editor HTML
src/main.js       Editor UI, tools and input
src/model.js      Project, layers, frames, history and serialization
src/pixels.js     Pixel algorithms and project validation
src/export.js     PNG/GIF/sprite-sheet export and autosave
src/workshop.js   Three.js 3D workshop and GLB export
src/style.css     Application styling
tests/            Automated tests
QA.md             Manual QA notes
```

## What makes LAYER different?

It is intentionally lightweight and understandable.

The 2D editor uses the browser Canvas API for exact pixel editing. The 3D workshop uses Three.js. There is no required backend, account, cloud service or AI model.

The source is meant to be readable enough that a beginner can learn from it and small enough that experienced developers can modify it quickly.

## Can I use the code?

Yes. LAYER is open source under the MIT License.

Fork it, learn from it, change it, build something weird with it, or use pieces in your own project.

See the main README for technical details and contribution notes.
