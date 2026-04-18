import { useRef, useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TransformControls, Sphere, Line, Html } from '@react-three/drei';
import { useStore } from '../../store/useStore';
import { MATERIALS, COLORS } from '../../config/theme';
import { useThree } from '@react-three/fiber';
import { VIEW_CONFIGS } from '../../config/viewConfigs';

/**
 * CuttingPlane — Knife & Lasso tool visuals with a 3-stage interactive preview.
 *
 * Knife tool stages (all driven by the live vectorPoints array):
 *   Stage 1 — 1 locked pt  : horizontal preview plane sizes in real-time
 *                             as cursor moves (P1 + cursor = diagonal corners).
 *   Stage 2 — 2 locked pts : plane center is fixed at midpoint(P1,P2).
 *                             Cursor movement rotates the preview in real-time.
 *   Stage 3 — isDrawingComplete : preview replaced by deployed plane +
 *                             TransformControls + MOVE/ROTATE pill.
 *
 * Degenerate-anchor warning fires when P1 and P2 are too close, or all 3 points
 * are collinear (cross product ≈ 0), before the user makes the final click.
 */
export function CuttingPlane({ isActive }: { isActive: boolean }) {
  const points = useStore(s => s.tool.points);
  const activeTool = useStore(s => s.tool.activeTool);
  const placementIndex = useStore(s => s.tool.placementIndex);
  const isDrawingComplete = useStore(s => s.tool.isDrawingComplete);
  const sharedPointer = useStore(s => s.sharedPointer);
  const transformMode = useStore(s => s.tool.transformMode);
  const boundingSphere = useStore(s => s.model.boundingSphere);
  const planePosition = useStore(s => s.tool.planePosition);

  const updatePoint = useStore(s => s.updatePoint);
  const setTransformMode = useStore(s => s.setTransformMode);
  const updatePlaneNormal = useStore(s => s.updatePlaneNormal);
  const updatePlanePosition = useStore(s => s.updatePlanePosition);

  const [activeHandleIndex, setActiveHandleIndex] = useState<number | 'plane' | null>(null);

  const isKnifeOrLasso = activeTool === 'knife' || activeTool === 'lasso';

  // Detect if the active viewport is orthographic — ortho uses 2-click mode
  const activeViewIndex = useStore(s => s.activeViewIndex);
  const isOrthoView = VIEW_CONFIGS[activeViewIndex]?.cameraType === 'orthographic';

  // Plane display size — proportional to the model bounding sphere
  const planeSize = useMemo(() => {
    if (boundingSphere) return boundingSphere.radius * 3;
    return 3;
  }, [boundingSphere]);

  // Track cursor in active viewport
  useEffect(() => {
    if (isKnifeOrLasso && isActive && placementIndex !== -1 && sharedPointer) {
      updatePoint(placementIndex, sharedPointer);
    }
  }, [isKnifeOrLasso, isActive, sharedPointer, placementIndex, updatePoint]);

  // W/E keys switch transform mode
  useEffect(() => {
    if (!isKnifeOrLasso) return;
    const handleKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') setTransformMode('translate');
      if (key === 'e') setTransformMode('rotate');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setTransformMode, isKnifeOrLasso]);

  // All current world-space points (locked + live cursor)
  const vectorPoints = useMemo(() => {
    if (!isKnifeOrLasso) return [];
    return points.filter(p => p && p.length === 3).map(p => new THREE.Vector3(...p));
  }, [points, isKnifeOrLasso]);

  // ── Final-plane quaternion (cross product of P1→P2 and P1→P3) ─────────────
  // ── Plane quaternion ────────────────────────────────────────────────────────
  // Ortho 2-point mode: normal = normalize(P2 − P1) — perpendicular to the drawn line
  // Perspective 3-point mode: normal = cross product of (P1→P2) × (P1→P3)
  const quaternion = useMemo(() => {
    const zAxis = new THREE.Vector3(0, 0, 1);

    if (isOrthoView && vectorPoints.length >= 2) {
      // Direction from P1 to P2 (or cursor in preview) IS the plane normal
      const dir = new THREE.Vector3()
        .subVectors(vectorPoints[vectorPoints.length - 1], vectorPoints[0])
        .normalize();
      if (dir.lengthSq() > 0.0001) {
        return new THREE.Quaternion().setFromUnitVectors(zAxis, dir);
      }
      return new THREE.Quaternion();
    }

    if (vectorPoints.length < 3) return new THREE.Quaternion();
    const p0 = vectorPoints[0];
    const p1 = vectorPoints[1];
    const p2 = vectorPoints[2];
    if (!p0 || !p1 || !p2) return new THREE.Quaternion();
    const v1 = new THREE.Vector3().subVectors(p1, p0);
    const v2 = new THREE.Vector3().subVectors(p2, p0);
    if (v1.lengthSq() < 1e-8 || v2.lengthSq() < 1e-8) return new THREE.Quaternion();
    v1.normalize();
    v2.normalize();
    const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
    if (normal.lengthSq() < 0.0001) return new THREE.Quaternion();
    let up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(normal.dot(up)) > 0.99) up.set(0, 0, 1);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), normal, up);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }, [vectorPoints, isOrthoView]);

  // ── Preview computations ───────────────────────────────────────────────────

  // Locked-point count (everything except the live cursor follower)
  const lockedCount = isDrawingComplete ? vectorPoints.length : Math.max(0, vectorPoints.length - 1);

  // Preview center = P1 (the anchor point). P2/P3 only affect direction/angle.
  const previewCenter = useMemo(() => {
    return vectorPoints[0]?.clone() ?? new THREE.Vector3();
  }, [vectorPoints]);

  // Preview size = always bounding-sphere based to fully frame the mesh.
  // Knife planes extend through the entire model — no user-controlled sizing.
  const previewSize = planeSize;

  // Stage 1: horizontal plane (XZ) orientation for sizing preview
  const horizontalQ = useMemo(
    () => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
    []
  );

  // Stage 1 & 2: previewQuaternion
  // Since the quaternion memo now handles both ortho (2-pt) and perspective (3-pt),
  // we can use it directly. Fall back to the horizontal default only in perspective
  // mode before P3 is placed.
  const previewQuaternion = (isOrthoView && vectorPoints.length >= 2) || vectorPoints.length >= 3
    ? quaternion
    : horizontalQ;

  // Degenerate-anchor detection: warn when P1≈P2 or all 3 are collinear.
  // Important: skip the collinear check when P3 (cursor) is still at P2's position —
  // this happens the frame immediately after click 2 before the cursor has moved.
  const isDegenerate = useMemo(() => {
    if (vectorPoints.length < 3 || isDrawingComplete) return false;
    const p0 = vectorPoints[0];
    const p1 = vectorPoints[1];
    const p2 = vectorPoints[2];
    if (!p0 || !p1 || !p2) return false;
    if (p0.distanceTo(p1) < 0.05) return true;         // P1 ≈ P2: coincident anchors
    if (p1.distanceTo(p2) < 0.1) return false;          // cursor still at P2 — wait for movement
    const v1 = new THREE.Vector3().subVectors(p1, p0).normalize();
    const v2 = new THREE.Vector3().subVectors(p2, p0).normalize();
    return new THREE.Vector3().crossVectors(v1, v2).lengthSq() < 0.01;
  }, [vectorPoints, isDrawingComplete]);

  // Deployed plane size = bounding-sphere based, same as preview.
  // Knife planes always frame the full mesh.
  const deployedSize = planeSize;

  // ── Lifecycle hooks ────────────────────────────────────────────────────────
  useEffect(() => { setActiveHandleIndex(null); }, [activeTool]);

  useEffect(() => {
    if (isDrawingComplete) setActiveHandleIndex('plane');
  }, [isDrawingComplete]);

  // Early return AFTER all hooks
  if (!isKnifeOrLasso) return null;
  if (vectorPoints.length === 0) return null;

  // ── Preview edge corners helper ────────────────────────────────────────────
  const previewCorners = (center: THREE.Vector3, quat: THREE.Quaternion, size: number) => {
    const h = size / 2;
    return [
      new THREE.Vector3(-h, -h, 0).applyQuaternion(quat).add(center),
      new THREE.Vector3( h, -h, 0).applyQuaternion(quat).add(center),
      new THREE.Vector3( h,  h, 0).applyQuaternion(quat).add(center),
      new THREE.Vector3(-h,  h, 0).applyQuaternion(quat).add(center),
      new THREE.Vector3(-h, -h, 0).applyQuaternion(quat).add(center),
    ];
  };

  return (
    <group>

      {/* ── Anchor dots + connector line (shown while placing) ──────────── */}
      {!isDrawingComplete && (
        <>
          {vectorPoints.length > 1 && (
            <Line
              points={[...vectorPoints,
                placementIndex === -1 ? vectorPoints[0] : vectorPoints[vectorPoints.length - 1]
              ]}
              color={isDegenerate ? '#ff4444' : COLORS.accent.cyan}
              lineWidth={2.5}
              transparent
              opacity={0.8}
            />
          )}
          {vectorPoints.map((p, i) => {
            const isLocked = i < lockedCount;
            return (
              <group key={`h-${i}`}>
                <Sphere args={[0.05, 12, 12]} position={p}
                  onPointerDown={(e) => { e.stopPropagation(); }}
                >
                  <meshStandardMaterial
                    color={isDegenerate ? '#ff4444' : (isLocked ? COLORS.accent.yellow : COLORS.accent.cyan)}
                    emissive={isDegenerate ? '#ff2222' : (isLocked ? '#FACC15' : '#22D3EE')}
                    emissiveIntensity={isLocked ? 0.9 : 0.3}
                  />
                </Sphere>
              </group>
            );
          })}
        </>
      )}

      {/* ── Stage 1: Sizing preview (P1 locked, cursor = diagonal corner) ── */}
      {!isDrawingComplete && activeTool === 'knife' && lockedCount === 1 && vectorPoints.length >= 2 && (
        <group>
          <mesh position={previewCenter} quaternion={previewQuaternion}>
            <planeGeometry args={[previewSize, previewSize]} />
            <meshStandardMaterial
              color={COLORS.accent.cyan}
              transparent opacity={0.06}
              side={THREE.DoubleSide} depthWrite={false}
            />
          </mesh>
          <Line
            points={previewCorners(previewCenter, previewQuaternion, previewSize)}
            color={COLORS.accent.cyan}
            lineWidth={1}
            transparent opacity={0.25}
            dashed dashSize={0.15} gapSize={0.1}
          />
          {/* Stage label */}
          <Html position={previewCenter} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(15,10,40,0.8)', border: '1px solid #22D3EE',
              borderRadius: '10px', padding: '3px 10px', color: '#22D3EE',
              fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap',
              marginTop: '-52px',
            }}>
              CLICK TO CUT
            </div>
          </Html>
        </group>
      )}

      {/* ── Stage 2: Rotation preview — perspective/ISO only (ortho completes at 2 clicks) ── */}
      {!isDrawingComplete && activeTool === 'knife' && !isOrthoView && lockedCount === 2 && vectorPoints.length >= 3 && (
        <group>
          <mesh position={previewCenter} quaternion={previewQuaternion}>
            <planeGeometry args={[previewSize, previewSize]} />
            <meshStandardMaterial
              color={isDegenerate ? '#ff4444' : COLORS.accent.pink}
              transparent opacity={isDegenerate ? 0.12 : 0.09}
              side={THREE.DoubleSide} depthWrite={false}
            />
          </mesh>
          <Line
            points={previewCorners(previewCenter, previewQuaternion, previewSize)}
            color={isDegenerate ? '#ff4444' : COLORS.accent.pink}
            lineWidth={1.5}
            transparent opacity={isDegenerate ? 0.8 : 0.35}
            dashed dashSize={0.12} gapSize={0.08}
          />
          {/* Degenerate warning */}
          {isDegenerate && (
            <Html position={previewCenter} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
              <div style={{
                background: 'rgba(80,10,10,0.9)', border: '1.5px solid #ff4444',
                borderRadius: '10px', padding: '4px 12px', color: '#ff8888',
                fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap',
                marginTop: '-52px',
              }}>
                ⚠ POINTS TOO CLOSE — SPREAD ANCHORS
              </div>
            </Html>
          )}
          {!isDegenerate && (
            <Html position={previewCenter} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
              <div style={{
                background: 'rgba(15,10,40,0.8)', border: '1px solid #F472B6',
                borderRadius: '10px', padding: '3px 10px', color: '#F472B6',
                fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap',
                marginTop: '-52px',
              }}>
                CLICK TO SET ANGLE
              </div>
            </Html>
          )}
        </group>
      )}

      {/* ── Stage 3: Deployed plane + TransformControls ─────────────────── */}
      {isDrawingComplete && vectorPoints.length >= 2 && (
        <group>
          {activeTool === 'knife' ? (
            <PlaneSurface
              center={new THREE.Vector3(...planePosition)}
              quaternion={quaternion}
              isActive={isActive && activeHandleIndex === 'plane'}
              mode={transformMode}
              planeSize={deployedSize}
              onClick={() => setActiveHandleIndex('plane')}
              onTransformChange={(pos: THREE.Vector3, quat: THREE.Quaternion) => {
                updatePlanePosition([pos.x, pos.y, pos.z]);
                const n = new THREE.Vector3(0, 0, 1).applyQuaternion(quat).normalize();
                updatePlaneNormal([n.x, n.y, n.z]);
              }}
            />
          ) : (
            <LassoSurface
              points={vectorPoints}
              isActive={isActive && activeHandleIndex === 'plane'}
              mode={transformMode}
              onClick={() => setActiveHandleIndex('plane')}
              onTransformChange={(pos: THREE.Vector3) => { updatePlanePosition([pos.x, pos.y, pos.z]); }}
            />
          )}
        </group>
      )}
    </group>
  );
}

