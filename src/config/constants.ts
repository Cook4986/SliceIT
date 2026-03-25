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
] as const;

/** Toast auto-dismiss duration (ms) */
export const TOAST_DURATION = 5000;

/** Default tool transform */
export const DEFAULT_TOOL_TRANSFORM = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

/** Default camera distance multiplier */
export const DEFAULT_CAMERA_DISTANCE = 5;
