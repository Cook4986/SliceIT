# Slice It! — State Management Specification

> **Version**: 1.0.0  
> **Last Updated**: 2026-03-23  

---

## Overview

All application state lives in a single **Zustand** store. The store is the single source of truth — every component reads from the store, and every user action dispatches a store action. This ensures that all 9 viewports, the toolbar, and the status bar stay perfectly synchronized.

---

## Store Definition

```typescript
// src/types/store.ts

import * as THREE from 'three';

// ============================================================
// Enum Types
// ============================================================

export type ModelType = 'mesh' | 'pointcloud';

export type ToolType = 'box' | 'sphere' | 'cylinder' | 'plane' | 'knife' | 'lasso';

export type TransformMode = 'translate' | 'rotate' | 'scale';

export type ExportFormat = 'stl' | 'ply' | 'obj' | 'gltf' | 'glb';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

// ============================================================
// Model State
// ============================================================

export interface ModelState {
  /** The loaded BufferGeometry (mesh or point cloud) */
  geometry: THREE.BufferGeometry | null;

  /** Whether this is a mesh or point cloud */
  type: ModelType | null;

  /** Original filename */
  filename: string;

  /** Original file size in bytes */
  fileSize: number;

  /** Computed bounding sphere for camera fitting */
  boundingSphere: THREE.Sphere | null;

  /** Number of vertices */
  vertexCount: number;

  /** Number of faces (0 for point clouds) */
  faceCount: number;
}

// ============================================================
// Tool State
// ============================================================

export interface ToolTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface ToolState {
  /** Currently active cutting tool (null = no tool) */
  activeTool: ToolType | null;

  /** Transform of the active cutting tool */
  transform: ToolTransform;

  /** Current transform mode for TransformControls */
  transformMode: TransformMode;

  /** Points for knife/lasso tools (screen-space) */
  drawingPoints: [number, number][];

  /** Whether the user is currently drawing (knife/lasso) */
  isDrawing: boolean;

  /** Whether the drawing is complete (closed polygon) */
  isDrawingComplete: boolean;
}

// ============================================================
// View State
// ============================================================

export interface ViewConfig {
  /** Display label (e.g., "Top", "Front", "Iso 1") */
  label: string;

  /** Camera type */
  cameraType: 'orthographic' | 'perspective';

  /** Initial camera position */
  position: [number, number, number];

  /** Camera up vector */
  up: [number, number, number];

  /** Whether OrbitControls are enabled */
  orbitEnabled: boolean;
}

// ============================================================
// Operation State
// ============================================================

export interface OperationState {
  /** True while a slice operation is in progress */
  isSlicing: boolean;

  /** Progress percentage (0-100) */
  progress: number;

  /** Status text displayed during operation */
  statusText: string;
}

// ============================================================
// History State (Undo/Redo)
// ============================================================

export interface HistoryEntry {
  /** Serialized geometry data (positions + indices) */
  positions: Float32Array;
  indices: Uint32Array | null;
  type: ModelType;
}

// ============================================================
// Toast State
// ============================================================

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  timestamp: number;
}

// ============================================================
// UI State
// ============================================================

export interface UIState {
  showImportModal: boolean;
  showExportModal: boolean;
  showSettings: boolean;
}

// ============================================================
// Complete Store Interface
// ============================================================

export interface SliceItStore {
  // --- State Slices ---
  model: ModelState;
  tool: ToolState;
  activeViewIndex: number;
  viewConfigs: ViewConfig[];
  operation: OperationState;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  toasts: ToastMessage[];
  ui: UIState;

  // --- Model Actions ---
  importModel: (file: File) => Promise<void>;
  exportModel: (format: ExportFormat) => void;
  clearModel: () => void;

  // --- View Actions ---
  setActiveView: (index: number) => void;

  // --- Tool Actions ---
  setActiveTool: (tool: ToolType | null) => void;
  setTransformMode: (mode: TransformMode) => void;
  updateToolTransform: (transform: Partial<ToolTransform>) => void;
  addDrawingPoint: (point: [number, number]) => void;
  completeDrawing: () => void;
  cancelDrawing: () => void;

  // --- Slice Actions ---
  executeSlice: () => Promise<void>;

  // --- History Actions ---
  undo: () => void;
  redo: () => void;

  // --- Toast Actions ---
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;

  // --- UI Actions ---
  setUIState: (state: Partial<UIState>) => void;
}
```

