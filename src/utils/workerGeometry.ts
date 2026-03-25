import * as THREE from 'three';
import type { HistoryEntry, ModelType } from '../types/store';

/**
 * Serialize a BufferGeometry into transferable arrays for undo/redo storage.
 */
export function serializeGeometry(
  geometry: THREE.BufferGeometry,
  type: ModelType
): HistoryEntry {
  const positions = new Float32Array(geometry.attributes.position.array);
  const normals = geometry.attributes.normal
    ? new Float32Array(geometry.attributes.normal.array)
    : null;
  const indices = geometry.index
    ? new Uint32Array(geometry.index.array)
    : null;

  return { positions, indices, normals, type };
}

/**
 * Deserialize a HistoryEntry back into a BufferGeometry.
 */
export function deserializeGeometry(entry: HistoryEntry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(entry.positions, 3));

  if (entry.normals) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(entry.normals, 3));
  }

  if (entry.indices) {
    geometry.setIndex(new THREE.BufferAttribute(entry.indices, 1));
  }

  if (!entry.normals) {
    geometry.computeVertexNormals();
  }

  geometry.computeBoundingSphere();
  return geometry;
}
