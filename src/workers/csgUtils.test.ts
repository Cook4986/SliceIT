import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  packVertProperties,
  unpackVertProperties,
  clampToOriginalBounds,
  ensureIndexed,
} from './csgUtils';

describe('packVertProperties / unpackVertProperties', () => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);

  it('packs positions only as numProp=3', () => {
    const { numProp, vertProperties } = packVertProperties(positions, null);
    expect(numProp).toBe(3);
    expect(vertProperties).toEqual(positions);
  });

  it('interleaves UVs as numProp=5', () => {
    const { numProp, vertProperties } = packVertProperties(positions, uvs);
    expect(numProp).toBe(5);
    expect(vertProperties.length).toBe(15);
    // Vertex 1: x=1, u=1
    expect(vertProperties[5]).toBe(1);
    expect(vertProperties[8]).toBe(1);
  });

  it('ignores UV arrays of mismatched length', () => {
    const { numProp } = packVertProperties(positions, new Float32Array([0, 0]));
    expect(numProp).toBe(3);
  });

  it('round-trips pack → unpack losslessly', () => {
    const packed = packVertProperties(positions, uvs);
    const unpacked = unpackVertProperties(packed.vertProperties, packed.numProp);
    expect(unpacked.positions).toEqual(positions);
    expect(unpacked.uvs).toEqual(uvs);
  });

  it('returns null UVs when unpacking numProp=3', () => {
    const unpacked = unpackVertProperties(positions, 3);
    expect(unpacked.uvs).toBeNull();
    expect(unpacked.positions).toEqual(positions);
  });
});

describe('clampToOriginalBounds', () => {
  it('keeps triangles inside the model bounds untouched', () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const indices = new Uint32Array([0, 1, 2]);
    const result = clampToOriginalBounds(positions, indices, positions);
    expect(result.indices).toBe(indices);
  });

  it('strips triangles far outside the original bounding sphere', () => {
    // Model: unit triangle near origin. Result mesh: that triangle plus an
    // artifact triangle 1000 units away (half-space cutter sliver).
    const model = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      1000, 1000, 1000, 1001, 1000, 1000, 1000, 1001, 1000,
    ]);
    const indices = new Uint32Array([0, 1, 2, 3, 4, 5]);
    const result = clampToOriginalBounds(positions, indices, model);
    expect(Array.from(result.indices)).toEqual([0, 1, 2]);
  });
});

describe('ensureIndexed', () => {
  it('passes through already-indexed geometry', () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const indices = new Uint32Array([0, 1, 2]);
    const result = ensureIndexed(positions, indices, null);
    expect(result.positions).toBe(positions);
    expect(result.indices).toBe(indices);
  });

  it('welds duplicated vertices in non-indexed (STL-style) geometry', () => {
    // Two triangles sharing an edge, expressed as 6 unwelded vertices.
    const soup = new THREE.BufferGeometry();
    soup.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      1, 0, 0, 1, 1, 0, 0, 1, 0,
    ]), 3));
    const nonIndexed = soup.attributes.position.array as Float32Array;

    const result = ensureIndexed(nonIndexed, null, null);
    // 6 input verts → 4 unique after welding the shared edge
    expect(result.positions.length / 3).toBe(4);
    expect(result.indices.length).toBe(6);
  });
});
