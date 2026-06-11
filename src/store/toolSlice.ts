import * as THREE from 'three';
import type { SliceItStore, ToolType, TransformMode, ToolTransform, PointsEntry } from '../types/store';
import { VIEW_CONFIGS } from '../config/viewConfigs';
import {
  DEFAULT_TOOL_TRANSFORM,
  LASSO_MAX_POINTS,
  LASSO_CLOSE_RADIUS_FRACTION,
} from '../config/constants';
import { syncChannel } from './syncChannel';
import type { SliceCreator } from './storeTypes';

/** Pristine tool state — used at startup and after every model change. */
export const freshToolState = (): SliceItStore['tool'] => ({
  activeTool: null,
  transform: { ...DEFAULT_TOOL_TRANSFORM },
  transformMode: 'translate',
  isDrawing: false,
  isDrawingComplete: false,
  points: [],
  planeNormal: [0, 1, 0],
  planePosition: [0, 0, 0],
  placementIndex: -1,
});

export type ToolSlice = Pick<
  SliceItStore,
  | 'tool'
  | 'setActiveTool'
  | 'setTransformMode'
  | 'updateToolTransform'
  | 'updatePoint'
  | 'setToolPoints'
  | 'addAnchor'
  | 'updatePlaneNormal'
  | 'updatePlanePosition'
  | 'cancelDrawing'
>;

