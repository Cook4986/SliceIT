import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { detectFormat } from '../utils/fileUtils';

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

  switch (format) {
    case '.stl':
      return { geometry: loadSTL(arrayBuffer), material: null };
    case '.obj':
      return loadOBJ(await file.text());
    case '.gltf':
    case '.glb':
      return loadGLTF(arrayBuffer, file.name);
    case '.ply':
      return { geometry: loadPLY(arrayBuffer), material: null };
    case '.xyz':
      return { geometry: loadXYZ(await file.text()), material: null };
    case '.3mf':
      throw new Error('3MF loading is not yet implemented.');
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
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
 */
function loadXYZ(text: string): THREE.BufferGeometry {
  const lines = text.trim().split('\n');
  const positions: number[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) {
      positions.push(
        parseFloat(parts[0]),
        parseFloat(parts[1]),
        parseFloat(parts[2])
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