---

## Store Implementation

```typescript
// src/store/useStore.ts

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import * as THREE from 'three';
import { wrap } from 'comlink';
import type { SliceItStore, HistoryEntry, ToolType, TransformMode } from '../types/store';
import { VIEW_CONFIGS, DEFAULT_TOOL_TRANSFORM } from '../config/viewConfigs';
import { MAX_UNDO_STATES, MAX_TOASTS } from '../config/constants';
import { loadModelFile } from '../loaders/loaderFactory';
import { detectModelType, centerGeometry } from '../utils/geometryUtils';
import { serializeGeometry } from '../utils/workerGeometry';
import { exportGeometry } from '../exporters/exporterFactory';

// Lazy-initialize the slicing worker
let slicingWorker: Worker | null = null;
let slicingAPI: any = null;

function getSlicingAPI() {
  if (!slicingWorker) {
    slicingWorker = new Worker(
      new URL('../workers/slicing.worker.ts', import.meta.url),
      { type: 'module' }
    );
    slicingAPI = wrap(slicingWorker);
  }
  return slicingAPI;
}

// ============================================================
// Store Creation
// ============================================================

export const useStore = create<SliceItStore>()(
  subscribeWithSelector((set, get) => ({
    // === Initial State ===

    model: {
      geometry: null,
      type: null,
      filename: '',
      fileSize: 0,
      boundingSphere: null,
      vertexCount: 0,
      faceCount: 0,
    },

    tool: {
      activeTool: null,
      transform: { ...DEFAULT_TOOL_TRANSFORM },
      transformMode: 'translate',
      drawingPoints: [],
      isDrawing: false,
      isDrawingComplete: false,
    },

    activeViewIndex: 0,
    viewConfigs: VIEW_CONFIGS,

    operation: {
      isSlicing: false,
      progress: 0,
      statusText: '',
    },

    undoStack: [],
    redoStack: [],
    toasts: [],

    ui: {
      showImportModal: false,
      showExportModal: false,
      showSettings: false,
    },

    // === Model Actions ===

    importModel: async (file: File) => {
      try {
        set(state => ({
          operation: { ...state.operation, isSlicing: true, statusText: 'Loading...' },
        }));

        const geometry = await loadModelFile(file);
        const type = detectModelType(geometry);
        centerGeometry(geometry);
        geometry.computeBoundingSphere();

        const vertexCount = geometry.attributes.position.count;
        const faceCount = geometry.index ? geometry.index.count / 3 : 0;

        set({
          model: {
            geometry,
            type,
            filename: file.name,
            fileSize: file.size,
            boundingSphere: geometry.boundingSphere,
            vertexCount,
            faceCount,
          },
          tool: {
            activeTool: null,
            transform: { ...DEFAULT_TOOL_TRANSFORM },
            transformMode: 'translate',
            drawingPoints: [],
            isDrawing: false,
            isDrawingComplete: false,
          },
          undoStack: [],
          redoStack: [],
          operation: { isSlicing: false, progress: 100, statusText: '' },
        });

        get().addToast('success', `Loaded ${file.name} (${vertexCount.toLocaleString()} vertices)`);
      } catch (error: any) {
        set({ operation: { isSlicing: false, progress: 0, statusText: '' } });
        get().addToast('error', `Failed to load file: ${error.message}`);
      }
    },

    exportModel: (format) => {
      const { geometry, filename } = get().model;
      if (!geometry) return;
      try {
        exportGeometry(geometry, format, filename);
        get().addToast('success', `Exported as ${format.toUpperCase()}`);
      } catch (error: any) {
        get().addToast('error', `Export failed: ${error.message}`);
      }
    },

    clearModel: () => {
      const { geometry } = get().model;
      if (geometry) geometry.dispose();

      // Dispose undo/redo stacks
      get().undoStack.forEach(entry => {
        // Entries store raw arrays, nothing to dispose
      });

      set({
        model: {
          geometry: null, type: null, filename: '',
          fileSize: 0, boundingSphere: null, vertexCount: 0, faceCount: 0,
        },
        undoStack: [],
        redoStack: [],
        tool: {
          activeTool: null,
          transform: { ...DEFAULT_TOOL_TRANSFORM },
          transformMode: 'translate',
          drawingPoints: [],
          isDrawing: false,
          isDrawingComplete: false,
        },
      });
    },

    // === View Actions ===

    setActiveView: (index: number) => {
      set({ activeViewIndex: index });
    },

    // === Tool Actions ===

    setActiveTool: (tool: ToolType | null) => {
      set(state => ({
        tool: {
          ...state.tool,
          activeTool: tool,
          drawingPoints: [],
          isDrawing: tool === 'knife' || tool === 'lasso',
          isDrawingComplete: false,
          transform: { ...DEFAULT_TOOL_TRANSFORM },
        },
      }));
    },

    setTransformMode: (mode: TransformMode) => {
      set(state => ({
        tool: { ...state.tool, transformMode: mode },
      }));
    },

    updateToolTransform: (transform) => {
      set(state => ({
        tool: {
          ...state.tool,
          transform: { ...state.tool.transform, ...transform },
        },
      }));
    },

    addDrawingPoint: (point) => {
      set(state => ({
        tool: {
          ...state.tool,
          drawingPoints: [...state.tool.drawingPoints, point],
        },
      }));
    },

    completeDrawing: () => {
      set(state => ({
        tool: { ...state.tool, isDrawing: false, isDrawingComplete: true },
      }));
    },

    cancelDrawing: () => {
      set(state => ({
        tool: {
          ...state.tool,
          drawingPoints: [],
          isDrawing: false,
          isDrawingComplete: false,
          activeTool: null,
        },
      }));
    },

    // === Slice Actions ===

    executeSlice: async () => {
      const { model, tool } = get();
      if (!model.geometry || !tool.activeTool) return;

      try {
        // Push current geometry to undo stack
        const currentEntry = serializeGeometry(model.geometry, model.type!);
        const undoStack = [...get().undoStack, currentEntry].slice(-MAX_UNDO_STATES);

        set(state => ({
          undoStack,
          redoStack: [], // Clear redo on new action
          operation: { isSlicing: true, progress: 0, statusText: 'Slicing...' },
        }));

        const api = getSlicingAPI();
        await api.init();

        let newGeometryData: any;

        if (model.type === 'mesh') {
          const positions = model.geometry.attributes.position.array as Float32Array;
          const indices = model.geometry.index?.array as Uint32Array;
          // ... build tool geometry based on tool.activeTool and tool.transform
          newGeometryData = await api.subtractMesh(
            positions, indices,
            /* toolPositions, toolIndices — computed from tool state */
          );
        } else {
          const points = model.geometry.attributes.position.array as Float32Array;
          newGeometryData = await api.filterPointCloud(
            points, tool.activeTool, tool.transform
          );
        }

        // Build new BufferGeometry from result
        const newGeometry = new THREE.BufferGeometry();
        newGeometry.setAttribute('position',
          new THREE.Float32BufferAttribute(newGeometryData.positions, 3)
        );
        if (newGeometryData.indices) {
          newGeometry.setIndex(
            new THREE.BufferAttribute(newGeometryData.indices, 1)
          );
        }
        newGeometry.computeVertexNormals();
        newGeometry.computeBoundingSphere();

        // Dispose old geometry
        model.geometry.dispose();

        set(state => ({
          model: {
            ...state.model,
            geometry: newGeometry,
            boundingSphere: newGeometry.boundingSphere,
            vertexCount: newGeometry.attributes.position.count,
            faceCount: newGeometry.index ? newGeometry.index.count / 3 : 0,
          },
          tool: {
            ...state.tool,
            activeTool: null,
            drawingPoints: [],
            isDrawing: false,
            isDrawingComplete: false,
          },
          operation: { isSlicing: false, progress: 100, statusText: '' },
        }));

        get().addToast('success', 'Slice completed!');
      } catch (error: any) {
        set({ operation: { isSlicing: false, progress: 0, statusText: '' } });
        get().addToast('error', `Slice failed: ${error.message}`);
      }
    },

    // === History Actions ===

    undo: () => {
      const { undoStack, model } = get();
      if (undoStack.length === 0 || !model.geometry) return;

      // Save current state to redo
      const currentEntry = serializeGeometry(model.geometry, model.type!);

      // Pop from undo stack
      const newUndoStack = [...undoStack];
      const previousEntry = newUndoStack.pop()!;

      // Rebuild geometry from previous entry
      const restoredGeometry = new THREE.BufferGeometry();
      restoredGeometry.setAttribute('position',
        new THREE.Float32BufferAttribute(previousEntry.positions, 3)
      );
      if (previousEntry.indices) {
        restoredGeometry.setIndex(
          new THREE.BufferAttribute(previousEntry.indices, 1)
        );
      }
      restoredGeometry.computeVertexNormals();
      restoredGeometry.computeBoundingSphere();

      model.geometry.dispose();

      set(state => ({
        model: {
          ...state.model,
          geometry: restoredGeometry,
          type: previousEntry.type,
          boundingSphere: restoredGeometry.boundingSphere,
          vertexCount: restoredGeometry.attributes.position.count,
          faceCount: restoredGeometry.index ? restoredGeometry.index.count / 3 : 0,
        },
        undoStack: newUndoStack,
        redoStack: [...state.redoStack, currentEntry],
      }));

      get().addToast('info', 'Undo');
    },

    redo: () => {
      const { redoStack, model } = get();
      if (redoStack.length === 0 || !model.geometry) return;

      const currentEntry = serializeGeometry(model.geometry, model.type!);

      const newRedoStack = [...redoStack];
      const nextEntry = newRedoStack.pop()!;

      const restoredGeometry = new THREE.BufferGeometry();
      restoredGeometry.setAttribute('position',
        new THREE.Float32BufferAttribute(nextEntry.positions, 3)
      );
      if (nextEntry.indices) {
        restoredGeometry.setIndex(
          new THREE.BufferAttribute(nextEntry.indices, 1)
        );
      }
      restoredGeometry.computeVertexNormals();
      restoredGeometry.computeBoundingSphere();

      model.geometry.dispose();

      set(state => ({
        model: {
          ...state.model,
          geometry: restoredGeometry,
          type: nextEntry.type,
          boundingSphere: restoredGeometry.boundingSphere,
          vertexCount: restoredGeometry.attributes.position.count,
          faceCount: restoredGeometry.index ? restoredGeometry.index.count / 3 : 0,
        },
        undoStack: [...state.undoStack, currentEntry],
        redoStack: newRedoStack,
      }));

      get().addToast('info', 'Redo');
    },

    // === Toast Actions ===

    addToast: (type, message) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      set(state => ({
        toasts: [...state.toasts, { id, type, message, timestamp: Date.now() }]
          .slice(-MAX_TOASTS),
      }));

      // Auto-remove after 5 seconds
      setTimeout(() => {
        get().removeToast(id);
      }, 5000);
    },

    removeToast: (id) => {
      set(state => ({
        toasts: state.toasts.filter(t => t.id !== id),
      }));
    },

    // === UI Actions ===

    setUIState: (state) => {
      set(prev => ({
        ui: { ...prev.ui, ...state },
      }));
    },
  }))
);
```

