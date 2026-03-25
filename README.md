# Slice It! — Web-Based 3D Slicing Utility

![Slice It! Logo](/public/logo.png)

**Slice It!** is a high-performance, 100% client-side 3D model slicing utility for the web. Designed for both professional CAD workflows and rapid prototyping, it allows users to perform complex boolean operations (CSG) on meshes and point-cloud filtering directly in the browser—with zero server compute.

---

## ⚡ Core Features

- **9-View Synchronized Workspace**: Visualize your models from all 6 orthographic views plus 3 perspective angles simultaneously.
- **Advanced Slicing Tools**:
  - **Primitives**: Subtract Box, Sphere, Cylinder, and Infinite Plane volumes.
  - **Knife (Point-to-Point)**: Create custom cuts by drawing polylines on any orthographic view.
  - **Lasso (Freeform)**: Draw freehand closed curves for organic, custom slicing.
- **Real-Time Visual Preview**: Instant clipping-plane feedback as you adjust tool positions.
- **Multi-Format Support**:
  - **Import**: STL, OBJ, glTF/GLB, PLY, 3MF, XYZ.
  - **Export**: STL, PLY, OBJ, glTF/GLB.
- **Hardware Accelerated**: Leverages **manifold3d** (WASM) for ultra-robust mesh booleans and **Three.js** for high-fidelity rendering.
- **Multi-threaded**: All heavy slicing operations are offloaded to Web Workers using **Comlink**, keeping the UI at a buttery 60fps.

---

## 🏗️ Architecture & Development

This project is built with a modern, reactive stack:
- **Frontend**: React 19 + Vite 6
- **3D Engine**: Three.js + React Three Fiber (R3F)
- **State**: Zustand (Single source of truth)
- **Slicing Core**: manifold3d (via WebAssembly)
- **Styling**: TailwindCSS 4 (Premium Cyber-Industrial theme)
- **Concurrency**: Web Workers + Comlink

Detailed documentation can be found in the `docs/` directory:
- [Architecture Overview](docs/01-ARCHITECTURE.md)
- [Implementation Plan](docs/02-IMPLEMENTATION-PLAN.md)
- [Component Specification](docs/03-COMPONENT-SPEC.md)
- [State Management](docs/04-STATE-MANAGEMENT.md)
- [Worker & CSG Engine](docs/05-WORKER-CSG-ENGINE.md)
- [Setup & Configuration Guide](docs/06-SETUP-GUIDE.md)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher

### Local Development
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🛠️ Build & Deploy

- **Production Build**: `npm run build`
- **Preview Production Build**: `npm run preview`
- **Lint**: `npm run lint`

The project is configured for seamless deployment on **Vercel** with full Support for `SharedArrayBuffer` (via COOP/COEP headers).

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
