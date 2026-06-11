import type { SliceItStore, PointsEntry } from '../types/store';
import { serializeGeometry, deserializeGeometry } from '../utils/workerGeometry';
import type { SliceCreator } from './storeTypes';

export type HistorySlice = Pick<SliceItStore, 'undoStack' | 'redoStack' | 'undo' | 'redo'>;

export const createHistorySlice: SliceCreator<HistorySlice> = (set, get) => ({
  undoStack: [],
  redoStack: [],

  undo: () => {
    const { undoStack, model, tool } = get();
    if (undoStack.length === 0) return;

    const newUndoStack = [...undoStack];
    const previousEntry = newUndoStack.pop()!;

    // Dispatch on entry kind
    if (previousEntry.kind === 'points') {
      // Undo an anchor placement — restore tool points state
      const currentSnapshot: PointsEntry = {
        kind: 'points',
        points: tool.points.map(p => [...p] as [number, number, number]),
        placementIndex: tool.placementIndex,
        isDrawingComplete: tool.isDrawingComplete,
      };
      set(state => ({
        undoStack: newUndoStack,
        redoStack: [...state.redoStack, currentSnapshot],
        tool: {
          ...state.tool,
          points: previousEntry.points,
          placementIndex: previousEntry.placementIndex,
          isDrawingComplete: previousEntry.isDrawingComplete,
          isDrawing: !previousEntry.isDrawingComplete,
        },
      }));
      get().addToast('info', 'Undo anchor');
      return;
    }

    // Geometry undo (kind === 'geometry') — restore sliced mesh
    if (!model.geometry) return;
    const currentEntry = serializeGeometry(model.geometry, model.type!);

    // deserializeGeometry restores positions, indices, normals AND UVs.
    const restoredGeometry = deserializeGeometry(previousEntry);

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
    const { redoStack, model, tool } = get();
    if (redoStack.length === 0) return;

    const newRedoStack = [...redoStack];
    const nextEntry = newRedoStack.pop()!;

    // Dispatch on entry kind
    if (nextEntry.kind === 'points') {
      const currentSnapshot: PointsEntry = {
        kind: 'points',
        points: tool.points.map(p => [...p] as [number, number, number]),
        placementIndex: tool.placementIndex,
        isDrawingComplete: tool.isDrawingComplete,
      };
      set(state => ({
        undoStack: [...state.undoStack, currentSnapshot],
        redoStack: newRedoStack,
        tool: {
          ...state.tool,
          points: nextEntry.points,
          placementIndex: nextEntry.placementIndex,
          isDrawingComplete: nextEntry.isDrawingComplete,
          isDrawing: !nextEntry.isDrawingComplete,
        },
      }));
      get().addToast('info', 'Redo anchor');
      return;
    }

    // Geometry redo (kind === 'geometry')
    if (!model.geometry) return;
    const currentEntry = serializeGeometry(model.geometry, model.type!);

    // Restores UVs along with positions/indices/normals (see undo).
    const restoredGeometry = deserializeGeometry(nextEntry);

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
});