// ── PlaneSurface ──────────────────────────────────────────────────────────────

function PlaneSurface({ center, quaternion, isActive, mode, planeSize, onClick, onTransformChange }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { invalidate } = useThree();
  const size = planeSize || 3;

  const handleChange = () => {
    if (meshRef.current && onTransformChange) {
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      meshRef.current.getWorldPosition(worldPos);
      meshRef.current.getWorldQuaternion(worldQuat);
      onTransformChange(worldPos, worldQuat);
    }
    invalidate();
  };

  return (
    <group>
      <mesh ref={meshRef} position={center} quaternion={quaternion}
        onPointerDown={(e) => { e.stopPropagation(); onClick(); }}
      >
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          color={MATERIALS.cutter.color} transparent opacity={0.18}
          side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>
      {/* Edge highlight */}
      <Line
        points={[
          new THREE.Vector3(-size/2, -size/2, 0).applyQuaternion(quaternion).add(center),
          new THREE.Vector3( size/2, -size/2, 0).applyQuaternion(quaternion).add(center),
          new THREE.Vector3( size/2,  size/2, 0).applyQuaternion(quaternion).add(center),
          new THREE.Vector3(-size/2,  size/2, 0).applyQuaternion(quaternion).add(center),
          new THREE.Vector3(-size/2, -size/2, 0).applyQuaternion(quaternion).add(center),
        ]}
        color={COLORS.accent.pink} lineWidth={1.5} transparent opacity={0.4}
      />
      {isActive && meshRef.current && (
        <TransformControls object={meshRef.current} mode={mode} onObjectChange={handleChange} />
      )}
    </group>
  );
}

