import * as THREE from 'three';
import { MATERIALS } from '../../config/theme';

/**
 * Cylinder cutter primitive.
 */
export function CylinderCutter() {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
        <meshStandardMaterial
          color={MATERIALS.cutter.color}
          transparent
          opacity={MATERIALS.cutter.opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      <mesh>
        <cylinderGeometry args={[0.501, 0.501, 1.001, 16]} />
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
