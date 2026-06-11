/**
 * Central Zustand store, assembled from focused slices:
 *
 *   modelSlice     — import/export/presets/clear + model metadata
 *   toolSlice      — active tool, gizmo transform, knife/lasso anchors
 *   viewSlice      — viewport selection, camera + pointer sync
 *   operationSlice — executeSlice / cancelSlice worker orchestration
 *   historySlice   — undo/redo stacks (geometry + anchor snapshots)
 *   uiSlice        — toasts, logs, modal/overlay flags
 *
 * Cross-tab synchronization arrives over a BroadcastChannel; the handler at
 * the bottom validates every message before applying it.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { SliceItStore } from '../types/store';
import { VIEW_CONFIGS } from '../config/viewConfigs';
import { syncChannel } from './syncChannel';
import { createModelSlice } from './modelSlice';
import { createToolSlice } from './toolSlice';
import { createViewSlice } from './viewSlice';
import { createOperationSlice } from './operationSlice';
import { createHistorySlice } from './historySlice';
import { createUISlice } from './uiSlice';

export const useStore = create<SliceItStore>()(
  subscribeWithSelector((set, get) => ({
    ...createModelSlice(set, get),
    ...createToolSlice(set, get),
    ...createViewSlice(set, get),
    ...createOperationSlice(set, get),
    ...createHistorySlice(set, get),
    ...createUISlice(set, get),
  }))
);

// ============================================================
// Cross-tab Message Handling
// ============================================================

/** Validate that a value is a finite [x, y, z] tuple. */
const isVec3 = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) &&
  v.length === 3 &&
  v.every(n => typeof n === 'number' && Number.isFinite(n));

// BroadcastChannel messages arrive from OTHER same-origin tabs — they must be
// treated as untrusted input. Every field is validated before being applied;
// a malformed message (wrong shape, out-of-range view index, NaN coordinates)
// is silently ignored instead of corrupting state or crashing a render.
syncChannel.onmessage = (event) => {
  try {
    const data = event.data;
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
    const store = useStore.getState();

    switch (data.type) {
      case 'CAMERA_SYNC': {
        const sync: Partial<{ target: [number, number, number]; zoomScale: number }> = {};
        if (isVec3(data.target)) sync.target = data.target;
        if (typeof data.zoomScale === 'number' && Number.isFinite(data.zoomScale)) {
          sync.zoomScale = data.zoomScale;
        }
        if (Object.keys(sync).length > 0) store.setCameraSync(sync, true);
        break;
      }
      case 'POINTER_SYNC':
        if (data.pos === null || isVec3(data.pos)) store.setSharedPointer(data.pos, true);
        break;
      case 'ACTIVE_VIEW_SYNC':
        if (Number.isInteger(data.index) && data.index >= 0 && data.index < VIEW_CONFIGS.length) {
          store.setActiveViewIndex(data.index, true);
        }
        break;
      case 'PRESET_SYNC':
        if (data.presetType === 'box' || data.presetType === 'sphere') {
          store.loadPreset(data.presetType, true);
        }
        break;
      case 'KNIFE_NORMAL_SYNC':
        if (isVec3(data.normal)) store.updatePlaneNormal(data.normal, true);
        break;
    }
  } catch {
    // A malformed sync message must never take down the app.
  }
};
