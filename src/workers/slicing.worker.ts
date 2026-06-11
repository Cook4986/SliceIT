/**
 * Slicing Web Worker — CSG via manifold-3d with three-csg-ts fallback.
 *
 * Manifold guarantees watertight output regardless of input mesh quality.
 * A vertex-weld pre-pass (mergeVertices) repairs non-indexed / duplicate-vertex
 * geometry before it reaches the boolean engine.
 *
 * UV PRESERVATION: When an optional `modelUVs` Float32Array is supplied,
 * vertex properties are packed as numProp=5 (x,y,z,u,v). Manifold will
 * automatically interpolate UV coordinates for newly-created vertices at
 * boolean cut boundaries, preserving texture mapping on cropped output.
 */

import { expose } from 'comlink';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CSG } from 'three-csg-ts';
import {
  packVertProperties,
  unpackVertProperties,
  clampToOriginalBounds,
  ensureIndexed,
  WELD_TOLERANCE,
  HALF_SPACE_SIZE,
} from './csgUtils';
import type { SliceResult } from './csgUtils';

export type { SliceResult };

// ── Manifold lazy-loader ───────────────────────────────────────────────────
let manifoldModule: any = null;

async function loadManifold(): Promise<any> {
  if (manifoldModule) return manifoldModule;
  // Dynamic import keeps the WASM out of the initial bundle parse.
  const ManifoldFactory = (await import('manifold-3d')).default;
  manifoldModule = await ManifoldFactory();
  manifoldModule.setup(); // Required by manifold-3d v2+
  return manifoldModule;
}

