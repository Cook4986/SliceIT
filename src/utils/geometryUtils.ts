import * as THREE from 'three';
import type { ModelType } from '../types/store';

/**
 * Detect whether a geometry is a mesh or point cloud.
 * Meshes have an index buffer or face-like structure; point clouds have only vertices.
 */
export function detectModelType(geometry: THREE.BufferGeometry): ModelType {
  if (geometry.index && geometry.index.count > 0) {
    return 'mesh';
  }

  // Check if normals exist — if yes, likely a mesh even without indices
  const normals = geometry.getAttribute('normal');
  if (normals && normals.count > 0) {
    // Could be a mesh with non-indexed faces (e.g., STL)
    return 'mesh';
  }

  return 'pointcloud';
}

/**
 * Center geometry at the origin by translating to the center of its bounding box.
 */
export function centerGeometry(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return;

  const center = new THREE.Vector3();
  box.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);

  // Recompute after translation
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/**
 * Normalize the scale of the geometry so it fits within a specific target radius.
 * This ensures models of all sizes (tiny or huge) are visible and consistent for tools.
 */
export function normalizeScale(geometry: THREE.BufferGeometry, targetRadius: number = 5): number {
  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius ?? 1;
  const scale = targetRadius / radius;
  geometry.scale(scale, scale, scale);

  // Recompute after scaling
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  
  return scale;
}

/**
 * Compute a normalized bounding sphere distance for camera placement.
 * Returns the radius, or a minimum of 0.5 to avoid cameras being too close.
 */
export function getBoundingSphereRadius(geometry: THREE.BufferGeometry): number {
  geometry.computeBoundingSphere();
  return Math.max(geometry.boundingSphere?.radius ?? 1, 0.5);
}
