import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import { useStore } from '../../store/useStore';
import { BoxCutter } from './BoxCutter';
import { SphereCutter } from './SphereCutter';
import { PlaneCutter } from './PlaneCutter';
import { useThree } from '@react-three/fiber';

/**
 * Main CuttingTool component for primitives (Box, Sphere, Plane).
 */
export function CuttingTool({ isActive }: { isActive: boolean }) {
  const activeTool = useStore(s => s.tool.activeTool);
  const transformMode = useStore(s => s.tool.transformMode);
  const toolTransform = useStore(s => s.tool.transform);
  const updateToolTransform = useStore(s => s.updateToolTransform);
  const setTransformMode = useStore(s => s.setTransformMode);
  
  const { invalidate } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  // Mode switching
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        if (key === 'w') setTransformMode('translate');
        if (key === 'e') setTransformMode('rotate');
        if (key === 'r') setTransformMode('scale');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setTransformMode]);

  // Sync group transform from store → ensures all viewports match
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(...toolTransform.position);
      groupRef.current.rotation.set(...toolTransform.rotation);
      groupRef.current.scale.set(...toolTransform.scale);
    }
  }, [toolTransform]);

  if (!activeTool || activeTool === 'knife' || activeTool === 'lasso') {
    return null;
  }

  const handleTransformChange = () => {
    if (groupRef.current) {
      updateToolTransform({ 
        position: groupRef.current.position.toArray() as [number, number, number],
        rotation: [groupRef.current.rotation.x, groupRef.current.rotation.y, groupRef.current.rotation.z] as [number, number, number],
        scale: groupRef.current.scale.toArray() as [number, number, number]
      });
      invalidate();
    }
  };

  return (
    <>
      <group ref={groupRef}>
        {activeTool === 'box' && <BoxCutter />}
        {activeTool === 'sphere' && <SphereCutter />}
        {activeTool === 'plane' && <PlaneCutter />}
      </group>

      {isActive && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode={transformMode}
          onObjectChange={handleTransformChange}
        />
      )}
    </>
  );
}
