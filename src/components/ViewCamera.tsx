import { useRef, useEffect } from 'react';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../store/useStore';
import type { ViewConfig } from '../types/store';
import { DEFAULT_CAMERA_DISTANCE } from '../config/constants';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

interface ViewCameraProps {
  config: ViewConfig;
  viewIndex: number;
}

export function ViewCamera({ config, viewIndex }: ViewCameraProps) {
  const boundingSphere = useStore(s => s.model.boundingSphere);
  const activeViewIndex = useStore(s => s.activeViewIndex);
  const cameraSync = useStore(s => s.cameraSync);
  const setCameraSync = useStore(s => s.setCameraSync);
  
  const isActive = activeViewIndex === viewIndex;
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraRef = useRef<THREE.Camera>(null);

  // Camera distance based on model size
  const radius = boundingSphere?.radius ?? 1;
  const D = Math.max(radius * 3, DEFAULT_CAMERA_DISTANCE);

  const position: [number, number, number] = [
    config.position[0] * D,
    config.position[1] * D,
    config.position[2] * D,
  ];

  const orthoHalf = radius * 1.2 || 3;

  // Active view: Publish camera sync state
  useEffect(() => {
    if (!isActive || !controlsRef.current || !cameraRef.current) return;
    
    const controls = controlsRef.current;
    
    // Broadcast changes from the active viewport
    const onChange = () => {
      setCameraSync({
        target: [controls.target.x, controls.target.y, controls.target.z],
        zoom: (cameraRef.current as THREE.OrthographicCamera | THREE.PerspectiveCamera)?.zoom || 1,
      });
    };
    
    controls.addEventListener('change', onChange);
    return () => controls.removeEventListener('change', onChange);
  }, [isActive, setCameraSync]);

  // Inactive views: Consume camera sync state
  useFrame(() => {
    if (!isActive && controlsRef.current && cameraRef.current) {
      if (controlsRef.current.target.x !== cameraSync.target[0] ||
          controlsRef.current.target.y !== cameraSync.target[1] ||
          controlsRef.current.target.z !== cameraSync.target[2]) {
        controlsRef.current.target.set(cameraSync.target[0], cameraSync.target[1], cameraSync.target[2]);
        controlsRef.current.update();
      }
      
      const cam = cameraRef.current as THREE.OrthographicCamera | THREE.PerspectiveCamera;
      
      if (cam.zoom !== cameraSync.zoom) {
        cam.zoom = cameraSync.zoom;
        cam.updateProjectionMatrix();
      }
    }
  });

  if (config.cameraType === 'orthographic') {
    return (
      <>
        <OrthographicCamera
          ref={cameraRef as any}
          makeDefault
          position={position}
          up={config.up}
          left={-orthoHalf}
          right={orthoHalf}
          top={orthoHalf}
          bottom={-orthoHalf}
          near={0.1}
          far={D * 4}
          zoom={1}
        />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.12}
          target={[0, 0, 0]}
          enableRotate={isActive}
          enableZoom={true}
        />
      </>
    );
  }

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef as any}
        makeDefault
        position={position}
        up={config.up}
        fov={45}
        near={0.1}
        far={D * 4}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        target={[0, 0, 0]}
        enableRotate={isActive}
        enableZoom={true}
      />
    </>
  );
}
