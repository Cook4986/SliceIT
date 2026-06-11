import type { SliceItStore } from '../types/store';
import { VIEW_CONFIGS } from '../config/viewConfigs';
import { syncChannel } from './syncChannel';
import type { SliceCreator } from './storeTypes';

export type ViewSlice = Pick<
  SliceItStore,
  | 'activeViewIndex'
  | 'setActiveViewIndex'
  | 'cameraSync'
  | 'setCameraSync'
  | 'sharedPointer'
  | 'setSharedPointer'
  | 'viewConfigs'
  | 'setActiveView'
>;

export const createViewSlice: SliceCreator<ViewSlice> = (set, get) => ({
  activeViewIndex: 0,
  cameraSync: { target: [0, 0, 0], zoomScale: 1 },
  sharedPointer: null,
  viewConfigs: VIEW_CONFIGS,

  setActiveViewIndex: (index: number, remote = false) => {
    set((state) => {
      if (state.activeViewIndex === index) return {};

      // Switching viewports mid-draw restarts knife/lasso point placement —
      // anchor coordinates are only meaningful within one camera projection.
      const isKnifeOrLasso = state.tool.activeTool === 'knife' || state.tool.activeTool === 'lasso';
      if (isKnifeOrLasso && !state.tool.isDrawingComplete) {
        const initialPoint: [number, number, number] = state.sharedPointer ? [...state.sharedPointer] : [0, 0, 0];
        return {
          activeViewIndex: index,
          tool: {
            ...state.tool,
            points: [initialPoint],
            isDrawing: true,
            placementIndex: 0,
          }
        };
      }
      return { activeViewIndex: index };
    });
    if (!remote) {
      syncChannel.postMessage({ type: 'ACTIVE_VIEW_SYNC', index });
    }
  },

  setCameraSync: (sync, remote = false) => {
    set(s => ({ cameraSync: { ...s.cameraSync, ...sync } }));
    if (!remote) {
      syncChannel.postMessage({ type: 'CAMERA_SYNC', ...sync });
    }
  },

  setSharedPointer: (pos, remote = false) => {
    set({ sharedPointer: pos });
    if (!remote) {
      syncChannel.postMessage({ type: 'POINTER_SYNC', pos });
    }
  },

  setActiveView: (index: number) => {
    get().setActiveViewIndex(index);
  },
});
