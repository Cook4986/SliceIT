# Slice It! — Web Worker & CSG Engine Specification

> **Version**: 1.0.0  
> **Last Updated**: 2026-03-23  

---

## Overview

All computationally expensive operations (mesh booleans, point cloud filtering) run in **Web Workers** to keep the main UI thread responsive. Communication between the main thread and workers uses **Comlink** for typed RPC.

---

## Architecture

```
Main Thread                              Worker Thread
─────────────────────────────────────    ─────────────────────────────────
                                         
  useStore.executeSlice()                
      │                                  
      ▼                                  
  serializeGeometry()                    
      │                                  
      ▼                                  
  slicingAPI.subtractMesh(               
    positions,  ──[Transferable]──►      slicing.worker.ts
    indices,    ──[Transferable]──►        │
    toolPos,    ──[Transferable]──►        ▼
    toolIdx     ──[Transferable]──►      manifold3d (WASM)
  )                                        │
                                           ▼
  ◄──[Transferable]──────────────────    return { positions, indices }
      │                                  
      ▼                                  
  deserializeGeometry()                  
      │                                  
      ▼                                  
  Update Zustand store                   
```

---

## Worker File: `slicing.worker.ts`

```typescript
// src/workers/slicing.worker.ts

import { expose } from 'comlink';
import Module from 'manifold-3d';

// ============================================================
// WASM Module Reference
// ============================================================

let manifold: any = null;
let ManifoldModule: any = null;

// ============================================================
// Initialization
// ============================================================

async function init(): Promise<void> {
  if (manifold) return; // Already initialized

  ManifoldModule = await Module();
  manifold = ManifoldModule.Manifold;

  console.log('[SlicingWorker] manifold3d WASM initialized');
}

// ============================================================
// Mesh CSG: Subtract
// ============================================================

/**
 * Subtract a tool mesh from a model mesh using manifold3d CSG.
 *
 * @param modelPositions - Float32Array of model vertex positions [x,y,z, x,y,z, ...]
 * @param modelIndices   - Uint32Array of model triangle indices
 * @param toolPositions  - Float32Array of tool vertex positions
 * @param toolIndices    - Uint32Array of tool triangle indices
 * @returns New geometry as { positions: Float32Array, indices: Uint32Array }
 */
async function subtractMesh(
  modelPositions: Float32Array,
  modelIndices: Uint32Array,
  toolPositions: Float32Array,
  toolIndices: Uint32Array
): Promise<{ positions: Float32Array; indices: Uint32Array }> {
  if (!manifold) throw new Error('Worker not initialized. Call init() first.');

  // Convert Float32Array positions to nested array format [[x,y,z], ...]
  const modelVerts: number[][] = [];
  for (let i = 0; i < modelPositions.length; i += 3) {
    modelVerts.push([modelPositions[i], modelPositions[i + 1], modelPositions[i + 2]]);
  }

  const toolVerts: number[][] = [];
  for (let i = 0; i < toolPositions.length; i += 3) {
    toolVerts.push([toolPositions[i], toolPositions[i + 1], toolPositions[i + 2]]);
  }

  // Convert Uint32Array indices to nested array format [[a,b,c], ...]
  const modelTris: number[][] = [];
  for (let i = 0; i < modelIndices.length; i += 3) {
    modelTris.push([modelIndices[i], modelIndices[i + 1], modelIndices[i + 2]]);
  }

  const toolTris: number[][] = [];
  for (let i = 0; i < toolIndices.length; i += 3) {
    toolTris.push([toolIndices[i], toolIndices[i + 1], toolIndices[i + 2]]);
  }

  // Create Manifold meshes
  const modelMesh = new ManifoldModule.Mesh({
    numProp: 3,
    vertProperties: new Float32Array(modelPositions),
    triVerts: new Uint32Array(modelIndices),
  });

  const toolMesh = new ManifoldModule.Mesh({
    numProp: 3,
    vertProperties: new Float32Array(toolPositions),
    triVerts: new Uint32Array(toolIndices),
  });

  const modelManifold = new manifold(modelMesh);
  const toolManifold = new manifold(toolMesh);

  // Perform CSG subtraction
  const result = manifold.difference(modelManifold, toolManifold);

  // Extract result geometry
  const resultMesh = result.getMesh();
  const outPositions = new Float32Array(resultMesh.vertProperties);
  const outIndices = new Uint32Array(resultMesh.triVerts);

  // Clean up Manifold objects
  modelMesh.delete();
  toolMesh.delete();
  modelManifold.delete();
  toolManifold.delete();
  result.delete();
  resultMesh.delete();

  return {
    positions: outPositions,
    indices: outIndices,
  };
}

// ============================================================
// Point Cloud: Spatial Filtering
// ============================================================

interface BoxParams {
  min: [number, number, number];
  max: [number, number, number];
}

interface SphereParams {
  center: [number, number, number];
  radius: number;
}

interface CylinderParams {
  center: [number, number, number];
  radius: number;
  height: number;
  axis: [number, number, number]; // Normalized direction
}

interface PolygonParams {
  points: [number, number][]; // 2D polygon in screen/view space
  viewMatrix: number[];       // 4x4 view matrix (column-major)
  projMatrix: number[];       // 4x4 projection matrix (column-major)
  depth: number;              // Extrusion depth
}

type ToolParams = BoxParams | SphereParams | CylinderParams | PolygonParams;

/**
 * Filter points from a point cloud that fall inside the specified tool shape.
 *
 * @param points    - Float32Array of point positions [x,y,z, x,y,z, ...]
 * @param toolType  - Type of cutting tool
 * @param params    - Tool-specific parameters
 * @returns Filtered Float32Array with points OUTSIDE the tool (remaining points)
 */
async function filterPointCloud(
  points: Float32Array,
  toolType: 'box' | 'sphere' | 'cylinder' | 'polygon',
  params: ToolParams
): Promise<Float32Array> {
  const pointCount = points.length / 3;
  const surviving: number[] = [];

  for (let i = 0; i < pointCount; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const z = points[i * 3 + 2];

    let inside = false;

    switch (toolType) {
      case 'box': {
        const p = params as BoxParams;
        inside = (
          x >= p.min[0] && x <= p.max[0] &&
          y >= p.min[1] && y <= p.max[1] &&
          z >= p.min[2] && z <= p.max[2]
        );
        break;
      }

      case 'sphere': {
        const p = params as SphereParams;
        const dx = x - p.center[0];
        const dy = y - p.center[1];
        const dz = z - p.center[2];
        inside = (dx * dx + dy * dy + dz * dz) <= (p.radius * p.radius);
        break;
      }

      case 'cylinder': {
        const p = params as CylinderParams;
        // Project point onto cylinder axis
        const dx = x - p.center[0];
        const dy = y - p.center[1];
        const dz = z - p.center[2];
        const dot = dx * p.axis[0] + dy * p.axis[1] + dz * p.axis[2];

        // Check height bounds
        if (Math.abs(dot) > p.height / 2) break;

        // Check radial distance
        const projX = dx - dot * p.axis[0];
        const projY = dy - dot * p.axis[1];
        const projZ = dz - dot * p.axis[2];
        const radialDist2 = projX * projX + projY * projY + projZ * projZ;
        inside = radialDist2 <= (p.radius * p.radius);
        break;
      }

      case 'polygon': {
        const p = params as PolygonParams;
        // Project 3D point to 2D screen space using view/proj matrices
        const projected = projectPoint(x, y, z, p.viewMatrix, p.projMatrix);
        inside = pointInPolygon(projected[0], projected[1], p.points);
        break;
      }
    }

    if (!inside) {
      surviving.push(x, y, z);
    }
  }

  return new Float32Array(surviving);
}

// ============================================================
// Utility: Point Projection
// ============================================================

function projectPoint(
  x: number, y: number, z: number,
  viewMatrix: number[],
  projMatrix: number[]
): [number, number] {
  // Apply view matrix (column-major)
  const vx = viewMatrix[0] * x + viewMatrix[4] * y + viewMatrix[8] * z + viewMatrix[12];
  const vy = viewMatrix[1] * x + viewMatrix[5] * y + viewMatrix[9] * z + viewMatrix[13];
  const vz = viewMatrix[2] * x + viewMatrix[6] * y + viewMatrix[10] * z + viewMatrix[14];
  const vw = viewMatrix[3] * x + viewMatrix[7] * y + viewMatrix[11] * z + viewMatrix[15];

  // Apply projection matrix
  const px = projMatrix[0] * vx + projMatrix[4] * vy + projMatrix[8] * vz + projMatrix[12] * vw;
  const py = projMatrix[1] * vx + projMatrix[5] * vy + projMatrix[9] * vz + projMatrix[13] * vw;
  const pw = projMatrix[3] * vx + projMatrix[7] * vy + projMatrix[11] * vz + projMatrix[15] * vw;

  // Perspective divide → NDC → [0,1] range
  return [px / pw, py / pw];
}

// ============================================================
// Utility: Point-in-Polygon (Ray Casting)
// ============================================================

function pointInPolygon(
  x: number, y: number,
  polygon: [number, number][]
): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

// ============================================================
// Expose API via Comlink
// ============================================================

const api = {
  init,
  subtractMesh,
  filterPointCloud,
};

expose(api);

export type SlicingWorkerAPI = typeof api;
```

