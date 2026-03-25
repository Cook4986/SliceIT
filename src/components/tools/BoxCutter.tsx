import * as THREE from 'three';
import { MATERIALS } from '../../config/theme';

/**
 * Box cutter primitive.
 * Semi-transparent red box with wireframe overlay.
 */
export function BoxCutter() {
  return (
    <group>
      {/* Semi-transparent fill */}
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={MATERIALS.cutter.color}
          transparent
          opacity={MATERIALS.cutter.opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Wireframe overlay */}
      <mesh>
        <boxGeometry args={[1.001, 1.001, 1.001]} />
        <meshBasicMaterial
          color={MATERIALS.cutterWireframe.color}
          wireframe
          transparent
          opacity={MATERIALS.cutterWireframe.opacity}
        />
      </mesh>
    </group>
  );
}
