import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { useStore } from './useStore';
import { serializeGeometry } from '../utils/workerGeometry';

function resetStore() {
  useStore.getState().clearModel();
  useStore.setState({
    operation: { isSlicing: false, progress: 0, statusText: '' },
    toasts: [],
    logs: [],
    activeViewIndex: 0,
  });
}

describe('useStore — model lifecycle', () => {
  beforeEach(resetStore);

  it('loadPreset populates model state and clears history', () => {
    useStore.setState({ undoStack: [serializeGeometry(new THREE.BoxGeometry(), 'mesh')] });
    useStore.getState().loadPreset('box', true);

    const s = useStore.getState();
    expect(s.model.geometry).not.toBeNull();
    expect(s.model.type).toBe('mesh');
    expect(s.model.vertexCount).toBeGreaterThan(0);
    expect(s.undoStack).toHaveLength(0);
    expect(s.redoStack).toHaveLength(0);
  });

  it('clearModel resets model and tool state', () => {
    useStore.getState().loadPreset('box', true);
    useStore.getState().setActiveTool('knife');
    useStore.getState().clearModel();

    const s = useStore.getState();
    expect(s.model.geometry).toBeNull();
    expect(s.tool.activeTool).toBeNull();
    expect(s.tool.points).toHaveLength(0);
  });
});

describe('useStore — tool state', () => {
  beforeEach(() => {
    resetStore();
    useStore.getState().loadPreset('box', true);
  });

  it('setActiveTool(knife) starts drawing with a seed point', () => {
    useStore.getState().setActiveTool('knife');
    const s = useStore.getState();
    expect(s.tool.isDrawing).toBe(true);
    expect(s.tool.points).toHaveLength(1);
    expect(s.tool.placementIndex).toBe(0);
  });

  it('setToolPoints replaces all points (lasso gizmo write-back)', () => {
    useStore.getState().setActiveTool('lasso');
    const pts: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
    useStore.getState().setToolPoints(pts);
    expect(useStore.getState().tool.points).toEqual(pts);
  });

  it('knife completes after 2 anchors in an orthographic view', () => {
    const orthoIndex = useStore.getState().viewConfigs
      .findIndex(c => c.cameraType === 'orthographic');
    expect(orthoIndex).toBeGreaterThanOrEqual(0);
    useStore.setState({ activeViewIndex: orthoIndex });

    useStore.getState().setActiveTool('knife');
    useStore.getState().addAnchor([0, 0, 0]);
    expect(useStore.getState().tool.isDrawingComplete).toBe(false);

    useStore.getState().addAnchor([1, 0, 0]);
    const s = useStore.getState();
    expect(s.tool.isDrawingComplete).toBe(true);
    expect(s.tool.placementIndex).toBe(-1);
    // Derived normal must be non-default and unit length
    const [x, y, z] = s.tool.planeNormal;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5);
    // Deploy must also store the full orientation, consistent with the normal
    const q = new THREE.Quaternion(...s.tool.planeQuaternion);
    expect(q.length()).toBeCloseTo(1, 5);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    expect(n.x).toBeCloseTo(x, 5);
    expect(n.y).toBeCloseTo(y, 5);
    expect(n.z).toBeCloseTo(z, 5);
  });

  it('updatePlaneOrientation keeps quaternion, position, and normal in lockstep', () => {
    useStore.getState().setActiveTool('knife');
    // 90° around X: plane normal (0,0,1) → (0,-1,0)
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    useStore.getState().updatePlaneOrientation([1, 2, 3], [q.x, q.y, q.z, q.w], true);

    const s = useStore.getState();
    expect(s.tool.planePosition).toEqual([1, 2, 3]);
    expect(s.tool.planeQuaternion[3]).toBeCloseTo(q.w, 5);
    expect(s.tool.planeNormal[0]).toBeCloseTo(0, 5);
    expect(s.tool.planeNormal[1]).toBeCloseTo(-1, 5);
    expect(s.tool.planeNormal[2]).toBeCloseTo(0, 5);
  });

  it('anchor placements are undoable, and cancelDrawing purges point history', () => {
    useStore.getState().setActiveTool('knife');
    useStore.getState().addAnchor([0, 0, 0]);
    expect(useStore.getState().undoStack.some(e => e.kind === 'points')).toBe(true);

    useStore.getState().undo();
    expect(useStore.getState().tool.placementIndex).toBe(0);
    expect(useStore.getState().redoStack.some(e => e.kind === 'points')).toBe(true);

    useStore.getState().cancelDrawing();
    const s = useStore.getState();
    expect(s.undoStack.some(e => e.kind === 'points')).toBe(false);
    expect(s.redoStack.some(e => e.kind === 'points')).toBe(false);
  });
});

describe('useStore — history', () => {
  beforeEach(() => {
    resetStore();
    useStore.getState().loadPreset('box', true);
  });

  it('undo/redo swap geometry and preserve UVs', () => {
    const before = useStore.getState().model.geometry!;
    const beforeEntry = serializeGeometry(before, 'mesh');
    expect(beforeEntry.uvs).not.toBeNull(); // BoxGeometry has UVs

    // Simulate a successful slice: new geometry + pre-slice undo entry
    const after = new THREE.SphereGeometry(1, 8, 8);
    useStore.setState(s => ({
      model: { ...s.model, geometry: after, vertexCount: after.attributes.position.count },
      undoStack: [beforeEntry],
      redoStack: [],
    }));

    useStore.getState().undo();
    let s = useStore.getState();
    expect(s.model.vertexCount).toBe(beforeEntry.positions.length / 3);
    expect(s.model.geometry!.attributes.uv).toBeDefined();
    expect(s.undoStack).toHaveLength(0);
    expect(s.redoStack).toHaveLength(1);

    useStore.getState().redo();
    s = useStore.getState();
    expect(s.model.vertexCount).toBe(after.attributes.position.count);
    expect(s.undoStack).toHaveLength(1);
    expect(s.redoStack).toHaveLength(0);
  });

  it('undo is a no-op on an empty stack', () => {
    const before = useStore.getState().model.geometry;
    useStore.getState().undo();
    expect(useStore.getState().model.geometry).toBe(before);
  });
});

describe('useStore — executeSlice guards', () => {
  beforeEach(() => {
    resetStore();
    useStore.getState().loadPreset('box', true);
  });

  it('blocks reentrant slices while one is in progress', async () => {
    useStore.getState().setActiveTool('box');
    useStore.setState({ operation: { isSlicing: true, progress: 0, statusText: 'Slicing...' } });

    await useStore.getState().executeSlice();

    const s = useStore.getState();
    expect(s.logs.some(l => l.includes('already in progress'))).toBe(true);
    expect(s.operation.isSlicing).toBe(true); // untouched by the blocked call
  });

  it('blocks knife slices before drawing completes', async () => {
    useStore.getState().setActiveTool('knife');
    await useStore.getState().executeSlice();
    expect(useStore.getState().logs.some(l => l.includes('Drawing not complete'))).toBe(true);
    expect(useStore.getState().operation.isSlicing).toBe(false);
  });
});
