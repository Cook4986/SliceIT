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
 *
 * All three public cut methods (plane, primitive, lasso) build a cutter in
 * two representations — a Manifold solid and a THREE.Mesh — then delegate to
 * a single shared `runBoolean` pipeline (Manifold first, JS-CSG fallback).
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

/** Boolean operation to apply between model and cutter.
 *  'subtract' removes the cutter volume; 'intersect' keeps only it. */
export type BooleanOp = 'subtract' | 'intersect';

/** Tool descriptions for point-cloud filtering (no CSG required —
 *  points are kept or removed by analytic containment tests). */
export type PointCloudTool =
  | { kind: 'plane'; origin: [number, number, number]; normal: [number, number, number] }
  | { kind: 'box' | 'sphere';
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number] }
  | { kind: 'lasso'; polyPoints: Float32Array; extrusionDir: [number, number, number] };

// ── Manifold lazy-loader ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let manifoldModule: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadManifold(): Promise<any> {
  if (manifoldModule) return manifoldModule;
  // Dynamic import keeps the WASM out of the initial bundle parse.
  const ManifoldFactory = (await import('manifold-3d')).default;
  manifoldModule = await ManifoldFactory();
  manifoldModule.setup(); // Required by manifold-3d v2+
  return manifoldModule;
}

// ── Shared boolean pipeline ────────────────────────────────────────────────

interface PreparedMesh {
  positions: Float32Array;
  indices: Uint32Array;
  uvs: Float32Array | null;
}

/**
 * Run a boolean op between the prepared model mesh and a cutter, trying
 * Manifold (watertight, UV-preserving) first and falling back to
 * three-csg-ts (no UV support) when Manifold rejects the input.
 *
 * @param buildManifoldCutter Builds the cutter as a Manifold solid.
 * @param buildFallbackCutter Builds the same cutter as a THREE.Mesh
 *                            (matrixWorld already updated).
 * @param clampTo             When set, strips artifact triangles outside the
 *                            bounding sphere of these positions (needed for
 *                            oversized half-space / prism cutters).
 */
