import { useRef, useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TransformControls, Sphere, Line } from '@react-three/drei';
import { useStore } from '../../store/useStore';
import { MATERIALS, COLORS } from '../../config/theme';
import { useThree } from '@react-three/fiber';
import { VIEW_CONFIGS } from '../../config/viewConfigs';
import { planeBasisQuaternion } from '../../utils/planeBasis';
import { DirectionArrows } from './DirectionArrows';

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

  const planeQuaternion = useStore(s => s.tool.planeQuaternion);

  const updatePoint = useStore(s => s.updatePoint);
  const setToolPoints = useStore(s => s.setToolPoints);
  const setTransformMode = useStore(s => s.setTransformMode);
  const updatePlaneOrientation = useStore(s => s.updatePlaneOrientation);

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
  // Unified edge-based orientation for both ortho and ISO viewports:
  //   local X = edge (P1→P2) — the visible cut line
  //   local Y = depth — extends from camera toward horizon
  //   local Z = normal — perpendicular to both
  //
  // Ortho (2-click): depth derived from fixed camera direction.
  // ISO (3-click): depth derived from P3 position. When P3≈P2 (cursor
  //   hasn't moved yet), falls back to camera direction for the initial preview.
  const quaternion = useMemo(() => {
    return (
      planeBasisQuaternion(
        vectorPoints,
        isOrthoView,
        VIEW_CONFIGS[activeViewIndex].position
      ) ?? new THREE.Quaternion()
    );
  }, [vectorPoints, isOrthoView, activeViewIndex]);

  // Deployed-plane orientation comes from the STORE, not local state: every
  // viewport renders its own CuttingPlane instance, so component-local
  // orientation desyncs the moment the gizmo rotates the plane in one view.
  const deployedQuaternion = useMemo(
    () => new THREE.Quaternion(...planeQuaternion),
    [planeQuaternion]
  );

  // ── Preview computations ───────────────────────────────────────────────────

  // Locked-point count (everything except the live cursor follower)
  const lockedCount = isDrawingComplete ? vectorPoints.length : Math.max(0, vectorPoints.length - 1);

  // Preview center = model's geometric center (same as deployed plane).
  // Anchors only define orientation; the plane always sits on the model.
  const previewCenter = useMemo(() => {
    return boundingSphere?.center?.clone() ?? new THREE.Vector3();
  }, [boundingSphere]);

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
          {/* Bold edge line — the P1→P2 edge (local X at y=0) */}
          <Line
            points={[
              new THREE.Vector3(-previewSize/2, 0, 0).applyQuaternion(previewQuaternion).add(previewCenter),
              new THREE.Vector3( previewSize/2, 0, 0).applyQuaternion(previewQuaternion).add(previewCenter),
            ]}
            color={COLORS.accent.cyan} lineWidth={4} transparent opacity={0.9}
            depthWrite={false}
          />

        </group>
      )}

      {/* ── Stage 3: Deployed plane + TransformControls ─────────────────── */}
      {isDrawingComplete && vectorPoints.length >= 2 && (
        <group>
          {activeTool === 'knife' ? (
            <PlaneSurface
              center={new THREE.Vector3(...planePosition)}
              quaternion={deployedQuaternion}
              isActive={isActive && activeHandleIndex === 'plane'}
              mode={transformMode}
              planeSize={deployedSize}
              onClick={() => setActiveHandleIndex('plane')}
              onTransformChange={(pos: THREE.Vector3, quat: THREE.Quaternion) => {
                updatePlaneOrientation(
                  [pos.x, pos.y, pos.z],
                  [quat.x, quat.y, quat.z, quat.w]
                );
              }}
            />
          ) : (
            <LassoSurface
              points={vectorPoints}
              isActive={isActive && activeHandleIndex === 'plane'}
              mode={transformMode}
              onClick={() => setActiveHandleIndex('plane')}
              onPointsTransform={(pts: THREE.Vector3[]) => {
                // Write the gizmo-transformed polygon back to the store so the
                // slice cuts where the preview sits — previously only a visual
                // move happened and the cut used the original anchor points.
                setToolPoints(pts.map(p => [p.x, p.y, p.z] as [number, number, number]));
              }}
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

  // Crop-direction arrow: SUBTRACT removes the −normal half-space (the worker's
  // half-space cutter extends along −normal), so that's the side the arrow marks.
  // Local Z is the plane normal; transform it by the live orientation.
  const removedDir = useMemo(
    () => new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).negate(),
    [quaternion]
  );

  // Orientation is store-driven: the `quaternion` prop tracks
  // tool.planeQuaternion, which the gizmo writes back on every change.
  // Re-applying it on re-render is therefore idempotent during drags and
  // keeps every viewport's instance (and the actual cut) in lockstep.
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
      {/* Full quad outline */}
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
      {/* Emboldened camera-facing edge (local X axis at y=0).
          In ortho views, this is the edge the user drew — the only visible
          part of the plane when viewed edge-on. */}
      <Line
        points={[
          new THREE.Vector3(-size/2, 0, 0).applyQuaternion(quaternion).add(center),
          new THREE.Vector3( size/2, 0, 0).applyQuaternion(quaternion).add(center),
        ]}
        color={COLORS.accent.cyan} lineWidth={4} transparent opacity={0.9}
        depthWrite={false}
      />
      {/* Crop-direction indicator */}
      <DirectionArrows center={center} removedDir={removedDir} length={size * 0.32} />

      {isActive && meshRef.current && (
        <TransformControls object={meshRef.current} mode={mode} onObjectChange={handleChange} />
      )}
    </group>
  );
}

// ── LassoSurface ──────────────────────────────────────────────────────────────

function LassoSurface({ points, isActive, mode, onClick, onPointsTransform }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { invalidate } = useThree();
  const activeViewIndex = useStore(s => s.activeViewIndex);
  const boundingSphere = useStore(s => s.model.boundingSphere);

  // Snapshot of the polygon the gizmo transforms against. While THIS
  // instance is dragging, the mesh transform is applied to the snapshot and
  // the result is written to the store. Whenever the instance is NOT
  // dragging (other viewports during a drag, drag end, undo, cross-tab
  // sync), the snapshot is rebuilt from the live store points and the mesh
  // transform is reset to identity. Without this, each viewport's stale
  // snapshot would clobber the store the moment its gizmo was touched —
  // reverting the user's placement to the deploy position.
  const [basePoints, setBasePoints] = useState<THREE.Vector3[]>(
    () => (points ?? []).map((p: THREE.Vector3) => p.clone())
  );
  const draggingRef = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    setBasePoints((points ?? []).map((p: THREE.Vector3) => p.clone()));
    if (meshRef.current) {
      meshRef.current.quaternion.identity();
      meshRef.current.scale.set(1, 1, 1);
    }
  }, [points, isActive]);

  // Extrusion direction = camera depth (toward the scene from the camera)
  const extrusionDir = useMemo(() => {
    const camPos = VIEW_CONFIGS[activeViewIndex]?.position ?? [5, 5, 5];
    return new THREE.Vector3(...camPos).normalize();
  }, [activeViewIndex]);

  // Extrusion depth = 3x model diameter
  const extrusionDepth = useMemo(() => {
    return (boundingSphere?.radius ?? 5) * 6;
  }, [boundingSphere]);

  const baseCenter = useMemo(() => {
    const c = new THREE.Vector3();
    if (basePoints.length === 0) return c;
    basePoints.forEach((p: THREE.Vector3) => c.add(p));
    return c.multiplyScalar(1 / basePoints.length);
  }, [basePoints]);

  // Front face geometry (flat polygon) — built from the deploy-time snapshot;
  // the mesh's own transform (driven by the gizmo) positions it in the world.
  const faceGeometry = useMemo(() => {
    if (basePoints.length < 3) return new THREE.BufferGeometry();
    const geom = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let i = 1; i < basePoints.length - 1; i++) {
      positions.push(
        basePoints[0].x - baseCenter.x, basePoints[0].y - baseCenter.y, basePoints[0].z - baseCenter.z,
        basePoints[i].x - baseCenter.x, basePoints[i].y - baseCenter.y, basePoints[i].z - baseCenter.z,
        basePoints[i+1].x - baseCenter.x, basePoints[i+1].y - baseCenter.y, basePoints[i+1].z - baseCenter.z,
      );
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    return geom;
  }, [basePoints, baseCenter]);

  // Polygon outline (thick edges) — front face, closed loop
  const frontEdge = useMemo(() => {
    if (!points || points.length < 3) return [];
    return [...points, points[0]];
  }, [points]);

  // Back face outline (shifted by extrusion)
  const backEdge = useMemo(() => {
    if (!points || points.length < 3) return [];
    const offset = extrusionDir.clone().multiplyScalar(-extrusionDepth);
    return [...points.map((p: THREE.Vector3) => p.clone().add(offset)), points[0].clone().add(offset)];
  }, [points, extrusionDir, extrusionDepth]);

  // Side connecting lines (one per vertex)
  const sideLines = useMemo(() => {
    if (!points || points.length < 3) return [];
    const offset = extrusionDir.clone().multiplyScalar(-extrusionDepth);
    return points.map((p: THREE.Vector3) => [p, p.clone().add(offset)]);
  }, [points, extrusionDir, extrusionDepth]);

  useEffect(() => { return () => faceGeometry.dispose(); }, [faceGeometry]);

  const handleChange = () => {
    if (meshRef.current && onPointsTransform) {
      // Apply the mesh's full world transform (T·R·S) to the snapshot and
      // push the result to the store — this is what makes the gizmo actually
      // move the CUT, not just the preview.
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      const worldScale = new THREE.Vector3();
      meshRef.current.getWorldPosition(worldPos);
      meshRef.current.getWorldQuaternion(worldQuat);
      meshRef.current.getWorldScale(worldScale);
      const transformed = basePoints.map((p: THREE.Vector3) =>
        p.clone().sub(baseCenter).multiply(worldScale).applyQuaternion(worldQuat).add(worldPos)
      );
      onPointsTransform(transformed);
    }
    invalidate();
  };

  const handleDragStart = () => { draggingRef.current = true; };
  const handleDragEnd = () => {
    draggingRef.current = false;
    // Bake the finished drag: snapshot the current (transformed) store
    // points and zero the mesh transform so the next drag composes from
    // where the polygon now sits.
    setBasePoints((points ?? []).map((p: THREE.Vector3) => p.clone()));
    if (meshRef.current) {
      meshRef.current.quaternion.identity();
      meshRef.current.scale.set(1, 1, 1);
    }
  };

  return (
    <group>
      {/* Front face fill */}
      <mesh ref={meshRef} geometry={faceGeometry} position={baseCenter}
        onPointerDown={(e) => { e.stopPropagation(); onClick(); }}
      >
        <meshStandardMaterial
          color={MATERIALS.cutter.color} transparent opacity={0.2}
          side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>

      {/* Front edge — thick cyan outline */}
      {frontEdge.length > 0 && (
        <Line
          points={frontEdge}
          color={COLORS.accent.cyan} lineWidth={4}
          transparent opacity={0.9} depthWrite={false}
        />
      )}

      {/* Back edge — thinner dashed outline */}
      {backEdge.length > 0 && (
        <Line
          points={backEdge}
          color={COLORS.accent.pink} lineWidth={1.5}
          transparent opacity={0.35} depthWrite={false}
          dashed dashSize={0.1} gapSize={0.06}
        />
      )}

      {/* Side connecting edges */}
      {sideLines.map((pair: THREE.Vector3[], i: number) => (
        <Line
          key={`side-${i}`}
          points={pair}
          color={COLORS.accent.pink} lineWidth={1}
          transparent opacity={0.25} depthWrite={false}
          dashed dashSize={0.1} gapSize={0.06}
        />
      ))}

      {isActive && meshRef.current && (
        <TransformControls
          object={meshRef.current}
          mode={mode}
          onObjectChange={handleChange}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
        />
      )}
    </group>
  );
}

