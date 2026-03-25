# Slice It! — v1.0 Architecture Document

> **Version**: 1.0.0  
> **Last Updated**: 2026-03-23  
> **Status**: Planning / Pre-Development  

---

## 1. Overview

**Slice It!** is a free, web-based 3D model slicing utility that runs entirely in the browser. Users upload 3D models (meshes or point clouds), visualize them across 9 synchronized viewports, and slice/cut geometry using knife, lasso, and negative-space primitive tools.

### 1.1 Core Principles

| Principle | Detail |
|---|---|
| **100% Client-Side** | Zero server compute. All processing happens in the user's browser via WASM and Web Workers. |
| **Reactive State** | Single source of truth (Zustand). Geometry changes propagate to all 9 views automatically. |
| **Non-Blocking UI** | Heavy CSG/filtering operations run in Web Workers. The main thread stays responsive. |
| **Progressive Enhancement** | Real-time clipping plane previews before committing expensive boolean operations. |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   React SPA (Vite)                   │   │
│  │                                                      │   │
│  │  ┌─────────────┐  ┌──────────┐  ┌────────────────┐  │   │
│  │  │  UI Layer   │  │  Zustand  │  │  File I/O      │  │   │
│  │  │  (Toolbar,  │◄─┤  Store    ├─►│  (Import/      │  │   │
│  │  │   Panels,   │  │  (State)  │  │   Export)       │  │   │
│  │  │   Modals)   │  └────┬─────┘  └────────────────┘  │   │
│  │  └─────────────┘       │                             │   │
│  │                        │                             │   │
│  │  ┌─────────────────────▼─────────────────────────┐   │   │
│  │  │         React Three Fiber (R3F) Layer         │   │   │
│  │  │                                               │   │   │
│  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │   │   │
│  │  │  │View1│ │View2│ │View3│ │View4│ │View5│   │   │   │
│  │  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │   │   │
│  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │   │   │
│  │  │  │View6│ │View7│ │View8│ │View9│           │   │   │
│  │  │  └─────┘ └─────┘ └─────┘ └─────┘           │   │   │
│  │  │                                               │   │   │
│  │  │  Single <Canvas> + Drei <View> components     │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │               Web Worker Thread(s)                   │   │
│  │                                                      │   │
│  │  ┌──────────────┐  ┌─────────────────────────────┐   │   │
│  │  │ manifold3d   │  │  Point Cloud Filter Engine  │   │   │
│  │  │ (WASM CSG)   │  │  (BVH spatial indexing)     │   │   │
│  │  └──────────────┘  └─────────────────────────────┘   │   │
│  │                                                      │   │
│  │  Communication: Comlink (typed RPC over postMessage) │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | React | 19.x | UI components, lifecycle |
| **Bundler** | Vite | 6.x | Fast dev server, HMR, build |
| **3D Engine** | Three.js | 0.170+ | WebGL rendering |
| **3D React Bindings** | React Three Fiber | 9.x | Declarative Three.js in React |
| **3D Helpers** | @react-three/drei | 9.x | `<View>`, `TransformControls`, etc. |
| **State** | Zustand | 5.x | Global reactive state |
| **CSG (Mesh)** | manifold3d | latest | WASM boolean operations |
| **Spatial Index** | three-mesh-bvh | latest | BVH for point cloud filtering |
| **Worker Comms** | Comlink | 4.x | Typed RPC over `postMessage` |
| **Triangulation** | earcut | latest | 2D polygon triangulation (lasso) |
| **Styling** | TailwindCSS | 4.x | Utility-first CSS |
| **Hosting** | Vercel | — | Free static SPA hosting |

---

## 4. Multi-Viewport System

### 4.1 Layout

The UI presents a **3×3 grid** of viewports. Each viewport renders the same geometry from a different camera angle.

```
┌───────────┬───────────┬───────────┐
│  Top      │  Front    │  Right    │
│  (Ortho)  │  (Ortho)  │  (Ortho)  │
├───────────┼───────────┼───────────┤
│  Bottom   │  Back     │  Left     │
│  (Ortho)  │  (Ortho)  │  (Ortho)  │
├───────────┼───────────┼───────────┤
│  Iso 1    │  Iso 2    │  Iso 3    │
│  (Persp)  │  (Persp)  │  (Persp)  │
└───────────┴───────────┴───────────┘
```

### 4.2 Default Camera Positions

