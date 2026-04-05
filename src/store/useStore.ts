import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import * as THREE from 'three';
import type {
  SliceItStore,
  ToolType,
  TransformMode,
  ExportFormat,
  ToastType,
  ToolTransform,
} from '../types/store';
import { VIEW_CONFIGS } from '../config/viewConfigs';
import { DEFAULT_TOOL_TRANSFORM, MAX_UNDO_STATES, MAX_TOASTS, TOAST_DURATION } from '../config/constants';
import { loadModelFile } from '../loaders/loaderFactory';
import { detectModelType, centerGeometry, normalizeScale } from '../utils/geometryUtils';
import { serializeGeometry } from '../utils/workerGeometry';
import { exportGeometry } from '../exporters/exporterFactory';
import { getSlicingAPI } from '../workers/slicing.api';

// ============================================================
// Multi-window Sync Management
// ============================================================

const syncChannel = new BroadcastChannel('slice-it-sync');

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
      scaleRatio: 1,
    },

    tool: {
      activeTool: null,
      transform: { ...DEFAULT_TOOL_TRANSFORM },
      transformMode: 'translate',
      drawingPoints: [],
      isDrawing: false,
      isDrawingComplete: false,
      points: [],
      planeNormal: [0, 1, 0],
      planePosition: [0, 0, 0],
      placementIndex: -1,
    },

    activeViewIndex: 0,
    cameraSync: { target: [0, 0, 0], zoomScale: 1 },
    sharedPointer: null,
    viewConfigs: VIEW_CONFIGS,

    operation: {
      isSlicing: false,
      progress: 0,
      statusText: '',
    },

    undoStack: [],
    redoStack: [],
    toasts: [],
    logs: [], // New centralized logging array

    ui: {
      showImportModal: false,
      showExportModal: false,
      showSettings: false,
      showFloatingInspector: false,
      floatingInspectorPos: [0, 0],
      showDebugConsole: false, // For hotkey overlay
    },

    setActiveViewIndex: (index: number, remote = false) => {
      set({ activeViewIndex: index });
      if (!remote) {
        syncChannel.postMessage({ type: 'ACTIVE_VIEW_SYNC', index });
      }
    },
    setCameraSync: (sync: Partial<{ target: [number, number, number]; zoomScale: number }>, remote = false) => {
      set(s => ({ cameraSync: { ...s.cameraSync, ...sync } }));
      if (!remote) {
        syncChannel.postMessage({ type: 'CAMERA_SYNC', ...sync });
      }
    },
    setSharedPointer: (pos: [number, number, number] | null, remote = false) => {
      set({ sharedPointer: pos });
      if (!remote) {
        syncChannel.postMessage({ type: 'POINTER_SYNC', pos });
      }
    },

    // === Model Actions ===

    importModel: async (file: File) => {
      try {
        set(state => ({
          operation: { ...state.operation, isSlicing: true, statusText: 'Loading...' },
        }));

        const geometry = await loadModelFile(file);
        const type = detectModelType(geometry);

        const prevGeometry = get().model.geometry;
        if (prevGeometry) prevGeometry.dispose();

        centerGeometry(geometry);
        normalizeScale(geometry, 2);
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();

        set({
          model: {
            geometry,
            type,
            filename: file.name,
            fileSize: file.size,
            boundingSphere: geometry.boundingSphere,
            vertexCount: geometry.attributes.position.count,
            faceCount: geometry.index ? geometry.index.count / 3 : 0,
            scaleRatio: 1,
          },
          tool: {
            activeTool: null,
            transform: { ...DEFAULT_TOOL_TRANSFORM },
            transformMode: 'translate',
            drawingPoints: [],
            isDrawing: false,
            isDrawingComplete: false,
            points: [],
            planeNormal: [0, 1, 0],
            planePosition: [0, 0, 0],
            placementIndex: -1,
          },
          undoStack: [],
          redoStack: [],
          operation: { isSlicing: false, progress: 100, statusText: '' },
          cameraSync: { target: [0, 0, 0], zoomScale: 1 },
        });

        get().addToast('success', `Loaded ${file.name}`);
      } catch (error: unknown) {
        set({ operation: { isSlicing: false, progress: 0, statusText: '' } });
        get().addToast('error', `Load failed`);
      }
    },

    exportModel: (format: ExportFormat) => {
      const { geometry, filename } = get().model;
      if (!geometry) return;
      try {
        exportGeometry(geometry, format, filename);
        get().addToast('success', `Exported as ${format.toUpperCase()}`);
      } catch (error: unknown) {
        get().addToast('error', `Export failed`);
      }
    },

    loadPreset: (type: 'box' | 'sphere', remote = false) => {
      const geometry = type === 'box' 
        ? new THREE.BoxGeometry(2, 2, 2) 
        : new THREE.SphereGeometry(1.5, 32, 32);
      
      geometry.computeVertexNormals();
      centerGeometry(geometry);
      normalizeScale(geometry, 2);
      geometry.computeBoundingSphere();
      
      set({
        model: {
          geometry,
          type: 'mesh',
          filename: `Preset ${type}`,
          fileSize: 0,
          boundingSphere: geometry.boundingSphere,
          vertexCount: geometry.attributes.position.count,
          faceCount: geometry.index ? geometry.index.count / 3 : 0,
          scaleRatio: 1,
        },
        tool: {
          activeTool: null,
          transform: { ...DEFAULT_TOOL_TRANSFORM },
          transformMode: 'translate',
          drawingPoints: [],
          isDrawing: false,
          isDrawingComplete: false,
          points: [],
          planeNormal: [0, 1, 0],
          planePosition: [0, 0, 0],
          placementIndex: -1,
        },
        undoStack: [],
        redoStack: [],
        cameraSync: { target: [0, 0, 0], zoomScale: 1 },
      });
      
      if (!remote) syncChannel.postMessage({ type: 'PRESET_SYNC', presetType: type });
      get().addToast('info', `Loaded ${type} preset`);
    },

    clearModel: () => {
      const { geometry } = get().model;
      if (geometry) geometry.dispose();

      set({
        model: {
          geometry: null,
          type: null,
          filename: '',
          fileSize: 0,
          boundingSphere: null,
          vertexCount: 0,
          faceCount: 0,
          scaleRatio: 1,
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
          points: [],
          planeNormal: [0, 1, 0],
          planePosition: [0, 0, 0],
          placementIndex: -1,
        },
        cameraSync: { target: [0, 0, 0], zoomScale: 1 },
      });
    },

    setActiveView: (index: number) => {
      set({ activeViewIndex: index });
    },

    resetCameras: () => {
      const geom = get().model.geometry;
      if (geom) {
          set(s => ({ model: { ...s.model, geometry: null } }));
          set(s => ({ model: { ...s.model, geometry: geom }, cameraSync: { target: [0, 0, 0], zoomScale: 1 } }));
      } else {
          set({ cameraSync: { target: [0, 0, 0], zoomScale: 1 } });
      }
      syncChannel.postMessage({ type: 'CAMERA_SYNC', target: [0, 0, 0], zoomScale: 1 });
      get().addToast('info', 'View Reset!');
    },

    // === Tool Actions ===

    setActiveTool: (tool: ToolType | null) => {
      const { sharedPointer } = get();
      const initialPoint: [number, number, number] = sharedPointer ? [...sharedPointer] : [0, 0, 0];
      const isKnifeOrLasso = tool === 'knife' || tool === 'lasso';
      
      set(state => ({
        tool: {
          ...state.tool,
          activeTool: tool,
          // Knife/lasso start with one point following the mouse
          // Primitive tools don't use points
          points: isKnifeOrLasso ? [initialPoint] : [],
          drawingPoints: [],
          isDrawing: isKnifeOrLasso,
          isDrawingComplete: false,
          placementIndex: isKnifeOrLasso ? 0 : -1,
          transformMode: 'translate',
          transform: { ...DEFAULT_TOOL_TRANSFORM },
          planeNormal: [0, 1, 0],
          planePosition: [0, 0, 0],
        },
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

    addDrawingPoint: (point: [number, number]) => {
      set(state => ({
        tool: {
          ...state.tool,
          drawingPoints: [...state.tool.drawingPoints, point],
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

    addAnchor: (pos: [number, number, number]) => {
      set(s => {
        const { activeTool, placementIndex, points } = s.tool;
        if (placementIndex === -1) return {}; // already complete, ignore
        
        // Lock the current point at placementIndex with the click position
        const newPoints = [...points];
        newPoints[placementIndex] = [...pos] as [number, number, number];
        
        // Count locked points (the current one we just locked + all before it)
        const lockedCount = placementIndex + 1;
        
        // Check if drawing should complete
        let isDrawingComplete = false;
        let newPlacementIndex = placementIndex + 1;

        if (activeTool === 'knife' && lockedCount >= 3) {
            // Knife needs exactly 3 points to define a plane
            isDrawingComplete = true;
            newPlacementIndex = -1;
        } else if (activeTool === 'lasso' && lockedCount > 8) {
            isDrawingComplete = true;
            newPlacementIndex = -1;
        } else {
            // Add a new follower point at the next index (starts at click pos, will be updated by mouse)
            newPoints.push([...pos] as [number, number, number]);
        }

        return { tool: { 
            ...s.tool, 
            points: newPoints, 
            placementIndex: newPlacementIndex,
            isDrawingComplete,
            isDrawing: !isDrawingComplete
        } };
      });
    },

    updatePlaneNormal: (normal: [number, number, number], remote = false) => {
      set(s => ({ tool: { ...s.tool, planeNormal: normal } }));
      if (!remote) syncChannel.postMessage({ type: 'KNIFE_NORMAL_SYNC', normal });
    },

    completeDrawing: () => {
      set(state => ({
        tool: { ...state.tool, isDrawing: false, isDrawingComplete: true, placementIndex: -1 },
      }));
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
      }));
    },

    executeSlice: async () => {
      const { model, tool, addLog } = get();
      if (!model.geometry || !tool.activeTool) {
        addLog('Slicing blocked: Missing geometry or active tool.');
        get().addToast('warning', 'Select a tool and load a model first.');
        return;
      }

      const isKnifeOrLasso = tool.activeTool === 'knife' || tool.activeTool === 'lasso';
      if (isKnifeOrLasso && !tool.isDrawingComplete) {
        addLog('Slicing blocked: Drawing not complete yet.');
        get().addToast('warning', 'Finish placing all points first.');
        return;
      }
      
      try {
        addLog(`Preparing to slice using ${tool.activeTool} tool.`);
        const currentEntry = serializeGeometry(model.geometry, model.type!);
        const undoStack = [...get().undoStack, currentEntry].slice(-MAX_UNDO_STATES);
        set(() => ({ operation: { isSlicing: true, progress: 0, statusText: 'Slicing...' }, undoStack }));
        
        const api = getSlicingAPI();
        addLog('Initializing WebWorker for boolean subtraction...');
        await api.init();
        
        if (model.type === 'mesh') {
          addLog('Dispatching geometry to worker...');
          
          let origin: [number, number, number] = [0, 0, 0];
          let normal: [number, number, number] = [0, 1, 0];

          if (tool.points.length >= 3) {
              const p0 = new THREE.Vector3(...tool.points[0]);
              const p1 = new THREE.Vector3(...tool.points[1]);
              const p2 = new THREE.Vector3(...tool.points[2]);
              const v1 = new THREE.Vector3().subVectors(p1, p0).normalize();
              const v2 = new THREE.Vector3().subVectors(p2, p0).normalize();
              const n = new THREE.Vector3().crossVectors(v1, v2).normalize();
              if (n.lengthSq() > 0.0001) {
                  normal = [n.x, n.y, n.z];
              }
              origin = [p0.x, p0.y, p0.z];
          }

          const result = await api.subtractMeshWithPlane(
              model.geometry.attributes.position.array as Float32Array, 
              model.geometry.index?.array as Uint32Array || null, 
              origin,
              normal
          );

          addLog('Worker completed boolean operation successfully.');

          const slicedGeometry = new THREE.BufferGeometry();
          slicedGeometry.setAttribute('position', new THREE.BufferAttribute(result.positions, 3));
          if (result.indices.length > 0) {
              slicedGeometry.setIndex(new THREE.BufferAttribute(result.indices, 1));
          }
          slicedGeometry.computeVertexNormals();
          slicedGeometry.computeBoundingSphere();

          set(s => ({
              model: {
                  ...s.model,
                  geometry: slicedGeometry,
                  boundingSphere: slicedGeometry.boundingSphere,
                  vertexCount: slicedGeometry.attributes.position.count,
                  faceCount: result.indices.length > 0 ? result.indices.length / 3 : slicedGeometry.attributes.position.count / 3
              }
          }));

        } else {
            addLog(`Slicing not yet supported for model type: ${model.type}`);
            get().addToast('info', `Point cloud slicing coming soon.`);
        }
        
      } catch (error: any) {
        const msg = error?.message || 'Unknown worker error';
        // Handle the stub worker gracefully — it's expected during development
        if (msg.includes('not yet implemented')) {
          get().addToast('info', 'CSG engine not yet available — coming in Phase 5.');
          addLog('Slicing stub reached: CSG not yet implemented.');
        } else {
          get().addToast('error', 'Slicing failed');
          addLog(`Slicing failed: ${msg}`);
        }
      } finally {
        addLog('Unlocking Slice button state.');
        set({ operation: { isSlicing: false, progress: 100, statusText: '' } });
      }
    },

    // === History Actions ===

    undo: () => {
      const { undoStack, model } = get();
      if (undoStack.length === 0 || !model.geometry) return;

      const currentEntry = serializeGeometry(model.geometry, model.type!);
      const newUndoStack = [...undoStack];
      const previousEntry = newUndoStack.pop()!;

      const restoredGeometry = new THREE.BufferGeometry();
      restoredGeometry.setAttribute('position', new THREE.Float32BufferAttribute(previousEntry.positions, 3));
      if (previousEntry.indices) restoredGeometry.setIndex(new THREE.BufferAttribute(previousEntry.indices, 1));
      if (previousEntry.normals) restoredGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(previousEntry.normals, 3));
      else restoredGeometry.computeVertexNormals();
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
      restoredGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nextEntry.positions, 3));
      if (nextEntry.indices) restoredGeometry.setIndex(new THREE.BufferAttribute(nextEntry.indices, 1));
      if (nextEntry.normals) restoredGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(nextEntry.normals, 3));
      else restoredGeometry.computeVertexNormals();
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

    addToast: (type: ToastType, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      set(state => ({
        toasts: [...state.toasts, { id, type, message, timestamp: Date.now() }].slice(-MAX_TOASTS),
      }));
      setTimeout(() => get().removeToast(id), TOAST_DURATION);
    },

    removeToast: (id: string) => {
      set(state => ({
        toasts: state.toasts.filter(t => (t as any).id !== id),
      }));
    },

    // === UI Actions ===

    setUIState: (uiState) => {
      set(prev => ({ ui: { ...prev.ui, ...uiState } }));
    },

    // === Logging Actions ===

    addLog: (msg: string) => {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, 8); // HH:MM:SS
        set(state => {
            const logs = [...state.logs, `[${timestamp}] ${msg}`];
            // Keep last 100 logs to prevent memory bloat
            if (logs.length > 100) logs.shift();
            return { logs };
        });
        console.log(`[SliceIT Debug] ${msg}`); // Also output to real console
    },
    
    clearLogs: () => {
        set({ logs: [] });
    }
  }))
);

// === Message Handling ===
syncChannel.onmessage = (event) => {
  const { type, ...data } = event.data;
  const store = useStore.getState();

  if (type === 'CAMERA_SYNC') {
    store.setCameraSync(data, true);
  } else if (type === 'POINTER_SYNC') {
    store.setSharedPointer(data.pos, true);
  } else if (type === 'ACTIVE_VIEW_SYNC') {
    store.setActiveViewIndex(data.index, true);
  } else if (type === 'PRESET_SYNC') {
    store.loadPreset(data.presetType, true);
  }
};
