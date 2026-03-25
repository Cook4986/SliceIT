/**
 * Slicing Web Worker — stub for Phase 1.
 * Full CSG (manifold3d) and point cloud filtering will be implemented in Phase 5.
 */

import { expose } from 'comlink';

let initialized = false;

const slicingAPI = {
  async init(): Promise<void> {
    if (initialized) return;
    // Phase 5: Initialize manifold3d WASM here
    console.log('[SlicingWorker] Initialized (stub)');
    initialized = true;
  },

  async subtractMesh(
    _modelPositions: Float32Array,
    _modelIndices: Uint32Array,
    _toolPositions: Float32Array,
    _toolIndices: Uint32Array
  ): Promise<{ positions: Float32Array; indices: Uint32Array }> {
    // Phase 5: manifold3d CSG subtraction
    throw new Error('CSG subtraction not yet implemented. Coming in Phase 5.');
  },

  async filterPointCloud(
    _points: Float32Array,
    _toolType: string,
    _toolParams: unknown
  ): Promise<Float32Array> {
    // Phase 5: BVH spatial filtering
    throw new Error('Point cloud filtering not yet implemented. Coming in Phase 5.');
  },
};

expose(slicingAPI);

export type SlicingAPI = typeof slicingAPI;
