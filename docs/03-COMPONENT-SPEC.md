# Slice It! — Component Specification

> **Version**: 1.0.0  
> **Last Updated**: 2026-03-23  

---

## Component Tree

```
App
├── Header
│   ├── Logo
│   ├── Toolbar
│   │   ├── ImportButton
│   │   ├── ExportButton
│   │   ├── ToolSeparator
│   │   ├── ToolButton (Box)
│   │   ├── ToolButton (Sphere)
│   │   ├── ToolButton (Cylinder)
│   │   ├── ToolButton (Plane)
│   │   ├── ToolButton (Knife)
│   │   ├── ToolButton (Lasso)
│   │   ├── ToolSeparator
│   │   ├── TransformModeToggle (Translate/Rotate/Scale)
│   │   ├── ToolSeparator
│   │   ├── SliceButton ("Slice!")
│   │   ├── UndoButton
│   │   └── RedoButton
│   └── SettingsButton
│
├── MainContent
│   ├── ViewportGrid (3×3)
│   │   ├── ViewportPanel[0] (Top)
│   │   ├── ViewportPanel[1] (Front)
│   │   ├── ViewportPanel[2] (Right)
│   │   ├── ViewportPanel[3] (Bottom)
│   │   ├── ViewportPanel[4] (Back)
│   │   ├── ViewportPanel[5] (Left)
│   │   ├── ViewportPanel[6] (Iso 1)
│   │   ├── ViewportPanel[7] (Iso 2)
│   │   └── ViewportPanel[8] (Iso 3)
│   │
│   └── SceneCanvas (single <Canvas>)
│       ├── View[0..8]
│       │   ├── ViewCamera
│       │   ├── ViewHelpers (grid, axes)
│       │   ├── ModelRenderer
│       │   ├── CuttingToolRenderer
│       │   │   ├── BoxCutter
│       │   │   ├── SphereCutter
│       │   │   ├── CylinderCutter
│       │   │   └── PlaneCutter
│       │   ├── TransformControls (active view only)
│       │   └── ClippingPlanePreview
│       └── DrawingCanvas (2D overlay, active view only)
│           ├── KnifeTool
│           └── LassoTool
│
├── StatusBar
│   ├── ModelInfo (filename, vertex count, type)
│   ├── ActiveViewLabel
│   ├── ToolInfo
│   └── SliceProgress
│
├── FileDropZone (full-screen overlay on drag)
├── ImportModal
├── ExportModal
├── SettingsModal
├── ToastContainer
│   └── Toast[]
└── EmptyState (shown when no model loaded)
```

---

## Component Specifications

### App (`src/App.tsx`)

Root component. Manages top-level layout and modals.

```typescript
// No props — reads all state from Zustand
const App: React.FC = () => {
  const hasModel = useStore(s => s.model.geometry !== null);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      <Header />
      {hasModel ? (
        <>
          <MainContent />
          <StatusBar />
        </>
      ) : (
        <EmptyState />
      )}
      <FileDropZone />
      <ImportModal />
      <ExportModal />
      <ToastContainer />
    </div>
  );
};
```

---

### ViewportGrid (`src/components/ViewportGrid.tsx`)

Renders the 3×3 grid of viewport containers.

**Props**: None (reads from store)

**Key Behaviors**:
- Responsive: 3×3 on desktop, 2×2 on tablet (hide bottom 5), stack on mobile (1 view)
- Each cell is a `ViewportPanel`
- Forwards `ref` for each cell to `SceneCanvas` for Drei `<View>` tracking

```typescript
interface ViewportGridProps {}

const ViewportGrid: React.FC = () => {
  const viewRefs = useRef<(HTMLDivElement | null)[]>(Array(9).fill(null));
  const activeView = useStore(s => s.activeViewIndex);
  const setActiveView = useStore(s => s.setActiveView);

  return (
    <div className="grid grid-cols-3 grid-rows-3 flex-1 gap-0.5 bg-gray-900 p-0.5">
      {VIEW_CONFIGS.map((config, i) => (
        <ViewportPanel
          key={i}
          ref={el => (viewRefs.current[i] = el)}
          config={config}
          isActive={activeView === i}
          onClick={() => setActiveView(i)}
        />
      ))}
    </div>
  );
};
```

---

### ViewportPanel (`src/components/ViewportPanel.tsx`)

Individual viewport container with label and active indicator.

**Props**:

```typescript
interface ViewportPanelProps {
  config: ViewConfig;
  isActive: boolean;
  onClick: () => void;
}
```

**Key Behaviors**:
- Click to select as active
- Active state: cyan glow border (`ring-2 ring-cyan-400 shadow-lg shadow-cyan-400/20`)
- Label overlay in top-left corner (e.g., "Top", "Front", "Iso 1")
- Camera type icon in top-right corner (ortho/perspective icon)

---

### SceneCanvas (`src/components/SceneCanvas.tsx`)

Single Three.js `<Canvas>` that contains all 9 `<View>` components.

