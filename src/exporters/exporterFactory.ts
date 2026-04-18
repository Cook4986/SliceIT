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

      // Deep-clone geometry so the exporter gets fresh, well-typed attributes.
      // Manifold/CSG worker returns raw typed arrays that can confuse the
      // GLTFExporter's internal buffer-view serializer (producing an empty BIN
      // chunk). Rebuilding guarantees clean THREE.BufferAttributes throughout.
      const exportGeo = new THREE.BufferGeometry();

      // Position — always copy into a fresh Float32Array
      const srcPos = geometry.attributes.position;
      exportGeo.setAttribute('position',
        new THREE.Float32BufferAttribute(
          new Float32Array(srcPos.array as Float32Array), 3
        )
      );

      // Index — copy to Uint32Array for large meshes
      if (geometry.index) {
        exportGeo.setIndex(
          new THREE.BufferAttribute(new Uint32Array(geometry.index.array as Uint32Array), 1)
        );
      }

      // Normals — recompute from the cloned geometry for consistency
      exportGeo.computeVertexNormals();

      // UVs — zeroed, required for GLTFExporter to include the mesh
      const vertCount = exportGeo.attributes.position.count;
      if (vertCount === 0) {
        console.warn('[SliceIT Export] Geometry has 0 vertices — nothing to export.');
        return;
      }
      exportGeo.setAttribute('uv',
        new THREE.Float32BufferAttribute(new Float32Array(vertCount * 2), 2)
      );

      const exportMesh = new THREE.Mesh(exportGeo, new THREE.MeshStandardMaterial());
      exportMesh.name = baseName || 'SliceIT_mesh';
      const exportScene = new THREE.Scene();
      exportScene.add(exportMesh);

      exporter.parse(
        exportScene,
        (result) => {
          if (result instanceof ArrayBuffer) {
            downloadBlob(result, `${baseName}.glb`, 'application/octet-stream');
          } else {
            downloadText(JSON.stringify(result), `${baseName}.gltf`, 'model/gltf+json');
          }
          // Cleanup
          exportScene.remove(exportMesh);
          exportGeo.dispose();
          exportMesh.material.dispose();
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
