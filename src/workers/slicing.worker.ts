/**
 * Slicing Web Worker — CSG via manifold-3d with three-csg-ts fallback.
 *
 * Manifold guarantees watertight output regardless of input mesh quality.
 * A vertex-weld pre-pass (mergeVertices) repairs non-indexed / duplicate-vertex
 * geometry before it reaches the boolean engine.
 */

import { expose } from 'comlink';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CSG } from 'three-csg-ts';

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

/**
 * Strip triangles whose vertices are outside the original model bounds.
 * The half-space cutter (10000³ cube) can leave slivers/spikes at its
 * boundaries after boolean subtraction. This clamps the output to the
 * original model's bounding sphere + a small margin.
 */
function clampToOriginalBounds(
  positions: Float32Array,
  indices: Uint32Array,
  modelPositions: Float32Array
): { positions: Float32Array; indices: Uint32Array } {
  // Compute bounding sphere of the original model
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(modelPositions, 3));
  geo.computeBoundingSphere();
  const center = geo.boundingSphere!.center;
  const radius = geo.boundingSphere!.radius * 1.5; // 50% margin
  const r2 = radius * radius;
  geo.dispose();

  // Filter triangles: keep only those where ALL 3 vertices are inside bounds
  const numProp = 3;
  const keptIndices: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    let keep = true;
    for (let j = 0; j < 3; j++) {
      const vi = indices[i + j];
      const x = positions[vi * numProp] - center.x;
      const y = positions[vi * numProp + 1] - center.y;
      const z = positions[vi * numProp + 2] - center.z;
      if (x * x + y * y + z * z > r2) { keep = false; break; }
    }
    if (keep) {
      keptIndices.push(indices[i], indices[i + 1], indices[i + 2]);
    }
  }

  if (keptIndices.length === indices.length) {
    return { positions, indices }; // Nothing filtered
  }

  console.log(`[SlicingWorker] Clamped: removed ${(indices.length - keptIndices.length) / 3} artifact triangles`);
  return { positions, indices: new Uint32Array(keptIndices) };
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
    normal: [number, number, number]
  ): Promise<{ positions: Float32Array; indices: Uint32Array }> {

    // ── Step 1: Ensure indexed geometry ────────────────────────────────
    // Non-indexed formats (STL, many OBJ exports) need vertex-welding so
    // Manifold can reason about connectivity.
    let positions = modelPositions;
    let indices = modelIndices;

    if (!indices || indices.length === 0) {
      const tempGeo = new THREE.BufferGeometry();
      tempGeo.setAttribute('position', new THREE.BufferAttribute(modelPositions, 3));
      // mergeVertices welds duplicate verts within tolerance → makes geometry manifold-friendly
      const indexed = mergeVertices(tempGeo, 1e-4);
      indexed.computeVertexNormals();
      positions = indexed.attributes.position.array as Float32Array;
      indices = indexed.index!.array as Uint32Array;
    }

    // ── Step 2: Manifold CSG ────────────────────────────────────────────
    try {
      const wasm = await loadManifold();
      const { Manifold } = wasm;

      // Build Manifold mesh from input geometry.
      // Manifold automatically repairs winding order during construction.
      const meshGL = {
        numProp: 3,
        vertProperties: positions instanceof Float32Array ? positions : new Float32Array(positions),
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

      const size = 10000;
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

      // vertProperties may contain only position data (numProp=3)
      const resPositions = resultMesh.vertProperties instanceof Float32Array
        ? resultMesh.vertProperties
        : new Float32Array(resultMesh.vertProperties);
      const resIndices = resultMesh.triVerts instanceof Uint32Array
        ? resultMesh.triVerts
        : new Uint32Array(resultMesh.triVerts);

      console.log('[SlicingWorker] Manifold subtraction complete:', resPositions.length / 3, 'verts');
      return clampToOriginalBounds(resPositions, resIndices, positions);

    } catch (manifoldErr: any) {
      console.warn('[SlicingWorker] Manifold failed, falling back to three-csg-ts:', manifoldErr.message);
    }

    // ── Step 3: three-csg-ts fallback ──────────────────────────────────
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

    const size = 10000;
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
    return clampToOriginalBounds(fallbackPositions, fallbackIndices, positions);
  },

  async subtractMeshWithPrimitive(
    modelPositions: Float32Array,
    modelIndices: Uint32Array | null,
    primitiveType: 'box' | 'sphere',
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ): Promise<{ positions: Float32Array; indices: Uint32Array }> {
    let positions = modelPositions;
    let indices = modelIndices;

    if (!indices || indices.length === 0) {
      const tempGeo = new THREE.BufferGeometry();
      tempGeo.setAttribute('position', new THREE.BufferAttribute(modelPositions, 3));
      const indexed = mergeVertices(tempGeo, 1e-4);
      indexed.computeVertexNormals();
      positions = indexed.attributes.position.array as Float32Array;
      indices = indexed.index!.array as Uint32Array;
    }

    try {
      const wasm = await loadManifold();
      const { Manifold } = wasm;

      const meshGL = {
        numProp: 3,
        vertProperties: positions instanceof Float32Array ? positions : new Float32Array(positions),
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
      const resPositions = resultMesh.vertProperties instanceof Float32Array
        ? resultMesh.vertProperties : new Float32Array(resultMesh.vertProperties);
      const resIndices = resultMesh.triVerts instanceof Uint32Array
        ? resultMesh.triVerts : new Uint32Array(resultMesh.triVerts);

      console.log(`[SlicingWorker] Manifold ${primitiveType} subtraction complete:`, resPositions.length / 3, 'verts');
      return { positions: resPositions, indices: resIndices };

    } catch (manifoldErr: any) {
      console.warn(`[SlicingWorker] Manifold ${primitiveType} failed, falling back to three-csg-ts:`, manifoldErr.message);
    }

    // Fallback
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

    return { positions: resPositions, indices: resIndices };
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
