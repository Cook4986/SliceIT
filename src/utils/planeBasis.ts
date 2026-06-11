import * as THREE from 'three';

/**
 * Derive the knife plane's orthonormal basis from its anchor points.
 *
 *   local X = edge (P1→P2) — the visible cut line
 *   local Y = depth — extends from camera toward horizon
 *   local Z = normal — perpendicular to both
 *
 * Ortho (2-click): depth comes from the fixed camera direction.
 * Perspective (3-click): depth comes from P3. When P3 ≈ P2 (cursor hasn't
 * moved yet) the cross product is degenerate and the camera direction is
 * used as a fallback so the preview never collapses.
 *
 * Returns null when the points cannot define a plane (coincident anchors).
 * Used by both the live preview (CuttingPlane) and the deploy-time store
 * write (addAnchor) so the deployed plane always matches the preview.
 */
export function planeBasisQuaternion(
  points: THREE.Vector3[],
  isOrthoView: boolean,
  viewPosition: [number, number, number]
): THREE.Quaternion | null {
  if (points.length < 2) return null;

  const p0 = points[0];
  const p1 = points[1];
  const edge = new THREE.Vector3().subVectors(p1, p0).normalize();
  if (edge.lengthSq() < 1e-8) return null;

  const camDir = new THREE.Vector3(...viewPosition).normalize();
  let normal: THREE.Vector3;

  if (!isOrthoView && points.length >= 3) {
    const v2 = new THREE.Vector3().subVectors(points[2], p0).normalize();
    normal = new THREE.Vector3().crossVectors(edge, v2).normalize();
    if (normal.lengthSq() < 0.0001) {
      normal = new THREE.Vector3().crossVectors(edge, camDir).normalize();
    }
  } else {
    normal = new THREE.Vector3().crossVectors(edge, camDir).normalize();
  }

  if (normal.lengthSq() < 0.0001) return null;

  const depth = new THREE.Vector3().crossVectors(normal, edge).normalize();
  const m = new THREE.Matrix4().makeBasis(edge, depth, normal);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}