export const createToolSlice: SliceCreator<ToolSlice> = (set, get) => ({
  tool: freshToolState(),

  setActiveTool: (tool: ToolType | null) => {
    const { sharedPointer } = get();
    const initialPoint: [number, number, number] = sharedPointer ? [...sharedPointer] : [0, 0, 0];
    const isKnifeOrLasso = tool === 'knife' || tool === 'lasso';

    set(state => ({
      tool: {
        ...state.tool,
        activeTool: tool,
        points: isKnifeOrLasso ? [initialPoint] : [],
        isDrawing: isKnifeOrLasso,
        isDrawingComplete: false,
        placementIndex: isKnifeOrLasso ? 0 : -1,
        transformMode: 'translate',
        transform: { ...DEFAULT_TOOL_TRANSFORM },
        planeNormal: [0, 1, 0],
        planePosition: [0, 0, 0],
      },
      // Clear stale point-placement history when the tool changes so geometry
      // undo/redo history is not polluted with orphaned entries.
      undoStack: state.undoStack.filter(e => e.kind !== 'points'),
      redoStack: state.redoStack.filter(e => e.kind !== 'points'),
    }));
  },

  setTransformMode: (mode: TransformMode) => {
    set(state => ({ tool: { ...state.tool, transformMode: mode } }));
  },

  updateToolTransform: (transform: Partial<ToolTransform>) => {
    set(state => ({
      tool: {
        ...state.tool,
        transform: { ...state.tool.transform, ...transform },
      },
    }));
  },

  updatePoint: (index: number, pos: [number, number, number]) => {
    set(s => {
      const points = [...s.tool.points];
      points[index] = pos;
      return { tool: { ...s.tool, points } };
    });
  },

  setToolPoints: (points: [number, number, number][]) => {
    set(s => ({ tool: { ...s.tool, points } }));
  },

  addAnchor: (pos: [number, number, number]) => {
    set(s => {
      const { activeTool, placementIndex, points } = s.tool;
      if (placementIndex === -1) return {}; // already complete, ignore

      // Snapshot current point state BEFORE the mutation so the user can
      // undo this individual anchor placement.
      const pointsSnapshot: PointsEntry = {
        kind: 'points',
        points: points.map(p => [...p] as [number, number, number]),
        placementIndex,
        isDrawingComplete: s.tool.isDrawingComplete,
      };

      // Lock the current point at placementIndex with the click position
      const newPoints = [...points];
      newPoints[placementIndex] = [...pos] as [number, number, number];

      // Count locked points (the current one we just locked + all before it)
      const lockedCount = placementIndex + 1;

      // Determine if the active viewport is orthographic (TOP/FRONT/RIGHT/etc.)
      // Ortho views complete after 2 locked points; perspective (ISO) needs 3.
      const isOrthoView = VIEW_CONFIGS[s.activeViewIndex]?.cameraType === 'orthographic';

      // Check if drawing should complete
      let isDrawingComplete = false;
      let newPlacementIndex = placementIndex + 1;

      if (activeTool === 'knife' && isOrthoView && lockedCount >= 2) {
          // Ortho 2-click: the line P1→P2 defines the cut direction
          isDrawingComplete = true;
          newPlacementIndex = -1;
      } else if (activeTool === 'knife' && !isOrthoView && lockedCount >= 3) {
          // Perspective 3-click: cross product of two edge vectors defines the normal
          isDrawingComplete = true;
          newPlacementIndex = -1;
      } else if (activeTool === 'lasso' && lockedCount >= 3) {
          // Lasso closes when user clicks near the first anchor point (loop closure)
          const firstPt = new THREE.Vector3(...newPoints[0]);
          const clickPt = new THREE.Vector3(...pos);
          const closeDist = s.model.boundingSphere?.radius
            ? s.model.boundingSphere.radius * LASSO_CLOSE_RADIUS_FRACTION
            : 0.15;
          if (firstPt.distanceTo(clickPt) < closeDist) {
              // Remove the duplicated close point — polygon is implicitly closed
              newPoints.splice(placementIndex, 1);
              isDrawingComplete = true;
              newPlacementIndex = -1;
          } else if (lockedCount > LASSO_MAX_POINTS) {
              // Hard cap: auto-close
              isDrawingComplete = true;
              newPlacementIndex = -1;
          } else {
              newPoints.push([...pos] as [number, number, number]);
          }
      } else {
          // Add a new follower point at the next index (starts at click pos, will be updated by mouse)
          newPoints.push([...pos] as [number, number, number]);
      }

      let derivedNormal: [number, number, number] = s.tool.planeNormal;
      let derivedPosition: [number, number, number] = s.tool.planePosition;

      if (isDrawingComplete && activeTool === 'knife') {
          const p0 = new THREE.Vector3(...newPoints[0]);
          const p1 = new THREE.Vector3(...newPoints[1]);

          if (isOrthoView) {
              // Ortho 2-click: P1→P2 defines an EDGE of the cutting plane.
              // The plane contains that line and extends in the camera depth
              // direction. Normal = cross(edge, viewDir).
              const edge = new THREE.Vector3().subVectors(p1, p0).normalize();
              const viewDir = new THREE.Vector3(
                ...VIEW_CONFIGS[s.activeViewIndex].position
              ).normalize();
              const n = new THREE.Vector3().crossVectors(edge, viewDir).normalize();
              if (n.lengthSq() > 0.0001) derivedNormal = [n.x, n.y, n.z];
          } else {
              // Perspective 3-click: normal = cross product of two edge vectors
              const p2 = new THREE.Vector3(...newPoints[2]);
              const v1 = new THREE.Vector3().subVectors(p1, p0).normalize();
              const v2 = new THREE.Vector3().subVectors(p2, p0).normalize();
              const n = new THREE.Vector3().crossVectors(v1, v2).normalize();
              if (n.lengthSq() > 0.0001) derivedNormal = [n.x, n.y, n.z];
          }

          // Position: always at the model's geometric center.
          // Anchor clicks define orientation only — the plane must always
          // overlap the mesh regardless of where on the invisible interaction
          // plane the user clicked.
          const mc = s.model.boundingSphere?.center ?? new THREE.Vector3();
          derivedPosition = [mc.x, mc.y, mc.z];
      }

      return {
        tool: {
          ...s.tool,
          points: newPoints,
          placementIndex: newPlacementIndex,
          isDrawingComplete,
          isDrawing: !isDrawingComplete,
          planeNormal: derivedNormal,
          planePosition: derivedPosition,
        },
        // Push snapshot and clear redo (new intent = different future)
        undoStack: [...s.undoStack, pointsSnapshot].slice(-s.ui.undoDepth),
        redoStack: [],
      };
    });
  },

  updatePlaneNormal: (normal: [number, number, number], remote = false) => {
    set(s => ({ tool: { ...s.tool, planeNormal: normal } }));
    if (!remote) syncChannel.postMessage({ type: 'KNIFE_NORMAL_SYNC', normal });
  },

  updatePlanePosition: (pos: [number, number, number]) => {
    set(s => ({ tool: { ...s.tool, planePosition: pos } }));
  },

  cancelDrawing: () => {
    set(state => ({
      tool: {
        ...state.tool,
        points: [],
        isDrawing: false,
        isDrawingComplete: false,
        activeTool: null,
        placementIndex: -1,
      },
      // Clear orphaned point history when drawing is cancelled
      undoStack: state.undoStack.filter(e => e.kind !== 'points'),
      redoStack: state.redoStack.filter(e => e.kind !== 'points'),
    }));
  },
});
