import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { detectFormat } from '../utils/fileUtils';

/**
 * Load a 3D model file and return its BufferGeometry.
 */
export async function loadModelFile(file: File): Promise<THREE.BufferGeometry> {
  const format = detectFormat(file.name);
  if (!format) {
    throw new Error(`Unsupported file format: ${file.name}`);
  }

  const arrayBuffer = await file.arrayBuffer();

  switch (format) {
    case '.stl':
      return loadSTL(arrayBuffer);
    case '.obj':
      return loadOBJ(await file.text());
    case '.gltf':
    case '.glb':
      return loadGLTF(arrayBuffer, file.name);
    case '.ply':
      return loadPLY(arrayBuffer);
    case '.xyz':
      return loadXYZ(await file.text());
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

function loadOBJ(text: string): THREE.BufferGeometry {
  const loader = new OBJLoader();
  const group = loader.parse(text);

  // Extract geometry from the first mesh in the group
  let geometry: THREE.BufferGeometry | null = null;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && !geometry) {
      geometry = child.geometry;
    }
  });

  if (!geometry) {
    throw new Error('No geometry found in OBJ file.');
  }

  return geometry;
}

async function loadGLTF(buffer: ArrayBuffer, _filename: string): Promise<THREE.BufferGeometry> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(buffer, '', (gltf) => {
      let geometry: THREE.BufferGeometry | null = null;
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh && !geometry) {
          geometry = child.geometry;
        }
      });

      if (!geometry) {
        reject(new Error('No geometry found in glTF file.'));
        return;
      }

      resolve(geometry);
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
