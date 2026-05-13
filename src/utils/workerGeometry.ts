import * as THREE from 'three';
import type { GeometryEntry, ModelType } from '../types/store';

/**
 * Serialize a BufferGeometry into a GeometryEntry for undo/redo storage.
 * Now preserves UV coordinates when present for texture-mode support.
 */
export function serializeGeometry(
  geometry: THREE.BufferGeometry,
  type: ModelType
): GeometryEntry {
  const positions = new Float32Array(geometry.attributes.position.array);
  const normals = geometry.attributes.normal
    ? new Float32Array(geometry.attributes.normal.array)
    : null;
  const indices = geometry.index
    ? new Uint32Array(geometry.index.array)
    : null;
  const uvs = geometry.attributes.uv
    ? new Float32Array(geometry.attributes.uv.array)
    : null;

  return { kind: 'geometry', positions, indices, normals, uvs, type };
}

/**
 * Deserialize a GeometryEntry back into a BufferGeometry.
 */
export function deserializeGeometry(entry: GeometryEntry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(entry.positions, 3));

  if (entry.normals) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(entry.normals, 3));
  }

  if (entry.indices) {
    geometry.setIndex(new THREE.BufferAttribute(entry.indices, 1));
  }

  if (entry.uvs) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(entry.uvs, 2));
  }

  if (!entry.normals) {
    geometry.computeVertexNormals();
  }

  geometry.computeBoundingSphere();
  return geometry;
}