| View | Type | Camera Position | Look At |
|---|---|---|---|
| Top | Orthographic | `(0, +D, 0)` | `(0, 0, 0)` |
| Front | Orthographic | `(0, 0, +D)` | `(0, 0, 0)` |
| Right | Orthographic | `(+D, 0, 0)` | `(0, 0, 0)` |
| Bottom | Orthographic | `(0, -D, 0)` | `(0, 0, 0)` |
| Back | Orthographic | `(0, 0, -D)` | `(0, 0, 0)` |
| Left | Orthographic | `(-D, 0, 0)` | `(0, 0, 0)` |
| Iso 1 | Perspective | `(+D, +D, +D)` | `(0, 0, 0)` |
| Iso 2 | Perspective | `(-D, +D, +D)` | `(0, 0, 0)` |
| Iso 3 | Perspective | `(+D, +D, -D)` | `(0, 0, 0)` |

> `D` = auto-calculated based on model bounding sphere radius.

### 4.3 Active View Behavior

- **Any viewport is selectable** by clicking on it.
- The **active viewport** is highlighted with a colored border (e.g., cyan glow).
- **Slicing tools** operate in the active viewport. The cut is defined in the active view's coordinate plane.
- **All other viewports** instantly reflect the cut result (geometry update via Zustand).
- **Active view** renders at full resolution. Inactive views may use reduced sampling for performance.

### 4.4 Implementation Strategy

All 9 viewports share a **single `<Canvas>`** element. Each viewport is a Drei `<View>` component that renders into a specific DOM container via `ref`.

```jsx
// Simplified structure
<div className="grid grid-cols-3 grid-rows-3 h-screen">
  {views.map((view, i) => (
    <div
      key={i}
      ref={viewRefs[i]}
      className={activeView === i ? 'ring-2 ring-cyan-400' : ''}
      onClick={() => setActiveView(i)}
    />
  ))}
</div>

<Canvas>
  {views.map((view, i) => (
    <View key={i} track={viewRefs[i]}>
      <ViewCamera config={view.camera} />
      <ModelGeometry />
      <CuttingToolOverlay />
      <ClippingPlanePreview />
    </View>
  ))}
</Canvas>
```

---

## 5. Cutting Tools

### 5.1 Tool Overview

| Tool | Icon | Description | Mesh Support | Point Cloud Support |
|---|---|---|---|---|
| **Box Cut** | ⬜ | Rectangular negative-space primitive | ✅ CSG subtract | ✅ AABB filter |
| **Sphere Cut** | ⚪ | Spherical negative-space primitive | ✅ CSG subtract | ✅ Distance filter |
| **Cylinder Cut** | 🔵 | Cylindrical negative-space primitive | ✅ CSG subtract | ✅ Radius+height filter |
| **Plane Cut** | ✂️ | Infinite planar cut | ✅ CSG subtract | ✅ Half-space filter |
| **Knife** | 🔪 | Point-to-point polyline, extruded | ✅ CSG subtract | ✅ Projected polygon filter |
| **Lasso** | ➰ | Freeform closed curve, extruded | ✅ CSG subtract | ✅ Projected polygon filter |

### 5.2 Tool Interaction Flow

```
User selects tool → Places/draws in ACTIVE viewport
                          │
                          ▼
              Clipping Planes applied (instant visual preview)
                          │
                          ▼
              User adjusts position/shape (TransformControls)
                          │
                          ▼
              User clicks "Slice!" button
                          │
                          ▼
              Geometry + Tool shape sent to Web Worker
                          │
                    ┌─────┴─────┐
                    │           │
                 Mesh?      PointCloud?
                    │           │
              manifold3d    BVH Filter
              CSG subtract  point removal
                    │           │
                    └─────┬─────┘
                          │
                          ▼
              New geometry returned to main thread
                          │
                          ▼
              Zustand store updated → All 9 views re-render
```

### 5.3 Knife Tool (Point-to-Point)

1. User clicks sequential points on the model surface in the active view.
2. Points are projected onto the view's camera plane.
3. A polyline is formed. On double-click or "Close" button, the polyline closes.
4. The 2D polygon is triangulated via `earcut`.
5. The polygon is extruded along the active view's camera direction (orthographic depth).
6. The resulting 3D volume is used as the CSG subtraction operand.

> **v1 Constraint**: Knife tool is restricted to **orthographic views only** to avoid projection ambiguity.

### 5.4 Lasso Tool

1. User clicks and drags to draw a freeform closed curve.
2. The curve is sampled into discrete points (e.g., every 3px of mouse movement).
3. Same extrusion pipeline as knife tool (step 4–6 above).

