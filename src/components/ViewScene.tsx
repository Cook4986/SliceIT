import type { ViewConfig } from '../types/store';
import { ViewCamera } from './ViewCamera';
import { ViewHelpers } from './ViewHelpers';
import { ModelRenderer } from './ModelRenderer';
import { CuttingTool } from './tools/CuttingTool';
import { PointerTracker, PointerRenderer } from './tools/CrossViewportPointer';

interface ViewSceneProps {
  viewIndex: number;
  config: ViewConfig;
  isActive: boolean;
}

export function ViewScene({ viewIndex, config, isActive }: ViewSceneProps) {
  return (
    <>
      <ViewCamera config={config} viewIndex={viewIndex} />
      <ViewHelpers config={config} />
      <ModelRenderer />
      <CuttingTool />
      <PointerTracker isActive={isActive} />
      <PointerRenderer />

      {/* Strong "Bop It" lighting — bright, toy-like feel */}
      <ambientLight intensity={0.8} color="#FFFFFF" /> 
      <directionalLight 
        position={[8, 12, 5]} 
        intensity={1.8} 
        color="#FFFFFF" 
        castShadow 
      />
      <directionalLight 
        position={[-5, -3, -8]} 
        intensity={0.6} 
        color="#A5B4FC"  /* Indigo fill light */
      />
      <hemisphereLight 
        args={['#F472B6', '#3B20A1', 0.4]} /* Pink sky / Purple ground */
      />
    </>
  );
}
