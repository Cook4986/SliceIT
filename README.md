<div align="center">

```
 ███████╗██╗     ██╗ ██████╗███████╗  ██╗████████╗██╗
 ██╔════╝██║     ██║██╔════╝██╔════╝  ██║╚══██╔══╝██║
 ███████╗██║     ██║██║     █████╗    ██║   ██║   ██║
 ╚════██║██║     ██║██║     ██╔══╝    ██║   ██║   ╚═╝
 ███████║███████╗██║╚██████╗███████╗  ██║   ██║   ██╗
 ╚══════╝╚══════╝╚═╝ ╚═════╝╚══════╝  ╚═╝   ╚═╝   ╚═╝
```

**Browser-based 3D mesh slicer. No installs. No sign-ups. Just slicing. 🔪**

[![React 18](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-r164-black?style=flat-square&logo=threedotjs)](https://threejs.org)
[![Manifold-3D](https://img.shields.io/badge/CSG-manifold--3d-blueviolet?style=flat-square)](https://manifoldcad.org)
[![MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

## What is it?

SliceIT! is a browser-based tool for slicing 3D meshes with boolean operations. Drop a model, pick a tool, press one button — done.

It runs entirely client-side (no backend, no uploads) and uses [manifold-3d](https://github.com/elalish/manifold) WASM for watertight boolean geometry, offloaded to a WebWorker so the UI stays responsive.

---

## How it works

| Step | Action |
|------|--------|
| 📂 **Load** | Drop a mesh file or use a built-in preset |
| 🔪 **Aim** | Choose a cutting tool and position it |
| ✂️ **Slice** | Boolean subtraction runs in a WebWorker |
| 💾 **Save** | Export the result |

---

## Cutting tools

| Tool | Key | Description |
|------|-----|-------------|
| 🔪 Knife | `K` | Plane cut. Ortho: 2 clicks define an edge. ISO: 3 clicks define a plane. |
| 🪢 Lasso | `L` | Freeform polygon cut (3–9 points). |
| 📦 Box | `B` | Scalable box subtraction. |
| ⚽ Sphere | `S` | Scalable sphere subtraction. |

### Knife workflow

**Orthographic viewports** (Top, Front, Right, etc.) — 2 clicks:
1. Click to set the anchor point
2. Click to define the cut line → plane deploys along that edge, extending into the scene depth

**ISO viewports** — 3 clicks:
1. Click to anchor
2. Click to set direction
3. Click to set angle → plane deploys from the cross product

After deployment, use the transform controls to fine-tune:

| Key | Mode |
|-----|------|
| `W` | Move |
| `E` | Rotate |
| `R` | Scale (Box/Sphere only) |

---

## Supported formats

### Import

| Format | Extension |
|--------|-----------|
| STL | `.stl` |
| OBJ | `.obj` |
| glTF / GLB | `.gltf` `.glb` |
| PLY | `.ply` |
| 3MF | `.3mf` |
| XYZ | `.xyz` (point cloud) |

### Export

| Format | Extension |
|--------|-----------|
| GLB | `.glb` |
| STL | `.stl` |
| OBJ | `.obj` |
| PLY | `.ply` |
| glTF | `.gltf` |

Exports include UV attributes and mesh names for clean import into Blender, MeshLab, Sketchfab, etc.

---

## Running locally

```bash
git clone https://github.com/Cook4986/SliceIT.git
cd SliceIT
npm install
npm run dev
```

Requires Node 18+. No environment variables needed.

---

## Architecture

```
Main Thread                  WebWorker
┌───────────────────┐        ┌─────────────────────┐
│ React + R3F       │        │ slicing.worker.ts    │
│ ├─ Zustand Store ─┼─Comlink──▶ manifold-3d WASM │
│ ├─ CuttingPlane   │        │   (primary)          │
│ ├─ ViewCamera ×9  │        │ three-csg-ts         │
│ └─ StatusBar      │        │   (fallback)         │
└───────────────────┘        └─────────────────────┘
```

| Layer | Technology |
|-------|-----------|
| UI | React 18, TypeScript |
| 3D | Three.js, React Three Fiber, drei |
| CSG | manifold-3d (WASM), three-csg-ts |
| State | Zustand |
| Workers | Comlink |
| Build | Vite 6 |

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `K` | Knife tool |
| `L` | Lasso tool |
| `B` | Box tool |
| `S` | Sphere tool |
| `W` | Translate mode |
| `E` | Rotate mode |
| `R` | Scale mode |
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |

---

## Limitations

- **WASM cold-start** — first slice has ~1s init latency
- **Open shells** — non-solid geometry (terrain, section cuts) may produce unexpected results
- **No textures** — geometry only; placeholder UVs added on export
- **Lasso** — currently extrudes as half-space; per-vertex filtering planned

---

## License

MIT

---

<div align="center">
  <a href="https://mncook.net"><strong>mncook.net</strong></a>
</div>
