import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { ExportFormat } from '../types/store';

/**
 * Export geometry to a downloadable file.
 */
export function exportGeometry(
  geometry: THREE.BufferGeometry,
  format: ExportFormat,
  originalFilename: string
): void {
  const baseName = originalFilename.replace(/\.[^.]+$/, '');

  // Bug 4a fix: ensure geometry is export-ready.
  // Many exporters (GLTFExporter) require UV coordinates to include the mesh
  // in the scene nodes array. Add a zeroed UV set if none exists.
  if (!geometry.attributes.uv) {
    const posCount = geometry.attributes.position.count;
    geometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(new Float32Array(posCount * 2), 2)
    );
  }

  // Create a temp mesh for exporters that need a scene object
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  // Give the mesh a name so GLTFExporter populates the nodes array.
  // Without this, Blender throws "NoneType object is not iterable" on scene.nodes.
  mesh.name = baseName || 'SliceIT_mesh';
  const scene = new THREE.Scene();
  scene.add(mesh);

  switch (format) {
    case 'stl': {
      const exporter = new STLExporter();
      const result = exporter.parse(scene, { binary: true });
      downloadBlob(result as unknown as DataView, `${baseName}.stl`, 'application/octet-stream');
      break;
    }
    case 'ply': {
      const exporter = new PLYExporter();
      exporter.parse(scene, (result) => {
        const blob = typeof result === 'string'
          ? new Blob([result], { type: 'text/plain' })
          : new Blob([result], { type: 'application/octet-stream' });
        downloadURL(URL.createObjectURL(blob), `${baseName}.ply`);
      });
      break;
    }
    case 'obj': {
      const exporter = new OBJExporter();
      const result = exporter.parse(scene);
      downloadText(result, `${baseName}.obj`, 'text/plain');
      break;
    }
    case 'gltf':
    case 'glb': {
      const exporter = new GLTFExporter();
      const binary = format === 'glb';
      exporter.parse(
        scene,
        (result) => {
          if (result instanceof ArrayBuffer) {
            // Bug 4a fix: GLB spec requires the BIN chunk to be 4-byte aligned.
            // Pad the buffer so MeshLab / Blender don't reject it.
            const padded = padTo4Bytes(result);
            downloadBlob(padded, `${baseName}.glb`, 'application/octet-stream');
          } else {
            downloadText(JSON.stringify(result), `${baseName}.gltf`, 'model/gltf+json');
          }
        },
        (error) => { throw error; },
        { binary }
      );
      break;
    }
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  // Cleanup
  scene.remove(mesh);
  material.dispose();
}

/**
 * Pad an ArrayBuffer to the next 4-byte boundary with zero bytes.
 * Required by the GLB spec: every chunk length must be a multiple of 4.
 */
function padTo4Bytes(buffer: ArrayBuffer): ArrayBuffer {
  const remainder = buffer.byteLength % 4;
  if (remainder === 0) return buffer;
  const padded = new ArrayBuffer(buffer.byteLength + (4 - remainder));
  new Uint8Array(padded).set(new Uint8Array(buffer));
  return padded;
}



function downloadBlob(data: ArrayBuffer | DataView, filename: string, mime: string): void {
  const bufferData = data instanceof DataView ? data.buffer : data;
  const blob = new Blob([bufferData as ArrayBuffer], { type: mime });
  downloadURL(URL.createObjectURL(blob), filename);
}

function downloadText(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  downloadURL(URL.createObjectURL(blob), filename);
}

function downloadURL(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