**Critical Implementation Notes**:
- Only ONE `<Canvas>` element exists in the entire app
- Each `<View>` references a `ViewportPanel` div via `track` prop
- The canvas is positioned absolutely behind the viewport grid

```typescript
const SceneCanvas: React.FC = () => {
  return (
    <Canvas
      className="!fixed inset-0 pointer-events-none"
      gl={{ localClippingEnabled: true }}
      frameloop="demand"  // Only render when state changes
    >
      {VIEW_CONFIGS.map((config, i) => (
        <View key={i} track={viewRefs[i]}>
          <ViewScene viewIndex={i} config={config} />
        </View>
      ))}
    </Canvas>
  );
};
```

---

### ModelRenderer (`src/components/ModelRenderer.tsx`)

Renders the loaded model (mesh or point cloud) with clipping planes applied.

**Props**:

```typescript
interface ModelRendererProps {
  clippingPlanes?: THREE.Plane[];
}
```

**Key Behaviors**:
- **Mesh**: Renders with `MeshStandardMaterial` (gray base, slightly reflective)
- **Point Cloud**: Renders with `THREE.Points` + `PointsMaterial`
- Applies clipping planes from the active cutting tool
- Material is shared across all 9 views (instanced reference)

---

### CuttingTool Components

Each cutting tool renders as a semi-transparent shape in the scene.

**Shared Material Properties**:
```typescript
const CUTTER_MATERIAL = {
  color: '#ff4444',
  transparent: true,
  opacity: 0.25,
  wireframe: false,
  side: THREE.DoubleSide,
  depthWrite: false,
};

const CUTTER_WIREFRAME = {
  color: '#ff6666',
  wireframe: true,
  transparent: true,
  opacity: 0.6,
};
```

**BoxCutter** (`src/components/tools/BoxCutter.tsx`)
- Renders `<boxGeometry>` with two materials (transparent fill + wireframe overlay)
- Default size: 1×1×1 (user scales via TransformControls)

**SphereCutter** (`src/components/tools/SphereCutter.tsx`)
- Renders `<sphereGeometry>` with 32×32 segments
- Default radius: 0.5

**CylinderCutter** (`src/components/tools/CylinderCutter.tsx`)
- Renders `<cylinderGeometry>` with 32 radial segments
- Default: radius 0.5, height 1.0

**PlaneCutter** (`src/components/tools/PlaneCutter.tsx`)
- Renders a large `<planeGeometry>` (visually) with an arrow indicating the cut direction
- Actually defines a single `THREE.Plane`

---

### DrawingCanvas (`src/components/tools/DrawingCanvas.tsx`)

2D HTML canvas overlay for knife and lasso tools. Only visible on the active viewport.

**Key Behaviors**:
- Positioned absolutely over the active viewport panel
- Captures mouse events (click, drag, mousemove)
- Draws polyline/curve in real-time
- Converts screen coordinates to normalized viewport coordinates

**Knife Mode**:
- Click to add vertices
- Double-click to close the polygon
- Visual: solid lines between vertices, vertex dots

**Lasso Mode**:
- Mousedown to start, mousemove to draw, mouseup to close
- Samples points every 3px of movement
- Visual: dashed line during draw, solid line when closed

---

### Toolbar (`src/components/Toolbar.tsx`)

Horizontal toolbar in the header.

**Tool Button Specs**:

| Button | Icon | Shortcut | Behavior |
|---|---|---|---|
| Import | 📂 | `Ctrl+O` | Opens file picker |
| Export | 💾 | `Ctrl+S` | Opens export modal |
| Box Cut | ⬜ | `B` | Activates box cutter |
| Sphere Cut | ⚪ | `S` | Activates sphere cutter |
| Cylinder Cut | 🔵 | `C` | Activates cylinder cutter |
| Plane Cut | ✂️ | `P` | Activates plane cutter |
| Knife | 🔪 | `K` | Activates knife tool |
| Lasso | ➰ | `L` | Activates lasso tool |
| Translate | ↔️ | `G` | Transform mode: translate |
| Rotate | 🔄 | `R` | Transform mode: rotate |
| Scale | ↕️ | `T` | Transform mode: scale |
| Slice! | ✅ | `Enter` | Executes the slice |
| Undo | ↩️ | `Ctrl+Z` | Undo last slice |
| Redo | ↪️ | `Ctrl+Y` | Redo last undo |

---

### StatusBar (`src/components/StatusBar.tsx`)

Bottom bar with contextual information.

**Display Fields**:
- **Model Info**: `filename.stl | 125,430 vertices | 41,810 faces | Mesh`
- **Active View**: `Active: Top (Orthographic)`
- **Tool**: `Tool: Box Cutter | Mode: Translate`
- **Slice Progress**: `Slicing... 45%` (visible only during operations)

---

### Toast System (`src/components/Toast.tsx`)

Toast notifications for user feedback.