---

## State Subscription Patterns

### Selective Subscriptions (Performance)

Components should subscribe to only the state they need to avoid unnecessary re-renders:

```typescript
// ✅ GOOD: Only re-renders when activeViewIndex changes
const activeView = useStore(s => s.activeViewIndex);

// ✅ GOOD: Only re-renders when the tool type changes
const activeTool = useStore(s => s.tool.activeTool);

// ❌ BAD: Re-renders on ANY state change
const store = useStore();
```

### R3F Components (useFrame access)

For components inside `<Canvas>`, use `useStore.getState()` inside `useFrame` to avoid React re-renders in the render loop:

```typescript
// Inside a R3F component
useFrame(() => {
  const { tool } = useStore.getState(); // No React re-render
  meshRef.current.position.set(...tool.transform.position);
});
```

### External Subscriptions (Workers)

Workers receive state snapshots via Comlink — they don't subscribe to the store directly. State is passed as serializable arguments to worker methods.

---

## State Flow Diagrams

### Import Flow

```
User drops file
      │
      ▼
importModel(file) called
      │
      ├── set operation.isSlicing = true
      │
      ├── loadModelFile(file) → BufferGeometry
      │
      ├── detectModelType(geometry) → 'mesh' | 'pointcloud'
      │
      ├── centerGeometry(geometry)
      │
      ├── computeBoundingSphere()
      │
      ├── set model.* with new data
      │
      ├── clear tool state
      │
      ├── clear undo/redo stacks
      │
      ├── set operation.isSlicing = false
      │
      └── addToast('success', ...)
```

