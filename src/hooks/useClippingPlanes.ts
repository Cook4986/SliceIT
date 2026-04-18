import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store/useStore';

/**
 * Hook that computes clipping planes based on the current active tool
 * and its world transform.
 * For now, supports 'box' and 'plane' tools.
 */
export function useClippingPlanes() {
  const activeTool = useStore(s => s.tool.activeTool);
  const transform = useStore(s => s.tool.transform);

  return useMemo(() => {
    if (!activeTool || activeTool === 'knife' || activeTool === 'lasso') {
      return [];
    }

    // Create a matrix from current transform
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3(...transform.position);
    const rotation = new THREE.Euler(...transform.rotation);
    const scale = new THREE.Vector3(...transform.scale);
    matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);

    if (activeTool === 'plane') {
      // Single plane at Y=0 in tool space, normal is [0, 1, 0]
      const localNormal = new THREE.Vector3(0, 1, 0);
      const worldPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        localNormal,
        new THREE.Vector3(0, 0, 0)
      );
      worldPlane.applyMatrix4(matrix);
      // We want to keep the part BELOW the plane for "negative space" logic?
      // Actually, if we use it for subtraction, we want to CLIP out the tool's volume.
      // For a plane, subtraction means everything behind the plane normal is removed?
      // Let's negate it to CLIP the volume "inside" the tool.
      worldPlane.negate();
      return [worldPlane];
    }

    if (activeTool === 'box') {
      // Create 6 planes for the box subtraction.
      // We start with planes facing outward, then negate them so they face INWARD.
      // A pixel inside the box will have distance < 0 for ALL 6 inward-facing planes.
      // Combined with clipIntersection = true in the material, this clips exactly the box volume.
      return [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), 0.5),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.5),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.5),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.5),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.5),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.5),
      ].map(p => {
        const worldPlane = p.applyMatrix4(matrix);
        return worldPlane.negate(); // Flip normal so inside is < 0
      });
    }

    // Sphere/Cylinder don't work with simple planes.
    // We could approximate with many planes or use a shader.
    // For now, return empty or a bounding box for preview.
    return [];
  }, [activeTool, transform]);
}
