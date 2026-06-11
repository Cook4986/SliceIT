import { describe, it, expect } from 'vitest';
import { mergeSliceResults } from './mergeSliceResults';
import type { SliceResult } from '../workers/csgUtils';

const tri = (x = 0): SliceResult => ({
  positions: new Float32Array([x, 0, 0, x + 1, 0, 0, x, 1, 0]),
  indices: new Uint32Array([0, 1, 2]),
  uvs: null,
});

describe('mergeSliceResults', () => {
  it('concatenates positions and reindexes the second piece', () => {
    const merged = mergeSliceResults(tri(0), tri(5), [0, 0, 0]);
    expect(merged.positions.length).toBe(18);
    expect(Array.from(merged.indices)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(merged.positions[9]).toBe(5); // second piece intact
  });

  it('applies the explode offset to the second piece only', () => {
    const merged = mergeSliceResults(tri(0), tri(0), [10, 0, 0]);
    expect(merged.positions[0]).toBe(0);
    expect(merged.positions[9]).toBe(10);
  });

  it('returns the other half when one side is empty', () => {
    const empty: SliceResult = { positions: new Float32Array(0), indices: new Uint32Array(0), uvs: null };
    const a = tri(0);
    expect(mergeSliceResults(a, empty, [1, 1, 1])).toBe(a);
    expect(mergeSliceResults(empty, a, [1, 1, 1])).toBe(a);
  });

  it('pads missing UVs with zeros when only one half has them', () => {
    const withUVs: SliceResult = { ...tri(0), uvs: new Float32Array([0, 0, 1, 0, 0, 1]) };
    const merged = mergeSliceResults(withUVs, tri(5), [0, 0, 0]);
    expect(merged.uvs).not.toBeNull();
    expect(merged.uvs!.length).toBe(12);
    expect(merged.uvs![2]).toBe(1);
    expect(merged.uvs![6]).toBe(0); // padded
  });
});