**Toast Types**:
- ✅ **Success**: "Slice completed successfully"
- ❌ **Error**: "CSG operation failed — try simplifying the cutting shape"
- ⚠️ **Warning**: "File is 150MB — performance may be degraded"
- ℹ️ **Info**: "Model loaded: 125,430 vertices"

**Behavior**:
- Stack in bottom-right corner
- Auto-dismiss after 5 seconds
- Dismissible on click
- Max 3 visible at once

---

### EmptyState (`src/components/EmptyState.tsx`)

Shown when no model is loaded. Full-screen centered UI.

**Content**:
- Large "Slice It!" logo/title
- Animated dotted border drop zone
- "Drop a 3D file here or click to browse"
- Supported formats list: `.stl .obj .gltf .glb .ply .3mf .xyz`
- Optional: animated 3D preview of the app in action

---

## File Structure

```
src/
├── App.tsx                           # Root component
├── main.tsx                          # Entry point
├── index.css                         # Global styles + Tailwind imports
│
├── components/
│   ├── Header.tsx                    # Top bar with logo + toolbar
│   ├── Toolbar.tsx                   # Tool buttons
│   ├── ToolButton.tsx                # Individual toolbar button
│   ├── ViewportGrid.tsx              # 3×3 grid container
│   ├── ViewportPanel.tsx             # Single viewport cell
│   ├── SceneCanvas.tsx               # Single <Canvas> with 9 <View>s
│   ├── ViewScene.tsx                 # Scene content per view
│   ├── ViewCamera.tsx                # Camera component (ortho/persp)
│   ├── ViewHelpers.tsx               # Grid, axes helpers
│   ├── ModelRenderer.tsx             # Renders the 3D model
│   ├── StatusBar.tsx                 # Bottom info bar
│   ├── FileDropZone.tsx              # Drag-and-drop overlay
│   ├── EmptyState.tsx                # No-model-loaded UI
│   ├── Toast.tsx                     # Individual toast
│   ├── ToastContainer.tsx            # Toast stack manager
│   ├── ImportModal.tsx               # File import progress
│   ├── ExportModal.tsx               # Export format selector
│   ├── SettingsModal.tsx             # App settings
│   ├── LoadingOverlay.tsx            # Full-screen loading state
│   │
│   └── tools/
│       ├── CuttingTool.tsx           # Shared cutting tool logic
│       ├── BoxCutter.tsx             # Box primitive
│       ├── SphereCutter.tsx          # Sphere primitive
│       ├── CylinderCutter.tsx        # Cylinder primitive
│       ├── PlaneCutter.tsx           # Plane cut
│       ├── DrawingCanvas.tsx         # 2D overlay for knife/lasso
│       ├── KnifeTool.tsx             # Point-to-point knife
│       └── LassoTool.tsx             # Freeform lasso
│
├── store/
│   └── useStore.ts                   # Zustand store
│
├── hooks/
│   ├── useClippingPlanes.ts          # Compute clipping planes from tool
│   ├── useKeyboardShortcuts.ts       # Keyboard shortcut handler
│   ├── useFileDrop.ts                # Drag-and-drop logic
│   └── useModelLoader.ts            # File loading orchestration
│
├── workers/
│   ├── slicing.worker.ts            # Web Worker: CSG + point cloud ops
│   └── slicing.api.ts               # Comlink-wrapped worker API
│
├── loaders/
│   ├── loaderFactory.ts             # Format → Loader routing
│   ├── stlLoader.ts                 # STL wrapper
│   ├── objLoader.ts                 # OBJ wrapper
│   ├── gltfLoader.ts                # glTF/GLB wrapper
│   ├── plyLoader.ts                 # PLY wrapper
│   ├── threemfLoader.ts             # 3MF wrapper
│   └── xyzLoader.ts                 # XYZ custom parser
│
├── exporters/
│   ├── exporterFactory.ts           # Format → Exporter routing
│   ├── stlExporter.ts               # STL export
│   ├── plyExporter.ts               # PLY export
│   ├── objExporter.ts               # OBJ export
│   └── gltfExporter.ts              # glTF/GLB export
│
├── utils/
│   ├── cameraUtils.ts               # Camera auto-fit, bounding sphere
│   ├── geometryUtils.ts             # Center, normalize, detect type
│   ├── fileUtils.ts                 # Format detection, size validation
│   ├── extrusionUtils.ts            # 2D polygon → 3D extrusion
│   ├── workerGeometry.ts            # Geometry serialization for workers
│   ├── pointCloudBVH.ts             # BVH spatial index for point clouds
│   └── errorHandling.ts             # Error formatting, toast helpers
│
├── config/
│   ├── viewConfigs.ts               # Camera configs for all 9 views
│   ├── constants.ts                 # MAX_FILE_SIZE, MAX_UNDO_STATES, etc.
│   └── theme.ts                     # Color tokens, material presets
│
└── types/
    ├── store.ts                     # Store type definitions
    ├── tools.ts                     # Tool type definitions
    ├── views.ts                     # View/camera type definitions
    └── geometry.ts                  # Geometry type definitions
```
