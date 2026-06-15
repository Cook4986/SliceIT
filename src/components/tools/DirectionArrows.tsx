import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../../store/useStore';
import { COLORS } from '../../config/theme';

/**
 * Semi-transparent arrows that show which way a plane cut will crop.
 *
 * `removedDir` is the world (or parent-local) unit vector pointing toward the
 * material that SUBTRACT mode removes. The arrows re-interpret it per slice mode:
 *   • subtract (CUT)  → one arrow toward the removed side
 *   • intersect (KEEP)→ one arrow toward the opposite (removed) side
 *   • both            → a double-headed pair (nothing is discarded)
 *
 * Kept deliberately minimal — a single centered indicator, drawn on top
 * (depthTest off) so it stays readable without cluttering the cut preview.
 */
const UP = new THREE.Vector3(0, 1, 0);

function Arrow({ dir, length, color, opacity }: {
  dir: THREE.Vector3;
  length: number;
  color: string;
  opacity: number;
}) {
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()),
    [dir]
  );

  const shaft = length * 0.7;
  const head = length * 0.3;
  const shaftRadius = length * 0.022;
  const headRadius = length * 0.07;

  return (
    <group quaternion={quaternion}>
      <mesh position={[0, shaft / 2, 0]} renderOrder={999}>
        <cylinderGeometry args={[shaftRadius, shaftRadius, shaft, 12]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, shaft + head / 2, 0]} renderOrder={999}>
        <coneGeometry args={[headRadius, head, 18]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function DirectionArrows({
  center,
  removedDir,
  length,
  color = COLORS.accent.red,
  opacity = 0.5,
}: {
  center: THREE.Vector3;
  removedDir: THREE.Vector3;
  length: number;
  color?: string;
  opacity?: number;
}) {
  const mode = useStore(s => s.sliceMode);

  const dirs = useMemo(() => {
    const base = removedDir.clone().normalize();
    if (base.lengthSq() < 1e-6) return [];
    if (mode === 'both') return [base, base.clone().negate()];
    if (mode === 'intersect') return [base.clone().negate()];
    return [base];
  }, [removedDir, mode]);

  if (dirs.length === 0) return null;

  return (
    <group position={center}>
      {dirs.map((d, i) => (
        <Arrow key={i} dir={d} length={length} color={color} opacity={opacity} />
      ))}
    </group>
  );
}