// ── LassoSurface ──────────────────────────────────────────────────────────────

function LassoSurface({ points, isActive, mode, onClick, onTransformChange }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { invalidate } = useThree();

  const center = useMemo(() => {
    if (!points || points.length === 0) return new THREE.Vector3();
    const c = new THREE.Vector3();
    points.forEach((p: THREE.Vector3) => c.add(p));
    return c.multiplyScalar(1 / points.length);
  }, [points]);

  const geometry = useMemo(() => {
    if (!points || points.length < 3) return new THREE.BufferGeometry();
    const geom = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let i = 1; i < points.length - 1; i++) {
      positions.push(
        points[0].x - center.x, points[0].y - center.y, points[0].z - center.z,
        points[i].x - center.x, points[i].y - center.y, points[i].z - center.z,
        points[i+1].x - center.x, points[i+1].y - center.y, points[i+1].z - center.z,
      );
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    return geom;
  }, [points, center]);

  useEffect(() => { return () => geometry.dispose(); }, [geometry]);

  const handleChange = () => {
    if (meshRef.current && onTransformChange) {
      const worldPos = new THREE.Vector3();
      meshRef.current.getWorldPosition(worldPos);
      onTransformChange(worldPos);
    }
    invalidate();
  };

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} position={center}
        onPointerDown={(e) => { e.stopPropagation(); onClick(); }}
      >
        <meshStandardMaterial
          color={MATERIALS.cutter.color} transparent opacity={0.3}
          side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>
      {isActive && meshRef.current && (
        <TransformControls object={meshRef.current} mode={mode} onObjectChange={handleChange} />
      )}
    </group>
  );
}