### 5.5 Negative Space Primitives (Box, Sphere, Cylinder)

1. User selects the primitive type from the toolbar.
2. A semi-transparent preview shape appears at the model's center.
3. User positions/scales/rotates using `TransformControls` (Drei).
4. Real-time clipping planes visualize the cut.
5. "Slice!" commits the operation.

### 5.6 Clipping Plane Preview System

Before committing a cut, clipping planes provide instant visual feedback:

```javascript
// Pseudocode: Attach clipping planes to the cutting tool's faces
const clippingPlanes = computeClippingPlanes(cuttingTool);
modelMaterial.clippingPlanes = clippingPlanes;
modelMaterial.clipIntersection = true; // Show intersection of all planes
renderer.localClippingEnabled = true;
```

This is **GPU-accelerated** and adds zero overhead to the geometry pipeline.

---

## 6. State Management (Zustand)

### 6.1 Store Shape

```typescript
interface SliceItStore {
  // === Model State ===
  model: {
    geometry: THREE.BufferGeometry | null;
    type: 'mesh' | 'pointcloud' | null;
    filename: string;
    fileSize: number;
    boundingSphere: THREE.Sphere | null;
  };

  // === Viewport State ===
  activeViewIndex: number;  // 0-8
  viewConfigs: ViewConfig[];  // Camera positions, types, labels

  // === Tool State ===
  activeTool: 'box' | 'sphere' | 'cylinder' | 'plane' | 'knife' | 'lasso' | null;
  toolTransform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  knifePoints: [number, number, number][];  // For knife/lasso tools
  isDrawing: boolean;

  // === Operation State ===
  isSlicing: boolean;        // True while Web Worker is processing
  sliceProgress: number;     // 0-100
  undoStack: THREE.BufferGeometry[];  // Previous geometries for undo
  redoStack: THREE.BufferGeometry[];

  // === UI State ===
  showImportModal: boolean;
  showExportModal: boolean;
  showSettings: boolean;

  // === Actions ===
  importModel: (file: File) => Promise<void>;
  exportModel: (format: string) => void;
  setActiveTool: (tool: string | null) => void;
  setActiveView: (index: number) => void;
  updateToolTransform: (transform: Partial<ToolTransform>) => void;
  addKnifePoint: (point: [number, number, number]) => void;
  executeSlice: () => Promise<void>;
  undo: () => void;
  redo: () => void;
}
```

### 6.2 State Flow

```
User Interaction
      │
      ▼
  Zustand Action (e.g., setActiveTool('box'))
      │
      ▼
  Store Updated (immutable state transition)
      │
      ▼
  React re-renders ONLY subscribed components
      │
      ├──► Toolbar highlights active tool
      ├──► Active View shows TransformControls
      └──► All Views render cutting tool preview
```

---

## 7. Web Worker Architecture

### 7.1 Worker Structure

```
src/
  workers/
    slicing.worker.ts      ← Main slicing worker
    slicing.api.ts         ← Comlink-wrapped API
```

### 7.2 Worker API (via Comlink)

```typescript
// slicing.api.ts
export interface SlicingWorkerAPI {
  // Initialize manifold3d WASM
  init(): Promise<void>;

  // Mesh CSG operations
  subtractMesh(
    modelVertices: Float32Array,
    modelIndices: Uint32Array,
    toolVertices: Float32Array,
    toolIndices: Uint32Array
  ): Promise<{ vertices: Float32Array; indices: Uint32Array }>;

  // Point cloud filtering
  filterPointCloud(
    points: Float32Array,        // [x,y,z, x,y,z, ...]
    toolType: 'box' | 'sphere' | 'cylinder' | 'polygon',
    toolParams: ToolParams
  ): Promise<Float32Array>;
}
```

### 7.3 Data Transfer

- Use **Transferable Objects** (`ArrayBuffer`) to avoid copying large geometry arrays between main thread and worker.
- For `SharedArrayBuffer` (zero-copy): requires `Cross-Origin-Isolation` headers:
  ```
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```

---

## 8. File I/O

### 8.1 Import

| Format | Extension | Loader | Data Type |
|---|---|---|---|
| STL (Binary/ASCII) | `.stl` | `THREE.STLLoader` | Mesh |
| Wavefront OBJ | `.obj` | `THREE.OBJLoader` | Mesh |
| glTF / GLB | `.gltf`, `.glb` | `THREE.GLTFLoader` | Mesh |
| PLY | `.ply` | `THREE.PLYLoader` | Mesh or Point Cloud |
| 3MF | `.3mf` | `THREE.3MFLoader` | Mesh |
| XYZ | `.xyz` | Custom parser | Point Cloud |

