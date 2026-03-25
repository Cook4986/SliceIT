import * as THREE from 'three';
import { MATERIALS } from '../../config/theme';

/**
 * Plane cutter primitive.
 * Visually represents an infinite plane with an arrow indicating the cut direction.
 */
export function PlaneCutter() {
  return (
    <group>
      {/* Large visual plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial
          color={MATERIALS.cutter.color}
          transparent
          opacity={MATERIALS.cutter.opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Direction indicator (Arrow) */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0, 0.1, 0.25, 16]} />
        <meshBasicMaterial color={MATERIALS.cutterWireframe.color} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
        <meshBasicMaterial color={MATERIALS.cutterWireframe.color} />
      </mesh>

      {/* Grid helper on plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[10, 10]} />
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