// ── Worker API ────────────────────────────────────────────────────────────
const slicingAPI = {
  async init(): Promise<void> {
    await loadManifold();
    console.log('[SlicingWorker] Manifold CSG Engine Initialized');
  },

  async subtractMeshWithPlane(
    modelPositions: Float32Array,
    modelIndices: Uint32Array | null,
    origin: [number, number, number],
    normal: [number, number, number],
    modelUVs?: Float32Array | null
  ): Promise<SliceResult> {

    // ── Step 1: Ensure indexed geometry ────────────────────────────────
    const prepared = ensureIndexed(modelPositions, modelIndices, modelUVs ?? null);
    const { positions, indices, uvs } = prepared;

    // ── Step 2: Manifold CSG ────────────────────────────────────────────
    try {
      const wasm = await loadManifold();
      const { Manifold } = wasm;

      // Build Manifold mesh from input geometry.
      // Manifold automatically repairs winding order during construction.
      const packed = packVertProperties(positions, uvs);
      const meshGL = {
        numProp: packed.numProp,
        vertProperties: packed.vertProperties,
        triVerts: indices instanceof Uint32Array ? indices : new Uint32Array(indices),
      };
      const modelManifold = new Manifold(meshGL);

      // Build a half-space cutter oriented to the cutting plane.
      // Strategy: large cube whose +z face sits at the origin, extending in -z.
      // Rotate so that local +z maps to `normal`, then translate to `origin`.
      const n = new THREE.Vector3(...normal).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      const euler = new THREE.Euler().setFromQuaternion(q, 'XYZ');
      const rotDeg: [number, number, number] = [
        THREE.MathUtils.radToDeg(euler.x),
        THREE.MathUtils.radToDeg(euler.y),
        THREE.MathUtils.radToDeg(euler.z),
      ];

      const size = HALF_SPACE_SIZE;
      // Manifold.cube([x,y,z], center=true) → centered cube.
      // Translate -size/2 in z → top face is now at z=0, box extends into -z.
      const cutter = Manifold.cube([size, size, size], true)
        .translate([0, 0, -size / 2])
        .rotate(rotDeg)
        .translate(origin);

      // Boolean subtraction — guaranteed watertight by Manifold
      const result = modelManifold.subtract(cutter);

      if (result.isEmpty()) {
        throw new Error('Manifold returned empty mesh — falling back to CSG');
      }

      const resultMesh = result.getMesh();
      const rawVP = resultMesh.vertProperties instanceof Float32Array
        ? resultMesh.vertProperties
        : new Float32Array(resultMesh.vertProperties);
      const resIndices = resultMesh.triVerts instanceof Uint32Array
        ? resultMesh.triVerts
        : new Uint32Array(resultMesh.triVerts);

      // Unpack positions + UVs from the interleaved vertProperties
      const unpacked = unpackVertProperties(rawVP, packed.numProp);
      const clamped = clampToOriginalBounds(unpacked.positions, resIndices, positions);

      console.log('[SlicingWorker] Manifold subtraction complete:', clamped.positions.length / 3, 'verts',
        unpacked.uvs ? '(UVs preserved)' : '(no UVs)');
      return { positions: clamped.positions, indices: clamped.indices, uvs: unpacked.uvs };

    } catch (manifoldErr: any) {
      console.warn('[SlicingWorker] Manifold failed, falling back to three-csg-ts:', manifoldErr.message);
    }

    // ── Step 3: three-csg-ts fallback (no UV support) ──────────────────
    if (uvs) {
      console.warn('[SlicingWorker] three-csg-ts fallback does not preserve UVs — textures will be lost on this cut.');
    }
    const modelGeo = new THREE.BufferGeometry();
    modelGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (indices && indices.length > 0) {
      modelGeo.setIndex(new THREE.BufferAttribute(indices, 1));
    }
    modelGeo.computeVertexNormals();
    modelGeo.computeBoundingBox();
    modelGeo.computeBoundingSphere();

    const modelMesh = new THREE.Mesh(modelGeo, new THREE.MeshBasicMaterial());
    modelMesh.updateMatrixWorld();

    const size = HALF_SPACE_SIZE;
    const cutterGeo = new THREE.BoxGeometry(size, size, size);
    cutterGeo.translate(0, 0, -size / 2);

    const cutterMesh = new THREE.Mesh(cutterGeo, new THREE.MeshBasicMaterial());
    cutterMesh.position.set(origin[0], origin[1], origin[2]);
    cutterMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(normal[0], normal[1], normal[2]).normalize()
    );
    cutterMesh.updateMatrixWorld();

    const resultMesh = CSG.subtract(modelMesh, cutterMesh);
    const resGeo = resultMesh.geometry as THREE.BufferGeometry;
    const fallbackPositions = new Float32Array(resGeo.attributes.position.array as Float32Array);
    const fallbackIndices = resGeo.index
      ? new Uint32Array(resGeo.index.array as Uint32Array)
      : new Uint32Array(0);
    const clamped = clampToOriginalBounds(fallbackPositions, fallbackIndices, positions);
    return { positions: clamped.positions, indices: clamped.indices, uvs: null };
  },

  async subtractMeshWithPrimitive(
    modelPositions: Float32Array,
    modelIndices: Uint32Array | null,
    primitiveType: 'box' | 'sphere',
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number],
    modelUVs?: Float32Array | null
  ): Promise<SliceResult> {
    const prepared = ensureIndexed(modelPositions, modelIndices, modelUVs ?? null);
    const { positions, indices, uvs } = prepared;

    try {
      const wasm = await loadManifold();
      const { Manifold } = wasm;

      const packed = packVertProperties(positions, uvs);
      const meshGL = {
        numProp: packed.numProp,
        vertProperties: packed.vertProperties,
        triVerts: indices instanceof Uint32Array ? indices : new Uint32Array(indices),
      };
      const modelManifold = new Manifold(meshGL);

      let cutter;
      const rotDeg: [number, number, number] = [
        THREE.MathUtils.radToDeg(rotation[0]),
        THREE.MathUtils.radToDeg(rotation[1]),
        THREE.MathUtils.radToDeg(rotation[2]),
      ];

      if (primitiveType === 'box') {
        cutter = Manifold.cube([1, 1, 1], true) // Unit cube
          .scale(scale)
          .rotate(rotDeg)
          .translate(position);
      } else {
        cutter = Manifold.sphere(0.5, 64) // Radius 0.5 (diameter 1) to match three.js Box scale
          .scale(scale)
          .rotate(rotDeg)
          .translate(position);
      }

      const result = modelManifold.subtract(cutter);
      if (result.isEmpty()) throw new Error('Manifold returned empty mesh — falling back to CSG');

      const resultMesh = result.getMesh();
      const rawVP = resultMesh.vertProperties instanceof Float32Array
        ? resultMesh.vertProperties : new Float32Array(resultMesh.vertProperties);
      const resIndices = resultMesh.triVerts instanceof Uint32Array
        ? resultMesh.triVerts : new Uint32Array(resultMesh.triVerts);

      const unpacked = unpackVertProperties(rawVP, packed.numProp);

      console.log(`[SlicingWorker] Manifold ${primitiveType} subtraction complete:`, unpacked.positions.length / 3, 'verts',
        unpacked.uvs ? '(UVs preserved)' : '(no UVs)');
      return { positions: unpacked.positions, indices: resIndices, uvs: unpacked.uvs };

    } catch (manifoldErr: any) {
      console.warn(`[SlicingWorker] Manifold ${primitiveType} failed, falling back to three-csg-ts:`, manifoldErr.message);
    }

    // Fallback (no UV support)
    if (uvs) {
      console.warn('[SlicingWorker] three-csg-ts fallback does not preserve UVs.');
    }
    const modelGeo = new THREE.BufferGeometry();
    modelGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (indices && indices.length > 0) modelGeo.setIndex(new THREE.BufferAttribute(indices, 1));
    modelGeo.computeVertexNormals();
    const modelMesh = new THREE.Mesh(modelGeo, new THREE.MeshBasicMaterial());
    modelMesh.updateMatrixWorld();

    const cutterGeo = primitiveType === 'box' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.SphereGeometry(0.5, 32, 32);
    const cutterMesh = new THREE.Mesh(cutterGeo, new THREE.MeshBasicMaterial());
    cutterMesh.position.set(...position);
    cutterMesh.rotation.set(...rotation);
    cutterMesh.scale.set(...scale);
    cutterMesh.updateMatrixWorld();

    const resultMesh = CSG.subtract(modelMesh, cutterMesh);
    const resGeo = resultMesh.geometry as THREE.BufferGeometry;
    const resPositions = resGeo.attributes.position.array as Float32Array;
    const resIndices = resGeo.index ? resGeo.index.array as Uint32Array : new Uint32Array(0);

    return { positions: resPositions, indices: resIndices, uvs: null };
  },

  /**
   * Lasso tool: extrude a polygon along extrusion direction and subtract from mesh.
   * polyPoints: flat array of 3D polygon vertices [x0,y0,z0, x1,y1,z1, ...]
   * extrusionDir: unit direction to extrude (camera depth direction)
   * extrusionDepth: how far to extrude (should be ≥ model diameter)
   */
  async subtractMeshWithLasso(
    modelPositions: Float32Array,
    modelIndices: Uint32Array | null,
    polyPoints: Float32Array,
    extrusionDir: [number, number, number],
    extrusionDepth: number,
    modelUVs?: Float32Array | null
  ): Promise<SliceResult> {
    const prepared = ensureIndexed(modelPositions, modelIndices, modelUVs ?? null);
    const { positions, indices, uvs } = prepared;

    // Build extruded prism geometry from polygon
    // Convert poly points to THREE.Vector3 array
    const numVerts = polyPoints.length / 3;
    const polyVerts: THREE.Vector3[] = [];
    for (let i = 0; i < numVerts; i++) {
      polyVerts.push(new THREE.Vector3(polyPoints[i*3], polyPoints[i*3+1], polyPoints[i*3+2]));
    }

    // Build a local coordinate system for the polygon:
    // Z axis = extrusion direction, X/Y axes = polygon plane
    const extDir = new THREE.Vector3(...extrusionDir).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(extDir.dot(up)) > 0.99) up.set(1, 0, 0);
    const localX = new THREE.Vector3().crossVectors(up, extDir).normalize();
    const localY = new THREE.Vector3().crossVectors(extDir, localX).normalize();

    // Project polygon vertices into 2D (local X/Y plane)
    const polyCenter = new THREE.Vector3();
    polyVerts.forEach(v => polyCenter.add(v));
    polyCenter.divideScalar(numVerts);

    // Build a Shape from 2D projections for THREE.js ExtrudeGeometry
    const pts2D: THREE.Vector2[] = polyVerts.map(v => {
      const rel = new THREE.Vector3().subVectors(v, polyCenter);
      return new THREE.Vector2(rel.dot(localX), rel.dot(localY));
    });

    const shape = new THREE.Shape(pts2D);

    // Create extruded geometry
    const extrudeSettings = {
      depth: extrusionDepth,
      bevelEnabled: false,
    };
    const extGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Transform the extruded geometry back to world space
    // Build rotation matrix from local basis
    const rotMatrix = new THREE.Matrix4().makeBasis(localX, localY, extDir);
    // Translate: center the extrusion so it straddles the polygon plane
    const offsetCenter = polyCenter.clone().add(extDir.clone().multiplyScalar(-extrusionDepth / 2));
    const fullMatrix = new THREE.Matrix4()
      .makeTranslation(offsetCenter.x, offsetCenter.y, offsetCenter.z)
      .multiply(rotMatrix);
    extGeo.applyMatrix4(fullMatrix);

    // Merge vertices on the extruded geo for clean boolean ops
    const mergedExtGeo = mergeVertices(extGeo, WELD_TOLERANCE);
    mergedExtGeo.computeVertexNormals();

    try {
      const wasm = await loadManifold();
      const { Manifold } = wasm;

      const packed = packVertProperties(positions, uvs);
      const meshGL = {
        numProp: packed.numProp,
        vertProperties: packed.vertProperties,
        triVerts: indices instanceof Uint32Array ? indices : new Uint32Array(indices),
      };
      const modelManifold = new Manifold(meshGL);

      const cutterGL = {
        numProp: 3,
        vertProperties: new Float32Array(mergedExtGeo.attributes.position.array as Float32Array),
        triVerts: new Uint32Array(mergedExtGeo.index!.array as Uint32Array),
      };
      const cutterManifold = new Manifold(cutterGL);

      const result = modelManifold.subtract(cutterManifold);
      if (result.isEmpty()) throw new Error('Manifold returned empty mesh');

      const resultMesh = result.getMesh();
      const rawVP = resultMesh.vertProperties instanceof Float32Array
        ? resultMesh.vertProperties : new Float32Array(resultMesh.vertProperties);
      const resIndices = resultMesh.triVerts instanceof Uint32Array
        ? resultMesh.triVerts : new Uint32Array(resultMesh.triVerts);

      const unpacked = unpackVertProperties(rawVP, packed.numProp);
      const clamped = clampToOriginalBounds(unpacked.positions, resIndices, modelPositions);

      console.log('[SlicingWorker] Manifold lasso subtraction complete:', clamped.positions.length / 3, 'verts',
        unpacked.uvs ? '(UVs preserved)' : '(no UVs)');
      return { positions: clamped.positions, indices: clamped.indices, uvs: unpacked.uvs };

    } catch (manifoldErr: any) {
      console.warn('[SlicingWorker] Manifold lasso failed, falling back to three-csg-ts:', manifoldErr.message);
    }

    // Fallback: three-csg-ts (no UV support)
    if (uvs) {
      console.warn('[SlicingWorker] three-csg-ts fallback does not preserve UVs.');
    }
    const modelGeo = new THREE.BufferGeometry();
    modelGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (indices && indices.length > 0) modelGeo.setIndex(new THREE.BufferAttribute(indices, 1));
    modelGeo.computeVertexNormals();
    const modelMesh = new THREE.Mesh(modelGeo, new THREE.MeshBasicMaterial());
    modelMesh.updateMatrixWorld();

    const cutterMesh = new THREE.Mesh(mergedExtGeo, new THREE.MeshBasicMaterial());
    cutterMesh.updateMatrixWorld();

    const resultMesh = CSG.subtract(modelMesh, cutterMesh);
    const resGeo = resultMesh.geometry as THREE.BufferGeometry;
    const fallbackPositions = new Float32Array(resGeo.attributes.position.array as Float32Array);
    const fallbackIndices = resGeo.index
      ? new Uint32Array(resGeo.index.array as Uint32Array)
      : new Uint32Array(0);
    const clamped = clampToOriginalBounds(fallbackPositions, fallbackIndices, modelPositions);
    return { positions: clamped.positions, indices: clamped.indices, uvs: null };
  },

  async filterPointCloud(
    _points: Float32Array,
    _toolType: string,
    _toolParams: unknown
  ): Promise<Float32Array> {
    throw new Error('Point cloud filtering not yet implemented. Coming in Phase 5.');
  },
};

expose(slicingAPI);

export type SlicingAPI = typeof slicingAPI;
