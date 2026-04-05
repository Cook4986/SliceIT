/**
 * Slicing Web Worker — stub for Phase 1.
 * Full CSG (manifold3d) and point cloud filtering will be implemented in Phase 5.
 */

import { expose } from 'comlink';
import * as THREE from 'three';
import { CSG } from 'three-csg-ts';

let initialized = false;

const slicingAPI = {
  async init(): Promise<void> {
    if (initialized) return;
    console.log('[SlicingWorker] CSG Engine Initialized');
    initialized = true;
  },

  async subtractMeshWithPlane(
    modelPositions: Float32Array,
    modelIndices: Uint32Array | null,
    origin: [number, number, number],
    normal: [number, number, number]
  ): Promise<{ positions: Float32Array; indices: Uint32Array }> {
    // 1. Reconstruct Model Geometry
    const modelGeo = new THREE.BufferGeometry();
    modelGeo.setAttribute('position', new THREE.BufferAttribute(modelPositions, 3));
    if (modelIndices && modelIndices.length > 0) {
        modelGeo.setIndex(new THREE.BufferAttribute(modelIndices, 1));
    } else {
        // If no indices, compute them or leave it since three-csg-ts requires indexed geometry sometimes?
        // Actually CSG handles non-indexed as well by creating faces from triplets.
    }
    modelGeo.computeVertexNormals();

    const modelMesh = new THREE.Mesh(modelGeo, new THREE.MeshBasicMaterial());
    modelMesh.updateMatrixWorld();

    // 2. Construct the Cutter Box
    // Create a very large box that represents the volume to remove.
    // The plane normal indicates the outward direction of the cut (or inner, depending on convention).
    // Let's assume the box removes everything behind the plane (anti-normal direction).
    const size = 10000;
    const cutterGeo = new THREE.BoxGeometry(size, size, size);
    
    // The BoxGeometry is centered at [0,0,0]. We shift it so that its top face (Z face, for example) aligns with origin.
    cutterGeo.translate(0, 0, -size / 2);

    const cutterMesh = new THREE.Mesh(cutterGeo, new THREE.MeshBasicMaterial());
    
    // Position cutter at the plane origin
    cutterMesh.position.set(origin[0], origin[1], origin[2]);
    
    // Orient the cutter so its local +Z axis aligns with the plane normal.
    // Thus the box (which extends into -Z) removes the half-space opposite to the normal.
    cutterMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(normal[0], normal[1], normal[2]).normalize()
    );
    cutterMesh.updateMatrixWorld();

    // 3. Perform Boolean Subtraction
    modelMesh.geometry.computeBoundingBox();
    modelMesh.geometry.computeBoundingSphere();
    
    try {
        const resultMesh = CSG.subtract(modelMesh, cutterMesh);
        const resGeo = resultMesh.geometry as THREE.BufferGeometry;

        const resPositions = resGeo.attributes.position.array as Float32Array;
        const resIndices = resGeo.index ? resGeo.index.array as Uint32Array : new Uint32Array(0);

        return { positions: resPositions, indices: resIndices };
    } catch (err: any) {
        throw new Error(`CSG Operation Failed: ${err.message}`);
    }
  },

  async filterPointCloud(
    _points: Float32Array,
    _toolType: string,
    _toolParams: unknown
  ): Promise<Float32Array> {
    // Phase 5: BVH spatial filtering
    throw new Error('Point cloud filtering not yet implemented. Coming in Phase 5.');
  },
};

expose(slicingAPI);

export type SlicingAPI = typeof slicingAPI;
