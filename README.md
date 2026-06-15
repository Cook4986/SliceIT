<div align="center">

<img src="assets/logo.svg" alt="SLICE IT!" width="520" />

**Browser-based 3D mesh slicer. No installs. No sign-ups. Just slicing.**

[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-r164-black?style=flat-square&logo=threedotjs)](https://threejs.org)
[![Manifold-3D](https://img.shields.io/badge/CSG-manifold--3d-blueviolet?style=flat-square)](https://manifoldcad.org)
[![MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

## What is it?

SliceIT! is a browser-based tool for slicing 3D meshes with boolean operations. Drop a model, pick a tool, press one button — done.

Everything runs client-side: no servers, no uploads. Boolean geometry is powered by [manifold-3d](https://github.com/elalish/manifold) WASM for robust, watertight results, and all heavy computation runs in a WebWorker so the UI stays responsive.

---

## How it works

| Step | Action |
|------|--------|
| 📂 **Load** | Drop a mesh file into the browser or use a built-in preset. |
| 🎯 **Aim** | Choose a cutting tool and position it on your model. |
| ✂️ **Slice** | Execute the boolean operation (runs in a WebWorker). |
| 💾 **Save** | Export your sliced model in your preferred format. |

---

## Tools

### 🔪 Slice It (Knife) — `K`
Precise plane cuts.
* **Orthographic views** (Top, Front, Right): 2 clicks define an edge; the plane extends into scene depth.
* **Perspective views** (ISO): 3 clicks define the plane directly.

![Slice It](Slice%20It.png)

### 🪢 Rope It (Lasso) — `L`
Freeform polygon cuts (3–9 points). Ideal for punching custom shapes through a model.

![Rope It](Rope%20It.png)

### 📦 Cube It (Box) — `B`
Scalable bounding-box subtractions for rectangular sections.

![Cube It](Cube%20It.png)

### 🔴 Bop It (Sphere) — `S`
Scalable spherical subtractions for rounded craters and hollows.

![Bop It](Bop%20It.png)

### 🛹 Plane It (Plane) — `P`
A free-floating cutting plane with move/rotate gizmos — no clicks on the model required. Semi-transparent arrows mark which side will be cropped, and the GPU preview shows exactly which side will be removed.

![Plane It](Plane%20It.png)

### Transform Controls

| Key | Mode |
|-----|------|
| `W` | Move |
| `E` | Rotate |
| `R` | Scale (Box/Sphere only) |

---

## Slice Modes & Settings

Every tool works in one of three modes — cycle them from the toolbar or pick one in Settings (⚙️):

| Mode | Effect |
|------|--------|
| ✂️ **CUT** | Remove the tool volume from the model (default) |
| 🎯 **KEEP** | Keep only what the tool covers |
| 💥 **BOTH** | Keep both halves, offset apart (meshes only) |

The Settings panel (⚙️) also controls:
* **Texture Preservation (🎨)** — carry UVs through cuts on textured models.
* **Undo Depth** — history size, 5–30 steps.

---

## Supported Formats

### Import
| Format | Extension | Notes |
|--------|-----------|-------|
| STL | `.stl` | Standard |
| OBJ | `.obj` | Materials preserved |
| glTF / GLB | `.gltf` `.glb` | Materials preserved |
| PLY | `.ply` | Standard |
| XYZ | `.xyz` | Point cloud — sliced via per-point filtering |

### Export
GLB · STL · OBJ · PLY · glTF

*Exported files are suffixed `_sliced` (e.g. `model_cube` → `model_cube_sliced.stl`) and include UV attributes and mesh names for clean imports into Blender, MeshLab, Sketchfab, etc.*

---

## Running Locally

```bash
git clone https://github.com/Cook4986/SliceIT.git
cd SliceIT
npm install
npm run dev
```

*Requires Node 18+. No environment variables needed.*

```bash
npm test        # vitest unit suite (geometry, CSG helpers, store)
npm run lint    # ESLint flat config
npm run build   # type-check + production bundle
```

---

## Architecture

SliceIT! keeps the UI smooth by running all geometric heavy lifting off the main thread.

```text
Main Thread                  WebWorker
┌───────────────────┐        ┌─────────────────────┐
│ React + R3F       │        │ slicing.worker.ts   │
│ ├─ Zustand Store  ├─Comlink▶ manifold-3d WASM    │
│ ├─ CuttingPlane   │        │   (primary)         │
│ ├─ ViewCamera ×9  │        │ three-csg-ts        │
│ └─ StatusBar      │        │   (fallback)        │
└───────────────────┘        └─────────────────────┘
```

| Layer | Technology |
|-------|-----------|
| **UI** | React 19, TypeScript |
| **3D Rendering** | Three.js, React Three Fiber, drei |
| **CSG Engine** | manifold-3d (WASM), three-csg-ts |
| **State** | Zustand (sliced store: model / tool / view / operation / history / ui) |
| **Workers** | Comlink |
| **Build Tool** | Vite 6 |
| **Tests** | Vitest |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `K` `L` `B` `S` `P` | Knife / Lasso / Box / Sphere / Plane tool |
| `W` `E` `R` | Translate / Rotate / Scale mode |
| `Enter` | Execute slice |
| `Esc` | Close overlay / cancel drawing / deselect tool |
| `1`–`9` | Select viewport |
| `⌘Z` / `⌘⇧Z` | Undo / Redo |
| `?` | Shortcut help overlay |

Right-click a viewport (without dragging) for the quick-slice context menu.

---

## Current Limitations

- **WASM cold-start:** The very first slice has a ~1s initialization latency.
- **Open shells:** Non-solid geometry (terrain, single-plane sections) may produce unexpected boolean results.
- **Textures:** With Texture Preservation ON, UVs survive on original surfaces, but freshly created cut faces get interpolated (smeared) coordinates. The three-csg-ts fallback drops UVs entirely.
- **Point clouds:** Sliced via per-point filtering — BOTH mode applies to meshes only.
- **3MF:** Not supported.

---

## License

[MIT License](LICENSE) · Built by [mncook.net](https://mncook.net)
