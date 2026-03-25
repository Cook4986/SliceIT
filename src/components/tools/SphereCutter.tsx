import * as THREE from 'three';
import { MATERIALS } from '../../config/theme';

/**
 * Sphere cutter primitive.
 */
export function SphereCutter() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color={MATERIALS.cutter.color}
          transparent
          opacity={MATERIALS.cutter.opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      <mesh>
        <sphereGeometry args={[0.501, 16, 16]} />
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
