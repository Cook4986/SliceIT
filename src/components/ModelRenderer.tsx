import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { useClippingPlanes } from '../hooks/useClippingPlanes';
import { MATERIALS } from '../config/theme';

export function ModelRenderer() {
  const geometry = useStore(s => s.model.geometry);
  const modelType = useStore(s => s.model.type);
  const activeTool = useStore(s => s.tool.activeTool);
  const preserveTextures = useStore(s => s.ui.preserveTextures);
  const originalMaterial = useStore(s => s.model.originalMaterial);
  const clippingPlanes = useClippingPlanes();

  // Track whether we have a usable original material
  const hasOriginalMaterial = !!(preserveTextures && originalMaterial);

  // Default theme material — always available as fallback
  const themeMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: MATERIALS.model.color,
      metalness: MATERIALS.model.metalness,
      roughness: MATERIALS.model.roughness,
      flatShading: false,
      side: THREE.DoubleSide,
      clipIntersection: activeTool === 'box',
    });
  }, [activeTool]);

  // Prepare the original material for viewport rendering when texture mode is on.
  // Clone it so viewport-specific properties (clipping, side) don't pollute
  // the stored original, which is also used for export.
  const texturedMaterial = useMemo(() => {
    if (!hasOriginalMaterial) return null;
    const source = Array.isArray(originalMaterial) ? originalMaterial[0] : originalMaterial!;
    const cloned = source.clone();
    cloned.side = THREE.DoubleSide;
    return cloned;
  }, [hasOriginalMaterial, originalMaterial]);

  // Dispose each clone when it's replaced or the renderer unmounts.
  useEffect(() => {
    if (!texturedMaterial) return;
    return () => texturedMaterial.dispose();
  }, [texturedMaterial]);

  const pointsMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      color: MATERIALS.pointCloud.color,
      size: MATERIALS.pointCloud.size,
      sizeAttenuation: true,
    });
  }, []);

  // Resolve which material to actually render with
  const activeMaterial = texturedMaterial || themeMaterial;

  // Sync clippingPlanes onto whichever material is active
  useEffect(() => {
    activeMaterial.clippingPlanes = clippingPlanes.length > 0 ? clippingPlanes : null;
    if ('clipIntersection' in activeMaterial) {
      (activeMaterial as THREE.MeshStandardMaterial).clipIntersection = activeTool === 'box';
    }
    activeMaterial.needsUpdate = true;
  }, [clippingPlanes, activeMaterial, activeTool]);

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
      material={activeMaterial} 
      castShadow
      receiveShadow
    />
  );
}
