import * as THREE from 'three';
import { MATERIALS } from '../../config/theme';
import { DirectionArrows } from './DirectionArrows';

/**
 * Plane cutter primitive — an infinite-ish cutting plane.
 *
 * The cut removes the plane's local +Y half-space (the GPU preview clips +Y and
 * the worker is fed the negated local +Y as its normal), so the crop arrow marks
 * +Y as the removed side. Rendered inside CuttingTool's transformed group, so
 * local axes track the gizmo automatically.
 */
const REMOVED_DIR = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3(0, 0, 0);

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

      {/* Crop-direction indicator (mode-aware) */}
      <DirectionArrows center={ORIGIN} removedDir={REMOVED_DIR} length={3} />

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
