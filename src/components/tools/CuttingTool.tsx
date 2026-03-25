import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import { useStore } from '../../store/useStore';
import { BoxCutter } from './BoxCutter';
import { SphereCutter } from './SphereCutter';
import { PlaneCutter } from './PlaneCutter';

/**
 * Main CuttingTool component that renders the active primitive
 * and handles TransformControls interaction.
 */
export function CuttingTool() {
  const activeTool = useStore(s => s.tool.activeTool);
  const transformMode = useStore(s => s.tool.transformMode);
  const toolTransform = useStore(s => s.tool.transform);
  const updateToolTransform = useStore(s => s.updateToolTransform);
  
  const groupRef = useRef<THREE.Group>(null);

  // Synchronize store transform to local group
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(...toolTransform.position);
      groupRef.current.rotation.set(...toolTransform.rotation);
      groupRef.current.scale.set(...toolTransform.scale);
    }
  }, [activeTool]); // Only on tool change to avoid loop, or handled by controls

  if (!activeTool || activeTool === 'knife' || activeTool === 'lasso') {
    return null;
  }

  const handleTransformChange = () => {
    if (groupRef.current) {
      const position = groupRef.current.position.toArray() as [number, number, number];
      const rotation = [
        groupRef.current.rotation.x,
        groupRef.current.rotation.y,
        groupRef.current.rotation.z,
      ] as [number, number, number];
      const scale = groupRef.current.scale.toArray() as [number, number, number];

      updateToolTransform({ position, rotation, scale });
    }
  };

  return (
    <>
      <group ref={groupRef} onPointerOver={() => {}}>
        {activeTool === 'box' && <BoxCutter />}
        {activeTool === 'sphere' && <SphereCutter />}
        {activeTool === 'plane' && <PlaneCutter />}
      </group>

      <TransformControls
        object={groupRef.current || undefined}
        mode={transformMode}
        onMouseUp={handleTransformChange}
        // Disable orbit controls while transforming (usually handled by Drei)
      />
    </>
  );
}