---

## Worker API Wrapper: `slicing.api.ts`

```typescript
// src/workers/slicing.api.ts

import { wrap, type Remote } from 'comlink';
import type { SlicingWorkerAPI } from './slicing.worker';

let worker: Worker | null = null;
let api: Remote<SlicingWorkerAPI> | null = null;
let initialized = false;

/**
 * Get the slicing worker API (singleton, lazy-initialized).
 * Call init() before any other method.
 */
export function getSlicingWorker(): Remote<SlicingWorkerAPI> {
  if (!worker) {
    worker = new Worker(
      new URL('./slicing.worker.ts', import.meta.url),
      { type: 'module' }
    );
    api = wrap<SlicingWorkerAPI>(worker);
  }
  return api!;
}

/**
 * Initialize the slicing worker (loads WASM).
 * Safe to call multiple times — will only init once.
 */
export async function initSlicingWorker(): Promise<void> {
  if (initialized) return;
  const workerAPI = getSlicingWorker();
  await workerAPI.init();
  initialized = true;
}

/**
 * Terminate the worker and clean up resources.
 */
export function terminateSlicingWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    api = null;
    initialized = false;
  }
}
```

---

## Geometry Serialization: `workerGeometry.ts`

```typescript
// src/utils/workerGeometry.ts

import * as THREE from 'three';
import type { HistoryEntry, ModelType } from '../types/store';

/**
 * Serialize a BufferGeometry into transferable arrays for worker communication
 * or undo/redo storage.
 */
export function serializeGeometry(
  geometry: THREE.BufferGeometry,
  type: ModelType
): HistoryEntry {
  const positions = (geometry.attributes.position.array as Float32Array).slice();
  const indices = geometry.index
    ? (geometry.index.array as Uint32Array).slice()
    : null;

  return { positions, indices, type };
}

/**
 * Deserialize a HistoryEntry back into a BufferGeometry.
 */
export function deserializeGeometry(entry: HistoryEntry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',
    new THREE.Float32BufferAttribute(entry.positions, 3)
  );
  if (entry.indices) {
    geometry.setIndex(new THREE.BufferAttribute(entry.indices, 1));
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Generate tool geometry (BufferGeometry) from tool type and transform.
 * Returns serialized positions and indices ready for the worker.
 */
export function generateToolGeometry(
  toolType: string,
  transform: { position: number[]; rotation: number[]; scale: number[] }
): { positions: Float32Array; indices: Uint32Array } {
  let geometry: THREE.BufferGeometry;

  switch (toolType) {
    case 'box':
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
    case 'sphere':
      geometry = new THREE.SphereGeometry(0.5, 32, 32);
      break;
    case 'cylinder':
      geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
      break;
    default:
      throw new Error(`Unknown tool type: ${toolType}`);
  }

  // Apply transform
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(...transform.position),
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...transform.rotation)
    ),
    new THREE.Vector3(...transform.scale)
  );
  geometry.applyMatrix4(matrix);

  // Ensure indexed geometry
  if (!geometry.index) {
    geometry = geometry.toNonIndexed();
    // Re-index for manifold
    const posAttr = geometry.attributes.position;
    const indexArray = new Uint32Array(posAttr.count);
    for (let i = 0; i < posAttr.count; i++) indexArray[i] = i;
    geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
  }

  const positions = (geometry.attributes.position.array as Float32Array).slice();
  const indices = (geometry.index!.array as Uint32Array).slice();

  geometry.dispose();

  return { positions, indices };
}
```

