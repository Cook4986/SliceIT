import * as THREE from 'three';

/**
 * Compute camera distance D from a bounding sphere radius.
 * The camera is positioned at D * direction to properly frame the model.
 */
export function computeCameraDistance(
  radius: number,
  fov: number = 50,
  _cameraType: 'orthographic' | 'perspective' = 'perspective'
): number {
  // For perspective: use FOV to calculate distance
  // For ortho: use radius * 1.5 for comfortable framing
  const fovRad = (fov * Math.PI) / 180;
  return radius / Math.sin(fovRad / 2) * 0.8;
}

/**
 * Compute orthographic camera frustum bounds from a bounding sphere radius.
 */
export function computeOrthoFrustum(radius: number): {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
} {
  const padding = radius * 1.3;
  return {
    left: -padding,
    right: padding,
    top: padding,
    bottom: -padding,
    near: 0.01,
    far: radius * 10,
  };
}

/**
 * Auto-fit a camera to a bounding sphere.
 */
export function autoFitCamera(
  camera: THREE.Camera,
  boundingSphere: THREE.Sphere,
  direction: [number, number, number]
): void {
  const radius = boundingSphere.radius || 2;
  const center = boundingSphere.center;

  if (camera instanceof THREE.PerspectiveCamera) {
    const dist = computeCameraDistance(radius, camera.fov, 'perspective');
    const dir = new THREE.Vector3(...direction).normalize();
    camera.position.copy(center).addScaledVector(dir, dist);
    camera.lookAt(center);
    camera.near = 0.01;
    camera.far = dist * 5;
    camera.updateProjectionMatrix();
  } else if (camera instanceof THREE.OrthographicCamera) {
    const frustum = computeOrthoFrustum(radius);
    camera.left = frustum.left;
    camera.right = frustum.right;
    camera.top = frustum.top;
    camera.bottom = frustum.bottom;
    camera.near = frustum.near;
    camera.far = frustum.far;

    const dist = radius * 3;
    const dir = new THREE.Vector3(...direction).normalize();
    camera.position.copy(center).addScaledVector(dir, dist);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }
}
