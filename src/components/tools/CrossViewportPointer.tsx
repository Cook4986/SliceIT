import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../../store/useStore';
import { Line } from '@react-three/drei';

export function PointerTracker({ isActive }: { isActive: boolean }) {
  const setSharedPointer = useStore(s => s.setSharedPointer);
  const { raycaster, mouse, camera } = useThree();

  const prevMouse = useRef(new THREE.Vector2(-Infinity, -Infinity));

  useFrame(() => {
    if (!isActive) return;

    // Only recalculate if mouse moved significantly
    if (prevMouse.current.distanceToSquared(mouse) < 0.0001) return;
    prevMouse.current.copy(mouse);

    // Build the raycast plane perpendicular to the camera's view direction.
    // This ensures pointer tracking works in ALL viewport orientations
    // (Top, Right, Back, etc.), not just front-facing cameras.
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const plane = new THREE.Plane(forward, 0); // through origin, facing camera
    const target = new THREE.Vector3();
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.ray.intersectPlane(plane, target);
    
    if (hit) {
      setSharedPointer([target.x, target.y, target.z]);
    } else {
      setSharedPointer(null);
    }
  });

  return null;
}

export function PointerRenderer() {
  const sharedPointer = useStore(s => s.sharedPointer);
  const activeTool = useStore(s => s.tool.activeTool);
  const transform = useStore(s => s.tool.transform);

  if (!sharedPointer) return null;

  return (
    <group>
      <mesh position={sharedPointer}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshBasicMaterial color="#00FFFF" depthTest={false} transparent opacity={0.8} />
      </mesh>

      {activeTool && (
        <Line
          points={[
            transform.position,
            sharedPointer,
          ]}
          color="#FF00FF"
          lineWidth={2}
          dashed={true}
          dashSize={0.5}
          dashScale={1}
          dashOffset={0}
          depthTest={false}
          transparent
          opacity={0.7}
        />
      )}
    </group>
  );
}
