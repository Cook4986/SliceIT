import * as THREE from 'three';
import type { SliceItStore, SliceMode } from '../types/store';
import { VIEW_CONFIGS } from '../config/viewConfigs';
import { LASSO_EXTRUSION_FACTOR, KEEP_BOTH_EXPLODE_FRACTION } from '../config/constants';
import { serializeGeometry } from '../utils/workerGeometry';
import { mergeSliceResults } from '../utils/mergeSliceResults';
import { getSlicingAPI, terminateSlicingWorker } from '../workers/slicing.api';
import type { SliceResult } from '../workers/csgUtils';
import type { BooleanOp, PointCloudTool } from '../workers/slicing.worker';
import type { SliceCreator } from './storeTypes';

export type OperationSlice = Pick<
  SliceItStore,
  'operation' | 'executeSlice' | 'cancelSlice' | 'sliceMode' | 'setSliceMode'
>;

export const createOperationSlice: SliceCreator<OperationSlice> = (set, get) => ({
  operation: {
    isSlicing: false,
    progress: 0,
    statusText: '',
  },

  sliceMode: 'subtract',

  setSliceMode: (mode: SliceMode) => {
    set({ sliceMode: mode });
    const labels: Record<SliceMode, string> = {
      subtract: 'CUT — remove the tool volume',
      intersect: 'KEEP — keep only the tool volume',
      both: 'BOTH — keep both halves (exploded)',
    };
    get().addToast('info', `Slice mode: ${labels[mode]}`);
  },

  executeSlice: async () => {
    const { model, tool, addLog } = get();

    // Reentrancy guard: Enter / FloatingInspector can fire while a slice is
    // already running. A second concurrent slice would race the first one's
    // worker result and corrupt the model.
    if (get().operation.isSlicing) {
      addLog('Slicing blocked: a slice is already in progress.');
      return;
    }

    if (!model.geometry || !tool.activeTool) {
      addLog('Slicing blocked: Missing geometry or active tool.');
      get().addToast('warning', 'Select a tool and load a model first.');
      return;
    }

    const isKnifeOrLasso = tool.activeTool === 'knife' || tool.activeTool === 'lasso';
    if (isKnifeOrLasso && !tool.isDrawingComplete) {
      addLog('Slicing blocked: Drawing not complete yet.');
      get().addToast('warning', 'Finish placing all points first.');
      return;
    }

    // Staleness token: if the model geometry changes while the worker runs
    // (new import, preset load, undo), the result must be discarded instead
    // of being applied to the wrong mesh.
    const sourceGeometry = model.geometry;

    try {
      addLog(`Preparing to slice using ${tool.activeTool} tool.`);
      // Snapshot now, but only push onto the undo stack once the slice
      // actually succeeds — failed or unsupported slices should not leave
      // phantom undo entries.
      const preSliceEntry = serializeGeometry(model.geometry, model.type!);
      set(() => ({ operation: { isSlicing: true, progress: 0, statusText: 'Slicing...' } }));

      const api = getSlicingAPI();
      addLog('Initializing WebWorker for boolean subtraction...');
      await api.init();

      // ── Derive cut parameters (shared by mesh + point-cloud paths) ────

      // Use the stored plane position/normal.
      // planePosition is updated in real-time by the TransformControls write-back
      // in CuttingPlane (defaults to [0,0,0] — origin-lock).
      // planeNormal is derived from the clicked points and updated by rotation.
      let origin: [number, number, number] = [...tool.planePosition] as [number, number, number];
      let normal: [number, number, number] = [...tool.planeNormal] as [number, number, number];

      // Plane primitive: its gizmo writes to tool.transform (not
      // planePosition/planeNormal), so derive the cut from the transform.
      // The GPU preview (useClippingPlanes) clips away the plane's local
      // +Y half-space; the worker's half-space cutter removes the −normal
      // side, so pass the NEGATED local +Y to make the cut match the preview.
      if (tool.activeTool === 'plane') {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...tool.transform.rotation));
        const n = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
        origin = [...tool.transform.position] as [number, number, number];
        normal = [-n.x, -n.y, -n.z];
      }

      // If the normal is still at default [0,1,0] but we have 3 points, recompute
      // from the points as a safety net for cases where updatePlaneOrientation wasn't called.
      const normalIsDefault = normal[0] === 0 && normal[1] === 1 && normal[2] === 0;
      if (tool.activeTool === 'knife' && normalIsDefault && tool.points.length >= 3) {
          const p0 = new THREE.Vector3(...tool.points[0]);
          const p1 = new THREE.Vector3(...tool.points[1]);
          const p2 = new THREE.Vector3(...tool.points[2]);
          const v1 = new THREE.Vector3().subVectors(p1, p0).normalize();
          const v2 = new THREE.Vector3().subVectors(p2, p0).normalize();
          const n = new THREE.Vector3().crossVectors(v1, v2).normalize();
          if (n.lengthSq() > 0.0001) {
              normal = [n.x, n.y, n.z];
          }
      }

      // Lasso: extrude polygon along camera depth direction
      const viewConfig = VIEW_CONFIGS[get().activeViewIndex];
      const camPos = viewConfig?.position ?? [5, 5, 5];
      const camLen = Math.sqrt(camPos[0]**2 + camPos[1]**2 + camPos[2]**2);
      const extrusionDir: [number, number, number] = [
        camPos[0] / camLen,
        camPos[1] / camLen,
        camPos[2] / camLen,
      ];
      const modelRadius = model.boundingSphere?.radius ?? 5;
      // Extrusion depth: punches fully through the model
      const extrusionDepth = modelRadius * LASSO_EXTRUSION_FACTOR;

      const mode = get().sliceMode;

      if (model.type === 'mesh') {
        addLog('Dispatching geometry to worker...');

        // Texture preservation: pass UVs to the worker when toggle is on
        const preserveTextures = get().ui.preserveTextures;
        const hasUVs = !!(model.geometry.attributes.uv);
        if (preserveTextures && hasUVs) {
          addLog('Texture preservation mode: passing UVs to CSG worker.');
        }

        // Run one boolean op against the source geometry. Fresh typed-array
        // copies per call: Comlink may transfer (detach) ArrayBuffers, which
        // would crash the WebGL renderer by leaving the live geometry with
        // detached buffers.
        const runOp = async (op: BooleanOp): Promise<SliceResult> => {
          const posCopy = new Float32Array(sourceGeometry.attributes.position.array as Float32Array);
          const idxCopy = sourceGeometry.index
            ? new Uint32Array(sourceGeometry.index.array as Uint32Array)
            : null;
          const uvCopy = (preserveTextures && hasUVs)
            ? new Float32Array(sourceGeometry.attributes.uv.array as Float32Array)
            : null;

          if (tool.activeTool === 'box' || tool.activeTool === 'sphere') {
            return api.subtractMeshWithPrimitive(
              posCopy, idxCopy, tool.activeTool,
              tool.transform.position, tool.transform.rotation, tool.transform.scale,
              uvCopy, op
            );
          }
          if (tool.activeTool === 'lasso') {
            const polyFlat = new Float32Array(tool.points.flat());
            return api.subtractMeshWithLasso(
              posCopy, idxCopy, polyFlat, extrusionDir, extrusionDepth, uvCopy, op
            );
          }
          return api.subtractMeshWithPlane(posCopy, idxCopy, origin, normal, uvCopy, op);
        };

        let result: SliceResult;
        if (mode === 'both') {
          // Two ops: the kept shell and the cut-away piece, offset apart so
          // the result reads as a cut instead of reassembling seamlessly.
          const keptHalf = await runOp('subtract');
          const cutHalf = await runOp('intersect');

          const offsetDir = new THREE.Vector3();
          if (tool.activeTool === 'knife' || tool.activeTool === 'plane') {
            offsetDir.set(-normal[0], -normal[1], -normal[2]); // toward removed side
          } else if (tool.activeTool === 'lasso') {
            offsetDir.set(...extrusionDir);
          } else {
            // Box/sphere: push the piece away from the model center
            const mc = model.boundingSphere?.center ?? new THREE.Vector3();
            offsetDir.set(
              tool.transform.position[0] - mc.x,
              tool.transform.position[1] - mc.y,
              tool.transform.position[2] - mc.z
            );
            if (offsetDir.lengthSq() < 1e-6) offsetDir.set(0, 1, 0);
          }
          offsetDir.normalize().multiplyScalar(modelRadius * KEEP_BOTH_EXPLODE_FRACTION);
          result = mergeSliceResults(keptHalf, cutHalf, [offsetDir.x, offsetDir.y, offsetDir.z]);
        } else {
          result = await runOp(mode);
        }

        addLog('Worker completed boolean operation successfully.');

        // Staleness check: if the model was replaced while the worker ran
        // (import, preset, undo/redo, clear), this result belongs to a
        // geometry that no longer exists — discard it.
        if (get().model.geometry !== sourceGeometry) {
          addLog('Slice result discarded: model changed during the operation.');
          return;
        }

        const slicedGeometry = new THREE.BufferGeometry();
        slicedGeometry.setAttribute('position', new THREE.BufferAttribute(result.positions, 3));
        if (result.indices.length > 0) {
            slicedGeometry.setIndex(new THREE.BufferAttribute(result.indices, 1));
        }
        slicedGeometry.computeVertexNormals();

        // UV handling: use preserved UVs from worker when available,
        // otherwise add zeroed UVs so GLTFExporter includes the mesh.
        if (result.uvs && result.uvs.length > 0) {
          slicedGeometry.setAttribute(
            'uv',
            new THREE.Float32BufferAttribute(result.uvs, 2)
          );
          addLog('UVs preserved through CSG operation.');
        } else {
          const posCount = slicedGeometry.attributes.position.count;
          slicedGeometry.setAttribute(
            'uv',
            new THREE.Float32BufferAttribute(new Float32Array(posCount * 2), 2)
          );
        }
        slicedGeometry.computeBoundingSphere();

        // Free the GPU buffers of the geometry being replaced — without this
        // every slice leaks the previous mesh.
        sourceGeometry.dispose();

        set(s => ({
            model: {
                ...s.model,
                geometry: slicedGeometry,
                boundingSphere: slicedGeometry.boundingSphere,
                vertexCount: slicedGeometry.attributes.position.count,
                faceCount: result.indices.length > 0 ? result.indices.length / 3 : slicedGeometry.attributes.position.count / 3
            },
            // The slice succeeded — only now does the pre-slice snapshot
            // become an undo entry. New geometry also invalidates any redo
            // future.
            undoStack: [...s.undoStack, preSliceEntry].slice(-s.ui.undoDepth),
            redoStack: [],
        }));

        // Warn if UV preservation was requested but CSG fallback stripped them
        if (preserveTextures && hasUVs && !result.uvs) {
          get().addToast('warning', '⚠️ Textures lost — CSG fallback does not support UV preservation.');
        }

      } else if (model.type === 'pointcloud') {
        addLog('Dispatching point cloud to worker for filtering...');

        // Build the analytic tool description matching the mesh cutters
        let pcTool: PointCloudTool;
        if (tool.activeTool === 'box' || tool.activeTool === 'sphere') {
          pcTool = {
            kind: tool.activeTool,
            position: tool.transform.position,
            rotation: tool.transform.rotation,
            scale: tool.transform.scale,
          };
        } else if (tool.activeTool === 'lasso') {
          pcTool = {
            kind: 'lasso',
            polyPoints: new Float32Array(tool.points.flat()),
            extrusionDir,
          };
        } else {
          pcTool = { kind: 'plane', origin, normal };
        }

        // 'both' is meaningless for point filtering — treat it as subtract.
        const pcOp: BooleanOp = mode === 'intersect' ? 'intersect' : 'subtract';
        if (mode === 'both') {
          addLog("Slice mode 'both' is mesh-only — using CUT for point cloud.");
        }

        const posCopy = new Float32Array(sourceGeometry.attributes.position.array as Float32Array);
        const filtered = await api.filterPointCloud(posCopy, pcTool, pcOp);

        if (get().model.geometry !== sourceGeometry) {
          addLog('Filter result discarded: model changed during the operation.');
          return;
        }

        if (filtered.length === 0) {
          get().addToast('warning', 'That cut would remove every point — nothing applied.');
          addLog('Point filter rejected: empty result.');
          return;
        }

        const filteredGeometry = new THREE.BufferGeometry();
        filteredGeometry.setAttribute('position', new THREE.BufferAttribute(filtered, 3));
        filteredGeometry.computeBoundingSphere();

        sourceGeometry.dispose();

        set(s => ({
          model: {
            ...s.model,
            geometry: filteredGeometry,
            boundingSphere: filteredGeometry.boundingSphere,
            vertexCount: filteredGeometry.attributes.position.count,
            faceCount: 0,
          },
          undoStack: [...s.undoStack, preSliceEntry].slice(-s.ui.undoDepth),
          redoStack: [],
        }));
        addLog(`Point cloud filtered: ${filtered.length / 3} points remain.`);
      }

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown worker error';
      get().addToast('error', `Slicing failed: ${msg}`);
      addLog(`Slicing failed: ${msg}`);
    } finally {
      addLog('Unlocking Slice button state.');
      set({ operation: { isSlicing: false, progress: 100, statusText: '' } });
    }
  },

  cancelSlice: () => {
    if (!get().operation.isSlicing) return;
    // Terminating the worker is the only way to abort a WASM boolean op
    // mid-flight. The orphaned Comlink promise never settles, so the
    // in-progress executeSlice call simply never resumes — its staleness
    // and reentrancy guards make that safe. The next slice lazily spawns
    // a fresh worker.
    terminateSlicingWorker();
    set({ operation: { isSlicing: false, progress: 0, statusText: '' } });
    get().addLog('Slice cancelled — worker terminated.');
    get().addToast('info', 'Slice cancelled.');
  },
});
