import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { serializeGeometry, deserializeGeometry } from './workerGeometry';

function makeGeometry(withUVs: boolean): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(2, 2, 2);
  if (!withUVs) geo.deleteAttribute('uv');
  return geo;
}

describe('serializeGeometry / deserializeGeometry', () => {
  it('round-trips positions, indices, and normals', () => {
    const geo = makeGeometry(false);
    const entry = serializeGeometry(geo, 'mesh');
    const restored = deserializeGeometry(entry);

    expect(restored.attributes.position.count).toBe(geo.attributes.position.count);
    expect(Array.from(restored.attributes.position.array)).toEqual(
      Array.from(geo.attributes.position.array)
    );
    expect(restored.index).not.toBeNull();
    expect(Array.from(restored.index!.array)).toEqual(Array.from(geo.index!.array));
    expect(restored.attributes.normal).toBeDefined();
  });

  it('round-trips UVs when present (texture-mode undo)', () => {
    const geo = makeGeometry(true);
    const entry = serializeGeometry(geo, 'mesh');
    expect(entry.uvs).not.toBeNull();

    const restored = deserializeGeometry(entry);
    expect(restored.attributes.uv).toBeDefined();
    expect(Array.from(restored.attributes.uv.array)).toEqual(
      Array.from(geo.attributes.uv.array)
    );
  });

  it('stores null UVs when the geometry has none', () => {
    const geo = makeGeometry(false);
    const entry = serializeGeometry(geo, 'mesh');
    expect(entry.uvs).toBeNull();

    const restored = deserializeGeometry(entry);
    expect(restored.attributes.uv).toBeUndefined();
  });

  it('snapshots are detached from the source geometry', () => {
    const geo = makeGeometry(false);
    const entry = serializeGeometry(geo, 'mesh');
    const original0 = entry.positions[0];
    (geo.attributes.position.array as Float32Array)[0] = 999;
    expect(entry.positions[0]).toBe(original0);
  });

  it('computes a bounding sphere on restore', () => {
    const geo = makeGeometry(false);
    const restored = deserializeGeometry(serializeGeometry(geo, 'mesh'));
    expect(restored.boundingSphere).not.toBeNull();
    expect(restored.boundingSphere!.radius).toBeGreaterThan(0);
  });
});
