import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import * as THREE from 'three';
import type {
  SliceItStore,
  ToolType,
  TransformMode,
  ExportFormat,
  ToastType,
  UIState,
  ToolTransform,
} from '../types/store';
import { VIEW_CONFIGS } from '../config/viewConfigs';
import { DEFAULT_TOOL_TRANSFORM, MAX_UNDO_STATES, MAX_TOASTS } from '../config/constants';
import { loadModelFile } from '../loaders/loaderFactory';
import { detectModelType, centerGeometry, normalizeScale } from '../utils/geometryUtils';
import { serializeGeometry } from '../utils/workerGeometry';
import { exportGeometry } from '../exporters/exporterFactory';
import { getSlicingAPI } from '../workers/slicing.api';

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
      transformMode: 'translate' as TransformMode,
      drawingPoints: [],
      isDrawing: false,
      isDrawingComplete: false,
    },

    activeViewIndex: 0,
    cameraSync: { target: [0, 0, 0], zoom: 1 },
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

    ui: {
      showImportModal: false,
      showExportModal: false,
      showSettings: false,
      showFloatingInspector: false,
      floatingInspectorPos: [0, 0],
    },

    // === Sync Actions ===
    setCameraSync: (sync) => set(s => ({ cameraSync: { ...s.cameraSync, ...sync } })),
    setSharedPointer: (pos) => set({ sharedPointer: pos }),

    // === Model Actions ===

    importModel: async (file: File) => {
      try {
        set(state => ({
          operation: { ...state.operation, isSlicing: true, statusText: 'Loading...' },
        }));

        const geometry = await loadModelFile(file);
        const type = detectModelType(geometry);

        // Clean up previous geometry (Garbage Collection)
        const prevGeometry = get().model.geometry;
        if (prevGeometry) prevGeometry.dispose();

        centerGeometry(geometry);
        const scaleRatio = normalizeScale(geometry, 5);
        geometry.computeVertexNormals();
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
            scaleRatio,
          },
          tool: {
            activeTool: null,
            transform: { ...DEFAULT_TOOL_TRANSFORM },
            transformMode: 'translate' as TransformMode,
            drawingPoints: [],
            isDrawing: false,
            isDrawingComplete: false,
          },
          undoStack: [],
          redoStack: [],
          operation: { isSlicing: false, progress: 100, statusText: '' },
        });

        get().addToast('success', `Loaded ${file.name} (${vertexCount.toLocaleString()} vertices)`);
      } catch (error: unknown) {
        set({ operation: { isSlicing: false, progress: 0, statusText: '' } });
        const message = error instanceof Error ? error.message : 'Unknown error';
        get().addToast('error', `Failed to load file: ${message}`);
      }
    },

    exportModel: (format: ExportFormat) => {
      const { geometry, filename } = get().model;
      if (!geometry) return;
      try {
        exportGeometry(geometry, format, filename);
        get().addToast('success', `Exported as ${format.toUpperCase()}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        get().addToast('error', `Export failed: ${message}`);
      }
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
          transformMode: 'translate' as TransformMode,
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

        set(() => ({
          undoStack,
          redoStack: [],
          operation: { isSlicing: true, progress: 0, statusText: 'Slicing...' },
        }));

        const api = getSlicingAPI();
        await api.init();

        // Phase 5: Implementation deferred
        if (model.type === 'mesh') {
          const positions = model.geometry.attributes.position.array as Float32Array;
          const indices = model.geometry.index?.array as Uint32Array;
          await api.subtractMesh(
            positions,
            indices,
            new Float32Array(), 
            new Uint32Array(),
          );
        } else {
          const points = model.geometry.attributes.position.array as Float32Array;
          await api.filterPointCloud(points, tool.activeTool, tool.transform);
        }

        set({ operation: { isSlicing: false, progress: 100, statusText: '' } });
        get().addToast('success', 'Slice It! completed');
      } catch (error: unknown) {
        set({ operation: { isSlicing: false, progress: 0, statusText: '' } });
        const message = error instanceof Error ? error.message : 'Unknown error';
        get().addToast('error', `Slice failed: ${message}`);
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
      restoredGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(previousEntry.positions, 3)
      );
      if (previousEntry.indices) {
        restoredGeometry.setIndex(new THREE.BufferAttribute(previousEntry.indices, 1));
      }
      if (previousEntry.normals) {
        restoredGeometry.setAttribute(
          'normal',
          new THREE.Float32BufferAttribute(previousEntry.normals, 3)
        );
      } else {
        restoredGeometry.computeVertexNormals();
      }
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

      get().addToast('info', 'Reverse It!');
    },

    redo: () => {
      const { redoStack, model } = get();
      if (redoStack.length === 0 || !model.geometry) return;

      const currentEntry = serializeGeometry(model.geometry, model.type!);
      const newRedoStack = [...redoStack];
      const nextEntry = newRedoStack.pop()!;

      const restoredGeometry = new THREE.BufferGeometry();
      restoredGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(nextEntry.positions, 3)
      );
      if (nextEntry.indices) {
        restoredGeometry.setIndex(new THREE.BufferAttribute(nextEntry.indices, 1));
      }
      if (nextEntry.normals) {
        restoredGeometry.setAttribute(
          'normal',
          new THREE.Float32BufferAttribute(nextEntry.normals, 3)
        );
      } else {
        restoredGeometry.computeVertexNormals();
      }
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

      get().addToast('info', 'Repeat It!');
    },

    // === Toast Actions ===

    addToast: (type: ToastType, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      set(state => ({
        toasts: [...state.toasts, { id, type, message, timestamp: Date.now() }]
          .slice(-MAX_TOASTS),
      }));

      setTimeout(() => {
        get().removeToast(id);
      }, 5000);
    },

    removeToast: (id: string) => {
      set(state => ({
        toasts: state.toasts.filter(t => t.id !== id),
      }));
    },

    // === UI Actions ===

    setUIState: (uiState: Partial<UIState>) => {
      set(prev => ({
        ui: { ...prev.ui, ...uiState },
      }));
    },
  }))
);
