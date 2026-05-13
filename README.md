<div align="right">
  <a href="https://mncook.net" style="color: #ff00ff; text-shadow: 0 0 5px #ff00ff, 0 0 10px #ff00ff, 0 0 20px #ff00ff; font-family: 'Impact', fantasy; font-size: 1.2rem; text-decoration: none; letter-spacing: 2px;">
</div>

<div align="center">

```
 ███████╗██╗     ██╗ ██████╗███████╗  ██╗████████╗██╗
 ██╔════╝██║     ██║██╔════╝██╔════╝  ██║╚══██╔══╝██║
 ███████╗██║     ██║██║     █████╗    ██║   ██║   ██║
 ╚════██║██║     ██║██║     ██╔══╝    ██║   ██║   ╚═╝
 ███████║███████╗██║╚██████╗███████╗  ██║   ██║   ██╗
 ╚══════╝╚══════╝╚═╝ ╚═════╝╚══════╝  ╚═╝   ╚═╝   ╚═╝
```

**Browser-based 3D mesh slicer. No installs. No sign-ups. Just slicing.**

[![React 18](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-r164-black?style=flat-square&logo=threedotjs)](https://threejs.org)
[![Manifold-3D](https://img.shields.io/badge/CSG-manifold--3d-blueviolet?style=flat-square)](https://manifoldcad.org)
[![MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

## What is it?

SliceIT! is a browser-based tool for slicing 3D meshes using boolean operations. Drop a model, pick a tool, press one button — done.

It runs entirely client-side, meaning there are no backend servers or uploads required. It leverages [manifold-3d](https://github.com/elalish/manifold) WASM for robust, watertight boolean geometry. All heavy computations are offloaded to a WebWorker, ensuring the UI remains perfectly responsive.

---

## How it works

| Step | Action |
|------|--------|
| 📂 **Load** | Drop a mesh file into the browser or use a built-in preset. |
| 🎯 **Aim** | Choose a cutting tool and position it on your model. |
| ✂️ **Slice** | Execute the boolean subtraction (runs smoothly in a WebWorker). |
| 💾 **Save** | Export your sliced model in your preferred format. |

---

## Features & Tools

SliceIT! provides four specialized tools to manipulate your models. 

### 🔪 Slice It (Knife Tool)
**Key: `K`**  
Use the Knife tool to make precise plane cuts across your mesh.  
* **Orthographic Views** (Top, Front, Right): 2 clicks define an edge. The plane deploys along that edge, extending into the scene depth.
* **Perspective Views** (ISO): 3 clicks define a plane. The plane deploys from the cross product of the points.

![Slice It](Slice%20It.png)

### 🪢 Rope It (Lasso Tool)
**Key: `L`**  
Use the Lasso tool to draw freeform polygon cuts (3–9 points). Ideal for punching custom shapes through a model.

![Rope It](Rope%20It.png)

### 📦 Cube It (Box Tool)
**Key: `B`**  
Use the Box tool for scalable bounding-box subtractions. Great for cutting out rectangular sections.

![Cube It](Cube%20It.png)

### 🔴 Bop It (Sphere Tool)
**Key: `S`**  
Use the Sphere tool for scalable spherical subtractions. Perfect for creating rounded craters or hollows.

![Bop It](Bop%20It.png)

### Transform Controls
After placing a tool, use the transform controls to fine-tune its position, rotation, and scale:

| Key | Mode |
|-----|------|
| `W` | Move |
| `E` | Rotate |
| `R` | Scale (Box/Sphere only) |

---

## Supported Formats

### Import
| Format | Extension | Notes |
|--------|-----------|-------|
| STL | `.stl` | Standard |
| OBJ | `.obj` | Standard |
| glTF / GLB | `.gltf` `.glb` | Standard |
| PLY | `.ply` | Standard |
| 3MF | `.3mf` | Standard |
| XYZ | `.xyz` | Point cloud (Experimental) |

### Export
| Format | Extension |
|--------|-----------|
| GLB | `.glb` |
| STL | `.stl` |
| OBJ | `.obj` |
| PLY | `.ply` |
| glTF | `.gltf` |

*Note: Exports include UV attributes and mesh names for clean imports into Blender, MeshLab, Sketchfab, etc.*

---

## Running Locally

To run the application locally on your machine:

```bash
git clone https://github.com/Cook4986/SliceIT.git
cd SliceIT
npm install
npm run dev
```

*Requires Node 18+. No environment variables are needed.*

---

## Architecture

SliceIT! uses a multi-threaded architecture to keep the UI smooth during heavy geometric calculations.

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
| **UI** | React 18, TypeScript |
| **3D Rendering** | Three.js, React Three Fiber, drei |
| **CSG Engine** | manifold-3d (WASM), three-csg-ts |
| **State** | Zustand |
| **Workers** | Comlink |
| **Build Tool** | Vite 6 |

---

## Keyboard Shortcuts

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

## Current Limitations

- **WASM Cold-Start:** The very first slice has a ~1s initialization latency.
- **Open Shells:** Non-solid geometry (like terrain or single-plane section cuts) may produce unexpected boolean results.
- **Textures:** Currently handles geometry only. Placeholder UVs are added upon export to ensure compatibility.
- **Lasso Tool:** Extrudes as a half-space. Per-vertex filtering is planned for a future update.

---

## License

[MIT License](LICENSE) | Built by <a href="https://mncook.net" style="color: #ff00ff; text-shadow: 0 0 5px #ff00ff; font-family: 'Impact', fantasy; text-decoration: none; letter-spacing: 1px;">mncook.net</a>