async function runBoolean(
  prepared: PreparedMesh,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildManifoldCutter: (wasm: any) => any,
  buildFallbackCutter: () => THREE.Mesh,
  clampTo: Float32Array | null,
  op: BooleanOp,
  label: string
): Promise<SliceResult> {
  const { positions, indices, uvs } = prepared;

  // ── Manifold path ──────────────────────────────────────────────────────
  try {
    const wasm = await loadManifold();
    const { Manifold } = wasm;

    // Manifold automatically repairs winding order during construction.
    const packed = packVertProperties(positions, uvs);
    const modelManifold = new Manifold({
      numProp: packed.numProp,
      vertProperties: packed.vertProperties,
      triVerts: indices,
    });

    const cutter = buildManifoldCutter(wasm);
    const result = op === 'subtract'
      ? modelManifold.subtract(cutter)
      : modelManifold.intersect(cutter);

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

    const unpacked = unpackVertProperties(rawVP, packed.numProp);
    const clamped = clampTo
      ? clampToOriginalBounds(unpacked.positions, resIndices, clampTo)
      : { positions: unpacked.positions, indices: resIndices };

    console.log(`[SlicingWorker] Manifold ${label} ${op} complete:`,
      clamped.positions.length / 3, 'verts',
      unpacked.uvs ? '(UVs preserved)' : '(no UVs)');
    return { positions: clamped.positions, indices: clamped.indices, uvs: unpacked.uvs };
  } catch (manifoldErr) {
    const msg = manifoldErr instanceof Error ? manifoldErr.message : String(manifoldErr);
    console.warn(`[SlicingWorker] Manifold ${label} failed, falling back to three-csg-ts:`, msg);
  }

  // ── three-csg-ts fallback (no UV support) ──────────────────────────────
  if (uvs) {
    console.warn('[SlicingWorker] three-csg-ts fallback does not preserve UVs — textures will be lost on this cut.');
  }

  const modelGeo = new THREE.BufferGeometry();
  modelGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (indices.length > 0) {
    modelGeo.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  modelGeo.computeVertexNormals();
  modelGeo.computeBoundingBox();
  modelGeo.computeBoundingSphere();

  const modelMesh = new THREE.Mesh(modelGeo, new THREE.MeshBasicMaterial());
  modelMesh.updateMatrixWorld();

  const cutterMesh = buildFallbackCutter();
  cutterMesh.updateMatrixWorld();

  const resultMesh = op === 'subtract'
    ? CSG.subtract(modelMesh, cutterMesh)
    : CSG.intersect(modelMesh, cutterMesh);
  const resGeo = resultMesh.geometry as THREE.BufferGeometry;
  const fallbackPositions = new Float32Array(resGeo.attributes.position.array as Float32Array);
  const fallbackIndices = resGeo.index
    ? new Uint32Array(resGeo.index.array as Uint32Array)
    : new Uint32Array(0);

  const clamped = clampTo
    ? clampToOriginalBounds(fallbackPositions, fallbackIndices, clampTo)
    : { positions: fallbackPositions, indices: fallbackIndices };
  return { positions: clamped.positions, indices: clamped.indices, uvs: null };
}

// ── Worker API ────────────────────────────────────────────────────────────
const slicingAPI = {
  async init(): Promise<void> {
    await loadManifold();
    console.log('[SlicingWorker] Manifold CSG Engine Initialized');
  },

  /**
   * Cut with an infinite plane (knife/plane tools). The cutter is a huge
   * half-space cube whose top face contains `origin` with outward `normal`.
   */
  async subtractMeshWithPlane(
    modelPositions: Float32Array,
    modelIndices: Uint32Array | null,
    origin: [number, number, number],
    normal: [number, number, number],
    modelUVs?: Float32Array | null,
    op: BooleanOp = 'subtract'
  ): Promise<SliceResult> {
    const prepared = ensureIndexed(modelPositions, modelIndices, modelUVs ?? null);

    const n = new THREE.Vector3(...normal).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const size = HALF_SPACE_SIZE;

    return runBoolean(
      prepared,
      (wasm) => {
        const euler = new THREE.Euler().setFromQuaternion(q, 'XYZ');
        const rotDeg: [number, number, number] = [
          THREE.MathUtils.radToDeg(euler.x),
          THREE.MathUtils.radToDeg(euler.y),
          THREE.MathUtils.radToDeg(euler.z),
        ];
        // Centered cube translated -size/2 in z → top face at z=0, extends
        // into -z. Rotate local +z onto `normal`, then move to `origin`.
        return wasm.Manifold.cube([size, size, size], true)
          .translate([0, 0, -size / 2])
          .rotate(rotDeg)
          .translate(origin);
      },
      () => {
        const cutterGeo = new THREE.BoxGeometry(size, size, size);
        cutterGeo.translate(0, 0, -size / 2);
        const cutterMesh = new THREE.Mesh(cutterGeo, new THREE.MeshBasicMaterial());
        cutterMesh.position.set(...origin);
        cutterMesh.quaternion.copy(q);
        return cutterMesh;
      },
      prepared.positions, // half-space cutter → clamp boundary slivers
      op,
      'plane'
    );
  },

  /** Cut with a box or sphere primitive matching the on-screen gizmo. */
  async subtractMeshWithPrimitive(
    modelPositions: Float32Array,
    modelIndices: Uint32Array | null,
    primitiveType: 'box' | 'sphere',
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number],
    modelUVs?: Float32Array | null,
    op: BooleanOp = 'subtract'
  ): Promise<SliceResult> {
    const prepared = ensureIndexed(modelPositions, modelIndices, modelUVs ?? null);

    return runBoolean(
      prepared,
      (wasm) => {
        const rotDeg: [number, number, number] = [
          THREE.MathUtils.radToDeg(rotation[0]),
          THREE.MathUtils.radToDeg(rotation[1]),
          THREE.MathUtils.radToDeg(rotation[2]),
        ];
        // Unit-size solids (sphere ∅1 to match three.js box scale semantics)
        const base = primitiveType === 'box'
          ? wasm.Manifold.cube([1, 1, 1], true)
          : wasm.Manifold.sphere(0.5, 64);
        return base.scale(scale).rotate(rotDeg).translate(position);
      },
      () => {
        const cutterGeo = primitiveType === 'box'
          ? new THREE.BoxGeometry(1, 1, 1)
          : new THREE.SphereGeometry(0.5, 32, 32);
        const cutterMesh = new THREE.Mesh(cutterGeo, new THREE.MeshBasicMaterial());
        cutterMesh.position.set(...position);
        cutterMesh.rotation.set(...rotation);
        cutterMesh.scale.set(...scale);
        return cutterMesh;
      },
      null, // bounded cutter → no clamping needed
      op,
      primitiveType
    );
  },

  /**
   * Lasso tool: extrude a polygon along the camera depth direction and cut
   * with the resulting prism.
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
    modelUVs?: Float32Array | null,
    op: BooleanOp = 'subtract'
  ): Promise<SliceResult> {
    const prepared = ensureIndexed(modelPositions, modelIndices, modelUVs ?? null);

    // ── Build the extruded prism cutter ────────────────────────────────
    const numVerts = polyPoints.length / 3;
    const polyVerts: THREE.Vector3[] = [];
    for (let i = 0; i < numVerts; i++) {
      polyVerts.push(new THREE.Vector3(polyPoints[i * 3], polyPoints[i * 3 + 1], polyPoints[i * 3 + 2]));
    }

    // Local coordinate system: Z = extrusion direction, X/Y = polygon plane
    const extDir = new THREE.Vector3(...extrusionDir).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(extDir.dot(up)) > 0.99) up.set(1, 0, 0);
    const localX = new THREE.Vector3().crossVectors(up, extDir).normalize();
    const localY = new THREE.Vector3().crossVectors(extDir, localX).normalize();

    const polyCenter = new THREE.Vector3();
    polyVerts.forEach(v => polyCenter.add(v));
    polyCenter.divideScalar(numVerts);

    // Project polygon vertices into 2D for THREE.js ExtrudeGeometry
    const pts2D: THREE.Vector2[] = polyVerts.map(v => {
      const rel = new THREE.Vector3().subVectors(v, polyCenter);
      return new THREE.Vector2(rel.dot(localX), rel.dot(localY));
    });

    const shape = new THREE.Shape(pts2D);
    const extGeo = new THREE.ExtrudeGeometry(shape, { depth: extrusionDepth, bevelEnabled: false });

    // Transform the extruded geometry back to world space; center the
    // extrusion so it straddles the polygon plane.
    const rotMatrix = new THREE.Matrix4().makeBasis(localX, localY, extDir);
    const offsetCenter = polyCenter.clone().add(extDir.clone().multiplyScalar(-extrusionDepth / 2));
    const fullMatrix = new THREE.Matrix4()
      .makeTranslation(offsetCenter.x, offsetCenter.y, offsetCenter.z)
      .multiply(rotMatrix);
    extGeo.applyMatrix4(fullMatrix);

    // Weld the extruded geo for clean boolean ops
    const mergedExtGeo = mergeVertices(extGeo, WELD_TOLERANCE);
    mergedExtGeo.computeVertexNormals();

    return runBoolean(
      prepared,
      (wasm) => new wasm.Manifold({
        numProp: 3,
        vertProperties: new Float32Array(mergedExtGeo.attributes.position.array as Float32Array),
        triVerts: new Uint32Array(mergedExtGeo.index!.array as Uint32Array),
      }),
      () => new THREE.Mesh(mergedExtGeo, new THREE.MeshBasicMaterial()),
      modelPositions, // prism extends far beyond the model → clamp slivers
      op,
      'lasso'
    );
  },

  /**
   * Filter a point cloud against a cutting tool. Unlike meshes, points need
   * no CSG: each point is kept or dropped by an analytic containment test.
   * 'subtract' keeps points OUTSIDE the tool volume; 'intersect' keeps the
   * points INSIDE it.
   */
  async filterPointCloud(
    points: Float32Array,
    tool: PointCloudTool,
    op: BooleanOp = 'subtract'
  ): Promise<Float32Array> {
    const count = points.length / 3;

    // Per-tool "is this point inside the cutter volume" predicate.
    let insideTest: (x: number, y: number, z: number) => boolean;

    if (tool.kind === 'plane') {
      // The mesh half-space cutter occupies the −normal side of the plane.
      const [ox, oy, oz] = tool.origin;
      const n = new THREE.Vector3(...tool.normal).normalize();
      insideTest = (x, y, z) =>
        (x - ox) * n.x + (y - oy) * n.y + (z - oz) * n.z <= 0;
    } else if (tool.kind === 'lasso') {
      // Lasso: project each point onto the polygon's plane basis and run a
      // 2D point-in-polygon test (the prism is treated as infinite along
      // the extrusion direction — it always punches through the cloud).
      // Destructured locals: TS narrowing does not survive into closures.
      const { polyPoints, extrusionDir } = tool;
      const extDir = new THREE.Vector3(...extrusionDir).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      if (Math.abs(extDir.dot(up)) > 0.99) up.set(1, 0, 0);
      const localX = new THREE.Vector3().crossVectors(up, extDir).normalize();
      const localY = new THREE.Vector3().crossVectors(extDir, localX).normalize();

      const polyCount = polyPoints.length / 3;
      const px: number[] = [];
      const py: number[] = [];
      const v = new THREE.Vector3();
      for (let i = 0; i < polyCount; i++) {
        v.set(polyPoints[i * 3], polyPoints[i * 3 + 1], polyPoints[i * 3 + 2]);
        px.push(v.dot(localX));
        py.push(v.dot(localY));
      }

      insideTest = (x, y, z) => {
        v.set(x, y, z);
        const sx = v.dot(localX);
        const sy = v.dot(localY);
        // Ray-casting point-in-polygon
        let inside = false;
        for (let i = 0, j = polyCount - 1; i < polyCount; j = i++) {
          const intersects = ((py[i] > sy) !== (py[j] > sy)) &&
            (sx < (px[j] - px[i]) * (sy - py[i]) / (py[j] - py[i]) + px[i]);
          if (intersects) inside = !inside;
        }
        return inside;
      };
    } else {
      // Box / sphere: transform points into the primitive's local space;
      // the primitives are unit-sized (cube 1³, sphere ∅1) under their TRS —
      // same convention as the mesh cutters.
      const isBox = tool.kind === 'box';
      const mat = new THREE.Matrix4().compose(
        new THREE.Vector3(...tool.position),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...tool.rotation)),
        new THREE.Vector3(...tool.scale)
      ).invert();
      const v = new THREE.Vector3();
      insideTest = isBox
        ? (x, y, z) => {
            v.set(x, y, z).applyMatrix4(mat);
            return Math.abs(v.x) <= 0.5 && Math.abs(v.y) <= 0.5 && Math.abs(v.z) <= 0.5;
          }
        : (x, y, z) => {
            v.set(x, y, z).applyMatrix4(mat);
            return v.lengthSq() <= 0.25; // radius 0.5
          };
    }

    const kept: number[] = [];
    const keepInside = op === 'intersect';
    for (let i = 0; i < count; i++) {
      const x = points[i * 3];
      const y = points[i * 3 + 1];
      const z = points[i * 3 + 2];
      if (insideTest(x, y, z) === keepInside) {
        kept.push(x, y, z);
      }
    }

    console.log(`[SlicingWorker] Point cloud filter (${tool.kind}, ${op}): kept ${kept.length / 3}/${count} points`);
    return new Float32Array(kept);
  },
};

expose(slicingAPI);

export type SlicingAPI = typeof slicingAPI;