### Slice Flow

```
User clicks "Slice!"
      │
      ▼
executeSlice() called
      │
      ├── Validate: geometry exists, tool is active
      │
      ├── Push current geometry to undoStack
      │
      ├── Clear redoStack
      │
      ├── set operation.isSlicing = true
      │
      ├── Get or create Web Worker (lazy init)
      │
      ├── Serialize geometry + tool → Worker
      │       │
      │       ├── Mesh? → manifold3d CSG subtract
      │       │
      │       └── PointCloud? → BVH spatial filter
      │
      ├── Receive new geometry from Worker
      │
      ├── Dispose old geometry
      │
      ├── set model.geometry = new geometry
      │
      ├── Clear tool state
      │
      ├── set operation.isSlicing = false
      │
      └── addToast('success', ...)
```

### Undo/Redo Flow

```
undoStack: [G0, G1, G2]    current: G3    redoStack: []

User clicks Undo:
undoStack: [G0, G1]        current: G2    redoStack: [G3]

User clicks Undo again:
undoStack: [G0]             current: G1    redoStack: [G3, G2]

User clicks Redo:
undoStack: [G0, G1]        current: G2    redoStack: [G3]

User performs new Slice:
undoStack: [G0, G1, G2]    current: G4    redoStack: []  ← cleared
```

---

## Constants

```typescript
// src/config/constants.ts

/** Maximum number of undo states to keep in memory */
export const MAX_UNDO_STATES = 10;

/** Maximum number of toasts visible at once */
export const MAX_TOASTS = 3;

/** Maximum file size allowed (500MB) */
export const MAX_FILE_SIZE = 500 * 1024 * 1024;

/** File size warning threshold (100MB) */
export const FILE_SIZE_WARNING = 100 * 1024 * 1024;

/** Supported import formats */
export const SUPPORTED_IMPORT_FORMATS = [
  '.stl', '.obj', '.gltf', '.glb', '.ply', '.3mf', '.xyz',
];

/** Supported export formats */
export const SUPPORTED_EXPORT_FORMATS = [
  { value: 'stl', label: 'STL (Binary)' },
  { value: 'ply', label: 'PLY' },
  { value: 'obj', label: 'OBJ' },
  { value: 'gltf', label: 'glTF' },
  { value: 'glb', label: 'GLB (Binary glTF)' },
];

/** Toast auto-dismiss duration (ms) */
export const TOAST_DURATION = 5000;

/** Default tool transform */
export const DEFAULT_TOOL_TRANSFORM = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};
```
