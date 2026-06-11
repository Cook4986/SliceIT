/**
 * Pure geometry helpers shared by the slicing worker.
 *
 * Extracted from slicing.worker.ts so they can be unit-tested without
 * spinning up a worker (Comlink's `expose()` requires a worker context).
 */

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Result of a CSG operation, ready to rebuild a BufferGeometry. */
export interface SliceResult {
  positions: Float32Array;
  indices: Uint32Array;
  uvs: Float32Array | null;
}

/** Vertex-weld tolerance used before CSG (repairs non-indexed geometry). */
export const WELD_TOLERANCE = 1e-4;

/** Edge length of the half-space cutter cube used for plane cuts. */
export const HALF_SPACE_SIZE = 10000;

/**
 * Pack positions (+ optional UVs) into a flat vertProperties array for Manifold.
 * Returns { numProp, vertProperties } ready to feed into the Manifold constructor.
 */
export function packVertProperties(
  positions: Float32Array,
  uvs: Float32Array | null
): { numProp: number; vertProperties: Float32Array } {
  const vertCount = positions.length / 3;
  if (uvs && uvs.length === vertCount * 2) {
    // numProp=5: x, y, z, u, v
    const vp = new Float32Array(vertCount * 5);
    for (let i = 0; i < vertCount; i++) {
      vp[i * 5 + 0] = positions[i * 3 + 0];
      vp[i * 5 + 1] = positions[i * 3 + 1];
      vp[i * 5 + 2] = positions[i * 3 + 2];
      vp[i * 5 + 3] = uvs[i * 2 + 0];
      vp[i * 5 + 4] = uvs[i * 2 + 1];
    }
    return { numProp: 5, vertProperties: vp };
  }
  // numProp=3: positions only (default / texture-less mode)
  return {
    numProp: 3,
    vertProperties: positions instanceof Float32Array ? positions : new Float32Array(positions),
  };
}

/**
 * Unpack Manifold result vertProperties back to separate positions + uvs arrays.
 */
export function unpackVertProperties(
  vertProperties: Float32Array,
  numProp: number
): { positions: Float32Array; uvs: Float32Array | null } {
  const vertCount = vertProperties.length / numProp;
  const positions = new Float32Array(vertCount * 3);
  let uvs: Float32Array | null = null;

  if (numProp >= 5) {
    uvs = new Float32Array(vertCount * 2);
    for (let i = 0; i < vertCount; i++) {
      positions[i * 3 + 0] = vertProperties[i * numProp + 0];
      positions[i * 3 + 1] = vertProperties[i * numProp + 1];
      positions[i * 3 + 2] = vertProperties[i * numProp + 2];
      uvs[i * 2 + 0] = vertProperties[i * numProp + 3];
      uvs[i * 2 + 1] = vertProperties[i * numProp + 4];
    }
  } else {
    for (let i = 0; i < vertCount; i++) {
      positions[i * 3 + 0] = vertProperties[i * numProp + 0];
      positions[i * 3 + 1] = vertProperties[i * numProp + 1];
      positions[i * 3 + 2] = vertProperties[i * numProp + 2];
    }
  }

  return { positions, uvs };
}

/**
 * Strip triangles whose vertices are outside the original model bounds.
 * The half-space cutter can leave slivers/spikes at its boundaries after
 * boolean subtraction. This clamps the output to the original model's
 * bounding sphere + a 50% margin.
 */
export function clampToOriginalBounds(
  positions: Float32Array,
  indices: Uint32Array,
  modelPositions: Float32Array
): { positions: Float32Array; indices: Uint32Array } {
  // Compute bounding sphere of the original model
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(modelPositions, 3));
  geo.computeBoundingSphere();
  const center = geo.boundingSphere!.center;
  const radius = geo.boundingSphere!.radius * 1.5; // 50% margin
  const r2 = radius * radius;
  geo.dispose();

  // Filter triangles: keep only those where ALL 3 vertices are inside bounds
  const keptIndices: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    let keep = true;
    for (let j = 0; j < 3; j++) {
      const vi = indices[i + j];
      const x = positions[vi * 3] - center.x;
      const y = positions[vi * 3 + 1] - center.y;
      const z = positions[vi * 3 + 2] - center.z;
      if (x * x + y * y + z * z > r2) { keep = false; break; }
    }
    if (keep) {
      keptIndices.push(indices[i], indices[i + 1], indices[i + 2]);
    }
  }

  if (keptIndices.length === indices.length) {
    return { positions, indices }; // Nothing filtered
  }

  return { positions, indices: new Uint32Array(keptIndices) };
}

/**
 * Ensure geometry is indexed. Non-indexed formats (STL, many OBJ exports)
 * need vertex-welding so Manifold can reason about connectivity.
 * Also carries UVs through the merge when available.
 */
export function ensureIndexed(
  positions: Float32Array,
  indices: Uint32Array | null,
  uvs: Float32Array | null
): { positions: Float32Array; indices: Uint32Array; uvs: Float32Array | null } {
  if (indices && indices.length > 0) {
    return { positions, indices, uvs };
  }

  const tempGeo = new THREE.BufferGeometry();
  tempGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (uvs) {
    tempGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  // mergeVertices welds duplicate verts within tolerance → manifold-friendly
  const indexed = mergeVertices(tempGeo, WELD_TOLERANCE);
  indexed.computeVertexNormals();

  const mergedUVs = indexed.attributes.uv
    ? indexed.attributes.uv.array as Float32Array
    : null;

  return {
    positions: indexed.attributes.position.array as Float32Array,
    indices: indexed.index!.array as Uint32Array,
    uvs: mergedUVs,
  };
}
