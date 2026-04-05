import { useRef, useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TransformControls, Sphere, Line } from '@react-three/drei';
import { useStore } from '../../store/useStore';
import { MATERIALS, COLORS } from '../../config/theme';
import { useThree } from '@react-three/fiber';

/**
 * CuttingPlane — Supports both Knife and Lasso tool visuals.
 * All hooks are called unconditionally to satisfy React's Rules of Hooks.
 */
export function CuttingPlane({ isActive }: { isActive: boolean }) {
  const points = useStore(s => s.tool.points);
  const activeTool = useStore(s => s.tool.activeTool);
  const placementIndex = useStore(s => s.tool.placementIndex);
  const isDrawingComplete = useStore(s => s.tool.isDrawingComplete);
  const sharedPointer = useStore(s => s.sharedPointer);
  const transformMode = useStore(s => s.tool.transformMode);
  const boundingSphere = useStore(s => s.model.boundingSphere);
  
  const updatePoint = useStore(s => s.updatePoint);
  const setTransformMode = useStore(s => s.setTransformMode);
  
  const [activeHandleIndex, setActiveHandleIndex] = useState<number | 'plane' | null>(null);

  const isKnifeOrLasso = activeTool === 'knife' || activeTool === 'lasso';

  // Compute plane size from model bounding sphere (default ~3 units for a normalized 2-unit model)
  const planeSize = useMemo(() => {
    if (boundingSphere) return boundingSphere.radius * 3;
    return 3;
  }, [boundingSphere]);

  // Track mouse position for active placement — only in active viewport
  useEffect(() => {
    if (isKnifeOrLasso && isActive && placementIndex !== -1 && sharedPointer) {
        updatePoint(placementIndex, sharedPointer);
    }
  }, [isKnifeOrLasso, isActive, sharedPointer, placementIndex, updatePoint]);

  // Global mode switching (W/E keys)
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

  const vectorPoints = useMemo(() => {
    if (!isKnifeOrLasso) return [];
    return points.filter(p => p && p.length === 3).map(p => new THREE.Vector3(...p));
  }, [points, isKnifeOrLasso]);
  
  const center = useMemo(() => {
    if (vectorPoints.length < 1) return new THREE.Vector3(0, 0, 0);
    const sum = new THREE.Vector3();
    vectorPoints.forEach(p => sum.add(p));
    return sum.multiplyScalar(1 / vectorPoints.length);
  }, [vectorPoints]);

  const quaternion = useMemo(() => {
    if (vectorPoints.length < 3) return new THREE.Quaternion();
    const p0 = vectorPoints[0];
    const p1 = vectorPoints[1];
    const p2 = vectorPoints[2];
    
    if (!p0 || !p1 || !p2) return new THREE.Quaternion();

    const v1 = new THREE.Vector3().subVectors(p1, p0);
    const v2 = new THREE.Vector3().subVectors(p2, p0);
    
    // Guard against degenerate (collinear) points
    if (v1.lengthSq() < 1e-8 || v2.lengthSq() < 1e-8) return new THREE.Quaternion();
    v1.normalize();
    v2.normalize();
    
    const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
    if (normal.lengthSq() < 0.0001) return new THREE.Quaternion();
    
    let up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(normal.dot(up)) > 0.99) up.set(0, 0, 1);
    
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), normal, up);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }, [vectorPoints]);

  // Reset handle selection when tool changes
  useEffect(() => {
    setActiveHandleIndex(null);
  }, [activeTool]);

  // Early return AFTER all hooks
  if (!isKnifeOrLasso) return null;
  if (vectorPoints.length === 0) return null;

  return (
    <group>
      {/* Path Wireframe */}
      {vectorPoints.length > 1 && (
        <Line
          points={[
            ...vectorPoints, 
            placementIndex === -1 ? vectorPoints[0] : vectorPoints[vectorPoints.length - 1]
          ]}
          color={COLORS.accent.cyan}
          lineWidth={2.5}
          transparent
          opacity={0.8}
        />
      )}

      {/* Anchor Spheres */}
      {vectorPoints.map((p, i) => (
        <group key={`h-${i}`}>
            <Sphere 
                args={[0.05, 12, 12]} 
                position={p}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    // Only allow handle selection when drawing is complete
                    if (isDrawingComplete && isActive) {
                        setActiveHandleIndex(i);
                    }
                }}
            >
                <meshStandardMaterial 
                    color={activeHandleIndex === i ? COLORS.accent.yellow : COLORS.accent.cyan} 
                    emissive={activeHandleIndex === i ? '#FACC15' : '#22D3EE'}
                    emissiveIntensity={activeHandleIndex === i ? 0.8 : 0.3}
                />
            </Sphere>
        </group>
      ))}

      {/* Cutting Surface — only show when drawing is complete (all points placed) */}
      {isDrawingComplete && vectorPoints.length >= 3 && (
        <group>
            {activeTool === 'knife' ? (
                <PlaneSurface 
                    center={center} 
                    quaternion={quaternion} 
                    isActive={isActive && activeHandleIndex === 'plane'}
                    mode={transformMode}
                    planeSize={planeSize}
                    onClick={() => setActiveHandleIndex('plane')}
                />
            ) : (
                <LassoSurface 
                    points={vectorPoints} 
                    isActive={isActive && activeHandleIndex === 'plane'}
                    mode={transformMode}
                    onClick={() => setActiveHandleIndex('plane')}
                />
            )}
        </group>
      )}
    </group>
  );
}

