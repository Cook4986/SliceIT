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
      // 6 planes for the unit box
      const localPlanes = [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), 0.5),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.5),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.5),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.5),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.5),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.5),
      ];

      return localPlanes.map(p => {
        const worldPlane = p.clone().applyMatrix4(matrix);
        // Box subtraction clips everything INSIDE the box.
        // For clipIntersection to work, we need to show the intersection of local clippings?
        // Actually, for subtraction, we are clipping everything INSIDE the tool's volume.
        return worldPlane;
      });
    }

    // Sphere/Cylinder don't work with simple planes.
    // We could approximate with many planes or use a shader.
    // For now, return empty or a bounding box for preview.
    return [];
  }, [activeTool, transform]);
}
