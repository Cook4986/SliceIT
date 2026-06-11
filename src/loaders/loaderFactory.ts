import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { detectFormat } from '../utils/fileUtils';
import { MAX_VERTICES } from '../config/constants';

/**
 * Result from loading a 3D model file.
 * Preserves both geometry AND original material/textures when available.
 */
export interface LoadResult {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[] | null;
}

/**
 * Load a 3D model file and return its BufferGeometry + original material.
 */
export async function loadModelFile(file: File): Promise<LoadResult> {
  const format = detectFormat(file.name);
  if (!format) {
    throw new Error(`Unsupported file format: ${file.name}`);
  }

  const arrayBuffer = await file.arrayBuffer();
  let result: LoadResult;

  switch (format) {
    case '.stl':
      result = { geometry: loadSTL(arrayBuffer), material: null };
      break;
    case '.obj':
      result = loadOBJ(await file.text());
      break;
    case '.gltf':
    case '.glb':
      result = await loadGLTF(arrayBuffer, file.name);
      break;
    case '.ply':
      result = { geometry: loadPLY(arrayBuffer), material: null };
      break;
    case '.xyz':
      result = { geometry: parseXYZ(await file.text()), material: null };
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  // Post-parse vertex budget: the byte-size check can't catch dense ASCII
  // formats that decode to enormous meshes. Reject before any further
  // processing (centering, normals, CSG, undo serialization).
  const vertexCount = result.geometry.attributes.position?.count ?? 0;
  if (vertexCount > MAX_VERTICES) {
    result.geometry.dispose();
    throw new Error(
      `Model has ${vertexCount.toLocaleString()} vertices — the maximum is ${MAX_VERTICES.toLocaleString()}.`
    );
  }

  return result;
}

function loadSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const loader = new STLLoader();
  return loader.parse(buffer);
}

function loadOBJ(text: string): LoadResult {
  const loader = new OBJLoader();
  const group = loader.parse(text);

  // Extract geometry and material from the first mesh in the group
  let geometry: THREE.BufferGeometry | null = null;
  let material: THREE.Material | THREE.Material[] | null = null;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && !geometry) {
      geometry = child.geometry;
      material = child.material;
    }
  });

  if (!geometry) {
    throw new Error('No geometry found in OBJ file.');
  }

  return { geometry, material };
}

async function loadGLTF(buffer: ArrayBuffer, _filename: string): Promise<LoadResult> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(buffer, '', (gltf) => {
      let geometry: THREE.BufferGeometry | null = null;
      let material: THREE.Material | THREE.Material[] | null = null;
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh && !geometry) {
          geometry = child.geometry;
          material = child.material;
        }
      });

      if (!geometry) {
        reject(new Error('No geometry found in glTF file.'));
        return;
      }

      resolve({ geometry, material });
    }, reject);
  });
}

function loadPLY(buffer: ArrayBuffer): THREE.BufferGeometry {
  const loader = new PLYLoader();
  return loader.parse(buffer);
}

/**
 * Parse XYZ point cloud format (space-delimited x y z per line).
 *
 * Hardened against malformed input: comment lines are skipped, every
 * coordinate must be a finite number (strict `Number()` — no `parseFloat`
 * prefix-parsing), and the total point count is capped so a pathological
 * file can't exhaust memory.
 *
 * Exported for unit testing.
 */
export function parseXYZ(text: string): THREE.BufferGeometry {
  const lines = text.split('\n');
  const positions: number[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;

    const x = Number(parts[0]);
    const y = Number(parts[1]);
    const z = Number(parts[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;

    positions.push(x, y, z);
    if (positions.length / 3 > MAX_VERTICES) {
      throw new Error(
        `Point cloud exceeds the ${MAX_VERTICES.toLocaleString()}-point limit.`
      );
    }
  }

  if (positions.length === 0) {
    throw new Error('No valid points found in XYZ file.');
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}
