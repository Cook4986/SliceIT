import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../../store/useStore';
import { Line } from '@react-three/drei';

/**
 * Tracks the cursor for the ACTIVE viewport only, and — critically — freezes
 * when the cursor leaves that viewport's window.
 *
 * Why we can't just use r3f's `pointer`: every drei <View> shares one pointer
 * vector, updated by whichever view's element is under the cursor. The active
 * view's tracker would otherwise re-project that shared pointer through its own
 * camera while the cursor is over a *different* panel (or travelling toward the
 * toolbar) — yanking the knife's rotation preview and ballooning the lasso
 * polygon. So we compute NDC against THIS view's own DOM rect and bail out when
 * the cursor is outside it, leaving the last in-view point in place.
 */
export function PointerTracker({ isActive, trackEl }: {
  isActive: boolean;
  trackEl: HTMLElement | null;
}) {
  const setSharedPointer = useStore(s => s.setSharedPointer);
  const { raycaster, camera } = useThree();

  const ndc = useRef(new THREE.Vector2());
  const insideActiveView = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (!isActive || !trackEl) {
      insideActiveView.current = false;
      return;
    }

    const onMove = (e: PointerEvent) => {
      const rect = trackEl.getBoundingClientRect();
      const within =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom;

      // Outside the active viewport → freeze (keep the last in-view point).
      if (!within) {
        insideActiveView.current = false;
        return;
      }

      ndc.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      insideActiveView.current = true;
      dirty.current = true;
    };

    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [isActive, trackEl]);

  useFrame(() => {
    if (!isActive || !insideActiveView.current || !dirty.current) return;
    dirty.current = false;

    // Raycast against a plane through the origin facing the camera so tracking
    // works in every viewport orientation (Top, Right, Back, ISO, …).
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const plane = new THREE.Plane(forward, 0);
    const target = new THREE.Vector3();
    raycaster.setFromCamera(ndc.current, camera);
    if (raycaster.ray.intersectPlane(plane, target)) {
      setSharedPointer([target.x, target.y, target.z]);
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
