/** Maximum number of undo states to keep in memory */
export const MAX_UNDO_STATES = 10;

/** Maximum number of toasts visible at once */
export const MAX_TOASTS = 3;

/** Maximum file size allowed (500MB) */
export const MAX_FILE_SIZE = 500 * 1024 * 1024;

/** File size warning threshold (100MB) */
export const FILE_SIZE_WARNING = 100 * 1024 * 1024;

/** Maximum vertex count accepted after parsing. A file can be small on disk
 *  (dense ASCII STL/PLY/XYZ) yet decode to a mesh that exhausts memory during
 *  CSG and undo serialization — enforce a budget at the geometry level too. */
export const MAX_VERTICES = 10_000_000;

/** Supported import formats. (3MF intentionally absent — no loader yet.) */
export const SUPPORTED_IMPORT_FORMATS = [
  '.stl', '.obj', '.gltf', '.glb', '.ply', '.xyz',
];

/** Toast auto-dismiss duration (ms) */
export const TOAST_DURATION = 5000;

/** Default tool transform */
export const DEFAULT_TOOL_TRANSFORM = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

/** Lasso: auto-close after this many anchor points */
export const LASSO_MAX_POINTS = 9;

/** Lasso: clicks within this fraction of the model radius close the loop */
export const LASSO_CLOSE_RADIUS_FRACTION = 0.08;

/** Lasso extrusion depth = model radius × this factor (punches through) */
export const LASSO_EXTRUSION_FACTOR = 6;

/** Normalized size models are scaled to on import */
export const MODEL_NORMALIZED_SIZE = 2;