function PlaneSurface({ center, quaternion, isActive, mode, planeSize, onClick }: any) {
    const meshRef = useRef<THREE.Mesh>(null);
    const { invalidate } = useThree();
    const size = planeSize || 3;

    return (
        <group>
            <mesh
                ref={meshRef}
                position={center}
                quaternion={quaternion}
                onPointerDown={(e) => { e.stopPropagation(); onClick(); }}
            >
                <planeGeometry args={[size, size]} />
                <meshStandardMaterial
                    color={MATERIALS.cutter.color}
                    transparent
                    opacity={0.18}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>
            {/* Edge highlight ring */}
            <Line
                points={[
                    new THREE.Vector3(-size/2, -size/2, 0).applyQuaternion(quaternion).add(center),
                    new THREE.Vector3( size/2, -size/2, 0).applyQuaternion(quaternion).add(center),
                    new THREE.Vector3( size/2,  size/2, 0).applyQuaternion(quaternion).add(center),
                    new THREE.Vector3(-size/2,  size/2, 0).applyQuaternion(quaternion).add(center),
                    new THREE.Vector3(-size/2, -size/2, 0).applyQuaternion(quaternion).add(center),
                ]}
                color={COLORS.accent.pink}
                lineWidth={1.5}
                transparent
                opacity={0.4}
            />
            {isActive && meshRef.current && (
                <TransformControls
                    object={meshRef.current}
                    mode={mode}
                    onObjectChange={() => invalidate()}
                />
            )}
        </group>
    );
}

function LassoSurface({ points, isActive, mode, onClick }: any) {
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
                points[i+1].x - center.x, points[i+1].y - center.y, points[i+1].z - center.z
            );
        }
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.computeVertexNormals();
        return geom;
    }, [points, center]);

    // Explicit disposal on unmount or update
    useEffect(() => {
        return () => geometry.dispose();
    }, [geometry]);

    return (
        <group>
            <mesh
                ref={meshRef}
                geometry={geometry}
                position={center}
                onPointerDown={(e) => { e.stopPropagation(); onClick(); }}
            >
                <meshStandardMaterial
                    color={MATERIALS.cutter.color}
                    transparent
                    opacity={0.3}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>
            {isActive && meshRef.current && (
                <TransformControls
                    object={meshRef.current}
                    mode={mode}
                    onObjectChange={() => invalidate()}
                />
            )}
        </group>
    );
}