### 8.2 Export

| Format | Extension | Exporter |
|---|---|---|
| STL (Binary) | `.stl` | `THREE.STLExporter` |
| PLY | `.ply` | `THREE.PLYExporter` |
| OBJ | `.obj` | `THREE.OBJExporter` |
| glTF / GLB | `.gltf`, `.glb` | `THREE.GLTFExporter` |

### 8.3 Import Flow

```
File Drop / File Picker
      │
      ▼
  Detect format by extension
      │
      ▼
  Instantiate appropriate Three.js Loader
      │
      ▼
  Parse → BufferGeometry
      │
      ▼
  Detect type: mesh (has index) vs point cloud (vertices only)
      │
      ▼
  Center geometry at origin
      │
      ▼
  Compute bounding sphere → set camera distances
      │
      ▼
  Update Zustand store → All 9 views render the model
```

---

## 9. Performance Considerations

### 9.1 Rendering Optimization

| Strategy | Implementation |
|---|---|
| **Single Canvas** | All 9 views share one WebGL context (Drei `<View>`) |
| **Active View Priority** | Active view: full resolution. Inactive views: optional LOD reduction. |
| **Frustum Culling** | Enabled by default in Three.js |
| **Instanced Rendering** | For point clouds, use `THREE.Points` with `PointsMaterial` |
| **Buffer Reuse** | Recycle `BufferGeometry` objects instead of creating new ones |

### 9.2 Memory Management

| Concern | Mitigation |
|---|---|
| **Large File Upload** | Warn user if file > 100MB. Hard limit at 500MB. |
| **Undo Stack** | Store max 10 undo states. Dispose old geometries via `.dispose()`. |
| **Worker Data Transfer** | Use `Transferable` objects to transfer ownership without copying. |
| **Geometry Disposal** | Always call `.dispose()` on replaced geometries to free GPU memory. |

### 9.3 Benchmarks (Target)

| Operation | Target | Notes |
|---|---|---|
| File load (50MB STL) | < 3s | Async parsing |
| Clipping preview | 60fps | GPU-based, zero geometry mutation |
| Box CSG (100k tri mesh) | < 2s | manifold3d WASM in Worker |
| Point cloud filter (1M points) | < 500ms | BVH spatial index |
| View re-render (all 9) | < 16ms | Single canvas, shared geometry |

---

## 10. Error Handling

| Scenario | Response |
|---|---|
| **Unsupported file format** | Toast notification with supported formats list |
| **Non-manifold geometry** | Warning + attempt repair via manifold3d |
| **File too large** | Modal warning with file size and recommendation |
| **CSG failure** | Graceful fallback toast: "Cut failed — try simplifying the cutting shape" |
| **WebGL context lost** | Auto-recovery with `renderer.forceContextRestore()` |
| **Worker crash** | Respawn worker, restore geometry from undo stack |
| **Browser doesn't support WASM** | Landing page warning with browser upgrade link |

---

## 11. Accessibility & UX

- **Keyboard shortcuts**: `Ctrl+Z` (undo), `Ctrl+Y` (redo), `Delete` (remove tool), `1-9` (select view)
- **Touch support**: Pinch-to-zoom, two-finger rotate in perspective views
- **Dark mode**: Default. Light mode toggle available.
- **Loading states**: Skeleton UI + progress bar during file import and slicing operations
- **Tooltips**: On all toolbar buttons with keyboard shortcut hints

---

## 12. Security

| Concern | Mitigation |
|---|---|
| **File upload** | Client-side only. No files leave the browser. |
| **WASM execution** | Sandboxed in browser. No filesystem access. |
| **XSS** | React's built-in escaping. No `dangerouslySetInnerHTML`. |
| **CORS** | Only relevant for loading external WASM modules (served from same origin). |

---

## 13. Future Considerations (Post-v1)

- **Custom polygon extrusion cuts** (drawn in 2D, extruded to 3D)
- **Multi-object scenes** (individual object selection)
- **Measurement tools** (distance, angle, volume)
- **Cross-section views** (visualize internal structure)
- **Collaborative editing** (WebRTC-based shared state)
- **Progressive loading** (stream large files incrementally)
- **GPU-accelerated CSG** (WebGPU compute shaders when available)
