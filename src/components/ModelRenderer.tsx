import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { useClippingPlanes } from '../hooks/useClippingPlanes';
import { MATERIALS } from '../config/theme';

export function ModelRenderer() {
  const geometry = useStore(s => s.model.geometry);
  const modelType = useStore(s => s.model.type);
  const activeTool = useStore(s => s.tool.activeTool);
  const clippingPlanes = useClippingPlanes();

  const meshMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: MATERIALS.model.color,
      metalness: MATERIALS.model.metalness,
      roughness: MATERIALS.model.roughness,
      flatShading: false,
      side: THREE.DoubleSide,
      // clippingPlanes will be set in useEffect
      clipIntersection: activeTool === 'box', // Only for box are we intersecting planes?
    });
  }, [activeTool]);

  const pointsMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      color: MATERIALS.pointCloud.color,
      size: MATERIALS.pointCloud.size,
      sizeAttenuation: true,
      // Some simple depth clipping for point clouds
    });
  }, []);

  // Sync clippingPlanes when they change
  useEffect(() => {
    meshMaterial.clippingPlanes = clippingPlanes.length > 0 ? clippingPlanes : null;
    meshMaterial.clipIntersection = activeTool === 'box'; // Intersection for tool "volume"
    meshMaterial.needsUpdate = true;
  }, [clippingPlanes, meshMaterial, activeTool]);

  if (!geometry) return null;

  if (modelType === 'pointcloud') {
    return (
      <points geometry={geometry}>
        <primitive object={pointsMaterial} attach="material" />
      </points>
    );
  }

  return (
    <mesh 
      geometry={geometry} 
      material={meshMaterial} 
      castShadow
      receiveShadow
    />
  );
}
