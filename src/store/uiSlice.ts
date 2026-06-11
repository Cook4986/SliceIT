import type { SliceItStore, ToastType } from '../types/store';
import { MAX_TOASTS, TOAST_DURATION, MAX_UNDO_STATES } from '../config/constants';
import type { SliceCreator } from './storeTypes';

export type UISlice = Pick<
  SliceItStore,
  | 'toasts'
  | 'logs'
  | 'ui'
  | 'addToast'
  | 'removeToast'
  | 'setUIState'
  | 'togglePreserveTextures'
  | 'addLog'
  | 'clearLogs'
>;

export const createUISlice: SliceCreator<UISlice> = (set, get) => ({
  toasts: [],
  logs: [],

  ui: {
    showExportModal: false,
    showSettings: false,
    showFloatingInspector: false,
    floatingInspectorPos: [0, 0],
    showDebugConsole: false,
    showHelp: false,
    preserveTextures: false, // Off by default — 3D print workflow
    undoDepth: MAX_UNDO_STATES,
  },

  addToast: (type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    set(state => ({
      toasts: [...state.toasts, { id, type, message, timestamp: Date.now() }].slice(-MAX_TOASTS),
    }));
    setTimeout(() => get().removeToast(id), TOAST_DURATION);
  },

  removeToast: (id: string) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    }));
  },

  setUIState: (uiState) => {
    set(prev => ({ ui: { ...prev.ui, ...uiState } }));
  },

  togglePreserveTextures: () => {
    const current = get().ui.preserveTextures;
    const model = get().model;
    const newValue = !current;

    if (newValue) {
      // Turning ON: check if model actually has textures
      const hasTextures = !!(model.originalMaterial && model.geometry?.attributes.uv);
      if (!model.geometry) {
        get().addToast('info', '🎨 Texture mode enabled — load a textured model (GLB/OBJ) to use.');
      } else if (!hasTextures) {
        get().addToast('warning', '⚠️ This model has no embedded textures. UVs will be zeroed.');
      } else {
        get().addToast('success', '🎨 Texture preservation ON — UVs will be carried through cuts.');
      }
    } else {
      get().addToast('info', 'Texture preservation OFF — geometry-only mode (3D print ready).');
    }

    set(prev => ({ ui: { ...prev.ui, preserveTextures: newValue } }));
    get().addLog(`Texture preservation toggled: ${newValue ? 'ON' : 'OFF'}`);
  },

  addLog: (msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8); // HH:MM:SS
    set(state => {
      const logs = [...state.logs, `[${timestamp}] ${msg}`];
      // Keep last 100 logs to prevent memory bloat
      if (logs.length > 100) {
        return { logs: logs.slice(-100) };
      }
      return { logs };
    });
    console.log(`[SliceIT Debug] ${msg}`); // Also output to real console
  },

  clearLogs: () => {
    set({ logs: [] });
  },
});
