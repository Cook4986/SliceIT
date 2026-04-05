import type * as THREE from 'three';

// ============================================================
// Enum Types
// ============================================================

export type ModelType = 'mesh' | 'pointcloud';

export type ToolType = 'box' | 'sphere' | 'plane' | 'knife' | 'lasso';

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

  /** Relative scale ratio (applied during normalization) */
  scaleRatio: number;
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
  /** 3D points for cutting tool (Knife=2+, Lasso=3+) */
  points: [number, number, number][];
  /** Normal of the cut plane */
  planeNormal: [number, number, number];
  /** Position/Center of the cut plane */
  planePosition: [number, number, number];
  /** -1: not placing, 0+: index of point currently following mouse */
  placementIndex: number;
}

// ============================================================
// View State
// ============================================================

export interface ViewConfig {
  /** Display label (e.g., "Top", "Front", "Iso 1") */
  label: string;

  /** Camera type */
  cameraType: 'orthographic' | 'perspective';

  /** Initial camera position direction (multiplied by D) */
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
  normals: Float32Array | null;
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
  showFloatingInspector: boolean;
  floatingInspectorPos: [number, number];
  showExportModal: boolean;
  showSettings: boolean;
  showDebugConsole: boolean;
}

// ============================================================
// Complete Store Interface
// ============================================================

export interface SliceItStore {
  // --- State Slices ---
  model: ModelState;
  tool: ToolState;
  activeViewIndex: number;
  setActiveViewIndex: (index: number, remote?: boolean) => void;
  cameraSync: { target: [number, number, number], zoomScale: number };
  setCameraSync: (state: Partial<{ target: [number, number, number], zoomScale: number }>, remote?: boolean) => void;
  sharedPointer: [number, number, number] | null;
  setSharedPointer: (pos: [number, number, number] | null, remote?: boolean) => void;
  viewConfigs: ViewConfig[];
  operation: OperationState;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  toasts: ToastMessage[];
  logs: string[];
  ui: UIState;

  // --- Model Actions ---
  importModel: (file: File) => Promise<void>;
  exportModel: (format: ExportFormat) => void;
  loadPreset: (type: 'box' | 'sphere', remote?: boolean) => void;
  clearModel: () => void;

  // --- View Actions ---
  setActiveView: (index: number) => void;
  resetCameras: () => void;

  // --- Tool Actions ---
  setActiveTool: (tool: ToolType | null) => void;
  setTransformMode: (mode: TransformMode) => void;
  updateToolTransform: (transform: Partial<ToolTransform>) => void;
  addDrawingPoint: (point: [number, number]) => void;
  updatePoint: (index: number, pos: [number, number, number]) => void;
  addAnchor: (pos: [number, number, number]) => void;
  updatePlaneNormal: (normal: [number, number, number]) => void;
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

  // --- Log Actions ---
  addLog: (msg: string) => void;
  clearLogs: () => void;
}