---

## Tool-Specific Geometry for Point Cloud Filtering

```typescript
// src/utils/toolParams.ts

import * as THREE from 'three';

/**
 * Convert the Zustand tool state into worker-compatible parameters
 * for point cloud filtering.
 */
export function computeToolParams(
  toolType: string,
  transform: { position: number[]; rotation: number[]; scale: number[] }
) {
  const [px, py, pz] = transform.position;
  const [sx, sy, sz] = transform.scale;

  switch (toolType) {
    case 'box':
      return {
        min: [px - sx / 2, py - sy / 2, pz - sz / 2] as [number, number, number],
        max: [px + sx / 2, py + sy / 2, pz + sz / 2] as [number, number, number],
      };

    case 'sphere':
      return {
        center: [px, py, pz] as [number, number, number],
        radius: Math.max(sx, sy, sz) / 2,
      };

    case 'cylinder':
      return {
        center: [px, py, pz] as [number, number, number],
        radius: Math.max(sx, sz) / 2,
        height: sy,
        axis: [0, 1, 0] as [number, number, number], // Y-up default
      };

    default:
      throw new Error(`Unsupported point cloud tool: ${toolType}`);
  }
}
```

---

## Clipping Plane Computation

```typescript
// src/hooks/useClippingPlanes.ts

import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store/useStore';

/**
 * Compute Three.js clipping planes from the current cutting tool
 * for real-time visual preview (no geometry mutation).
 */
export function useClippingPlanes(): THREE.Plane[] {
  const activeTool = useStore(s => s.tool.activeTool);
  const transform = useStore(s => s.tool.transform);

  return useMemo(() => {
    if (!activeTool) return [];

    const [px, py, pz] = transform.position;
    const [sx, sy, sz] = transform.scale;

    switch (activeTool) {
      case 'box':
        // 6 planes forming the inside of a box
        return [
          new THREE.Plane(new THREE.Vector3(1, 0, 0), -(px - sx / 2)),   // Left
          new THREE.Plane(new THREE.Vector3(-1, 0, 0), (px + sx / 2)),   // Right
          new THREE.Plane(new THREE.Vector3(0, 1, 0), -(py - sy / 2)),   // Bottom
          new THREE.Plane(new THREE.Vector3(0, -1, 0), (py + sy / 2)),   // Top
          new THREE.Plane(new THREE.Vector3(0, 0, 1), -(pz - sz / 2)),   // Front
          new THREE.Plane(new THREE.Vector3(0, 0, -1), (pz + sz / 2)),   // Back
        ];

      case 'sphere':
        // Approximate with 6 tangent planes (visual-only approximation)
        const r = Math.max(sx, sy, sz) / 2;
        return [
          new THREE.Plane(new THREE.Vector3(1, 0, 0), -(px - r)),
          new THREE.Plane(new THREE.Vector3(-1, 0, 0), (px + r)),
          new THREE.Plane(new THREE.Vector3(0, 1, 0), -(py - r)),
          new THREE.Plane(new THREE.Vector3(0, -1, 0), (py + r)),
          new THREE.Plane(new THREE.Vector3(0, 0, 1), -(pz - r)),
          new THREE.Plane(new THREE.Vector3(0, 0, -1), (pz + r)),
        ];

      case 'plane':
        // Single infinite plane
        return [
          new THREE.Plane(new THREE.Vector3(0, 1, 0), -py),
        ];

      default:
        return [];
    }
  }, [activeTool, transform]);
}
```

---

## Cross-Origin Isolation Headers

Required for `SharedArrayBuffer` (optional performance optimization):

```typescript
// vite.config.ts (partial)
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

For Vercel deployment, add a `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

---

## Performance Considerations

| Strategy | Detail |
|---|---|
| **Transferable Objects** | Always transfer `ArrayBuffer` ownership between main thread and worker to avoid copy overhead. |
| **Lazy WASM Init** | Only load manifold3d WASM when the user first triggers a slice operation. |
| **Worker Reuse** | Single worker instance is reused for all operations (singleton pattern). |
| **Chunked Processing** | For very large point clouds (>5M points), process in chunks of 500K with progress reporting. |
| **Memory Cleanup** | Always call `.delete()` on Manifold objects to free WASM heap memory. |
