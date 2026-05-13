import { useMemo, useEffect, useRef } from 'react';
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
  // We clone it once to avoid mutating the stored material (which is also used for export).
  const clonedOriginalRef = useRef<THREE.Material | null>(null);

  const texturedMaterial = useMemo(() => {
    if (!hasOriginalMaterial) {
      // Dispose any previous clone
      if (clonedOriginalRef.current) {
        clonedOriginalRef.current.dispose();
        clonedOriginalRef.current = null;
      }
      return null;
    }

    // Clone the material so viewport-specific properties (clipping, side)
    // don't pollute the stored original used for export.
    const source = Array.isArray(originalMaterial) ? originalMaterial[0] : originalMaterial;
    const cloned = source.clone();

    // Ensure it works well in the viewport
    cloned.side = THREE.DoubleSide;
    if (cloned instanceof THREE.MeshStandardMaterial || cloned instanceof THREE.MeshPhysicalMaterial) {
      // Keep the original's textures, colors, and PBR settings as-is
    } else if (cloned instanceof THREE.MeshBasicMaterial) {
      // MeshBasicMaterial is fine — it just won't react to lighting
    }

    // Dispose previous clone
    if (clonedOriginalRef.current && clonedOriginalRef.current !== cloned) {
      clonedOriginalRef.current.dispose();
    }
    clonedOriginalRef.current = cloned;

    return cloned;
  }, [hasOriginalMaterial, originalMaterial]);

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

  // Cleanup cloned material on unmount
  useEffect(() => {
    return () => {
      if (clonedOriginalRef.current) {
        clonedOriginalRef.current.dispose();
        clonedOriginalRef.current = null;
      }
    };
  }, []);

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
