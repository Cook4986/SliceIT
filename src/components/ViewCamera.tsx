import { useRef, useEffect, useState } from 'react';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { useStore } from '../store/useStore';
import type { ViewConfig } from '../types/store';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

interface ViewCameraProps {
  config: ViewConfig;
  viewIndex: number;
}

/**
 * ViewCamera manages the R3F camera and its synchronization across viewports.
 * It uses a unified 'worldHeight' synchronization strategy so that Perspective
 * and Orthographic views always display the model at the same perceived size.
 */
export function ViewCamera({ config, viewIndex }: ViewCameraProps) {
  const geometry = useStore(s => s.model.geometry);
  const activeViewIndex = useStore(s => s.activeViewIndex);
  const cameraSync = useStore(s => s.cameraSync);
  const setCameraSync = useStore(s => s.setCameraSync);
  
  const isActive = activeViewIndex === viewIndex;
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraRef = useRef<THREE.Camera>(null);
  const { invalidate, viewport } = useThree();
  
  const [isWindowFocused, setIsWindowFocused] = useState(document.hasFocus());
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    const onFocus = () => setIsWindowFocused(true);
    const onBlur = () => setIsWindowFocused(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // --- Constants ---
  const FOV = 45;
  const tanHalfFOV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  
  // To keep models large, we use a small BASE_HEIGHT. 
  // Radius ~1 models will take up ~33% of a BASE_HEIGHT=6 view.
  const BASE_HEIGHT = 6;
  const DEFAULT_DISTANCE = BASE_HEIGHT / (2 * tanHalfFOV); // ~7.24
  const ORTHO_HALF = BASE_HEIGHT / 2;

  // Auto-fit function
  const fitCamera = () => {
    if (!controlsRef.current || !cameraRef.current) return;
    const controls = controlsRef.current;
    const cam = cameraRef.current;
    
    controls.target.set(0, 0, 0);
    const direction = new THREE.Vector3(...config.position).normalize();
    
    // Position camera at default distance
    cam.position.copy(direction.multiplyScalar(DEFAULT_DISTANCE));
    cam.lookAt(0, 0, 0);
    
    if (cam instanceof THREE.OrthographicCamera) {
      cam.zoom = 1;
    }
    if (cam instanceof THREE.Camera) cam.updateMatrixWorld();
    
    controls.update();
    invalidate();
  };

  // Trigger fit on geometry change
  useEffect(() => {
    if (geometry) {
        fitCamera();
        const interval = setInterval(() => invalidate(), 50);
        const timeout = setTimeout(() => {
            clearInterval(interval);
            fitCamera();
        }, 500);
        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }
  }, [geometry]);

  // Bug 1 fix: if geometry was already loaded before this Canvas View mounted
  // (happens because MainContent delays Canvas behind a requestAnimationFrame),
  // re-run fitCamera once on mount so the model renders immediately.
  useEffect(() => {
    if (geometry) {
      fitCamera();
      invalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * PUBLISHER:
   * Maps current view state to a universal 'zoomScale'.
   */
  useEffect(() => {
    if (!isActive || !isWindowFocused || !controlsRef.current || !cameraRef.current) return;
    
    const controls = controlsRef.current;
    const camera = cameraRef.current;

    const onChange = () => {
      if (isUpdatingRef.current) return;

      let zoomScale = 1;
      if (camera instanceof THREE.OrthographicCamera) {
        zoomScale = camera.zoom;
      } else {
        const distance = controls.getDistance();
        const currentHeight = 2 * distance * tanHalfFOV;
        zoomScale = BASE_HEIGHT / currentHeight;
      }
      
      setCameraSync({
        target: [controls.target.x, controls.target.y, controls.target.z],
        zoomScale: zoomScale,
      });
    };
    
    controls.addEventListener('change', onChange);
    return () => controls.removeEventListener('change', onChange);
  }, [isActive, isWindowFocused, setCameraSync, tanHalfFOV]);

  /**
   * CONSUMER:
   */
  useFrame(() => {
    if (!isActive || !isWindowFocused) {
      if (!controlsRef.current || !cameraRef.current) return;
      
      const controls = controlsRef.current;
      const cam = cameraRef.current;
      const zs = cameraSync.zoomScale || 1;

      isUpdatingRef.current = true;

      // Sync target
      controls.target.set(cameraSync.target[0], cameraSync.target[1], cameraSync.target[2]);
      
      // Sync Scale
      if (cam instanceof THREE.PerspectiveCamera) {
        const targetDist = BASE_HEIGHT / (zs * 2 * tanHalfFOV);
        const direction = new THREE.Vector3().subVectors(cam.position, controls.target).normalize();
        cam.position.copy(direction.multiplyScalar(targetDist).add(controls.target));
      } else if (cam instanceof THREE.OrthographicCamera) {
        cam.zoom = zs;
        cam.updateProjectionMatrix();
      }

      controls.update();
      invalidate();
      isUpdatingRef.current = false;
    }
  });

  return (
    <group>
      {/* Invisible plane to catch all pointer events for this view */}
      {/* Bug 2 fix: use onClick (not onPointerDown) so OrbitControls' drag-start
          gesture on pointerdown doesn't compete. onClick fires only after a
          genuine click (down+up with no drag), matching what users expect.
          stopPropagation is called unconditionally when knife/lasso is active
          so every click is fully consumed and subsequent anchors register on
          the first attempt. */}
      <mesh
        visible={false}
        position={[0, 0, 0]}
        quaternion={new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(...config.position).normalize()
        )}
        onClick={(e) => {
            const state = useStore.getState();
            if (state.tool.activeTool === 'knife' || state.tool.activeTool === 'lasso') {
                // Always consume the click when a drawing tool is active
                e.stopPropagation();
                if (state.tool.placementIndex !== -1 && state.sharedPointer) {
                    state.setActiveViewIndex(viewIndex);
                    state.addAnchor(state.sharedPointer);
                }
            }
        }}
      >
        <planeGeometry args={[1000, 1000]} />
      </mesh>

      {config.cameraType === 'orthographic' ? (
        <group>
          <OrthographicCamera
            ref={cameraRef as any}
            makeDefault
            manual
            left={-ORTHO_HALF * viewport.aspect}
            right={ORTHO_HALF * viewport.aspect}
            top={ORTHO_HALF}
            bottom={-ORTHO_HALF}
            near={0.1}
            far={100}
            zoom={cameraSync.zoomScale || 1}
          />
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping={false}
            target={[0, 0, 0]}
            enableRotate={false}
            enableZoom={isActive}
            mouseButtons={{
                LEFT: THREE.MOUSE.PAN, 
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN
            }}
          />
        </group>
      ) : (
        <group>
          <PerspectiveCamera
            ref={cameraRef as any}
            makeDefault
            fov={FOV}
            near={0.1}
            far={100}
          />
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping={false}
            target={[0, 0, 0]}
            enableRotate={isActive}
            enableZoom={isActive}
          />
        </group>
      )}
    </group>
  );
}
