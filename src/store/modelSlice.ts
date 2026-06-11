import * as THREE from 'three';
import type { SliceItStore, ExportFormat } from '../types/store';
import { MODEL_NORMALIZED_SIZE } from '../config/constants';
import { loadModelFile } from '../loaders/loaderFactory';
import { detectModelType, centerGeometry, normalizeScale } from '../utils/geometryUtils';
import { exportGeometry } from '../exporters/exporterFactory';
import { validateFileSize } from '../utils/fileUtils';
import { syncChannel } from './syncChannel';
import { freshToolState } from './toolSlice';
import type { SliceCreator } from './storeTypes';

export type ModelSlice = Pick<
  SliceItStore,
  'model' | 'importModel' | 'exportModel' | 'loadPreset' | 'clearModel'
>;

const emptyModelState = (): SliceItStore['model'] => ({
  geometry: null,
  type: null,
  filename: '',
  fileSize: 0,
  boundingSphere: null,
  vertexCount: 0,
  faceCount: 0,
  scaleRatio: 1,
  originalMaterial: null,
});

export const createModelSlice: SliceCreator<ModelSlice> = (set, get) => ({
  model: emptyModelState(),

  importModel: async (file: File) => {
    // Enforce file size limits before starting any heavy work.
    const sizeCheck = validateFileSize(file.size);
    if (!sizeCheck.valid) {
      get().addToast('error', sizeCheck.message!);
      return;
    }
    if (sizeCheck.warning) {
      get().addToast('warning', sizeCheck.message!);
      // Performance advisory only — loading continues.
    }

    try {
      set(state => ({
        operation: { ...state.operation, isSlicing: true, statusText: 'Loading...' },
      }));

      const loadResult = await loadModelFile(file);
      const { geometry, material: loadedMaterial } = loadResult;
      const type = detectModelType(geometry);

      const prevGeometry = get().model.geometry;
      if (prevGeometry) prevGeometry.dispose();

      centerGeometry(geometry);
      normalizeScale(geometry, MODEL_NORMALIZED_SIZE);
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();

      // Check if the loaded model has textures/materials
      const hasTextures = !!(loadedMaterial && geometry.attributes.uv);

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
          originalMaterial: loadedMaterial,
        },
        tool: freshToolState(),
        undoStack: [],
        redoStack: [],
        operation: { isSlicing: false, progress: 100, statusText: '' },
        cameraSync: { target: [0, 0, 0], zoomScale: 1 },
      });

      get().addToast('success', `Loaded ${file.name}`);
      if (hasTextures) {
        get().addToast('info', '🎨 Textures detected — toggle "Preserve Textures" to keep them on export.');
      }
    } catch (error: unknown) {
      set({ operation: { isSlicing: false, progress: 0, statusText: '' } });
      const detail = error instanceof Error ? error.message : 'Unknown error';
      get().addToast('error', `Load failed: ${detail}`);
      get().addLog(`Load failed: ${detail}`);
    }
  },

  exportModel: (format: ExportFormat) => {
    const { geometry, filename, originalMaterial } = get().model;
    const preserveTextures = get().ui.preserveTextures;
    if (!geometry) return;
    try {
      exportGeometry(geometry, format, filename, originalMaterial, preserveTextures);
      if (preserveTextures && originalMaterial) {
        const isTextureFmt = ['glb', 'gltf', 'obj'].includes(format);
        if (isTextureFmt) {
          get().addToast('success', `Exported as ${format.toUpperCase()} with textures`);
        } else {
          get().addToast('success', `Exported as ${format.toUpperCase()} (geometry only)`);
        }
      } else {
        get().addToast('success', `Exported as ${format.toUpperCase()}`);
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      get().addToast('error', `Export failed: ${detail}`);
      get().addLog(`Export failed: ${detail}`);
    }
  },

  loadPreset: (type: 'box' | 'sphere', remote = false) => {
    const prevGeometry = get().model.geometry;
    if (prevGeometry) prevGeometry.dispose();

    const geometry = type === 'box'
      ? new THREE.BoxGeometry(2, 2, 2)
      : new THREE.SphereGeometry(1.5, 32, 32);

    geometry.computeVertexNormals();
    centerGeometry(geometry);
    normalizeScale(geometry, MODEL_NORMALIZED_SIZE);
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
        originalMaterial: null,
      },
      tool: freshToolState(),
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
      model: emptyModelState(),
      undoStack: [],
      redoStack: [],
      tool: freshToolState(),
      cameraSync: { target: [0, 0, 0], zoomScale: 1 },
    });
  },
});
