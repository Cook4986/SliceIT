import type { SliceResult } from '../workers/csgUtils';

/**
 * Merge two slice halves ("keep both" mode) into one geometry.
 * The second piece is offset along `offset` so the cut reads visually
 * (a slightly exploded view) instead of reassembling into the original.
 *
 * UVs are kept when either half carries them (the half without UVs gets
 * zeros so attribute counts stay consistent).
 */
export function mergeSliceResults(
  a: SliceResult,
  b: SliceResult,
  offset: [number, number, number]
): SliceResult {
  if (b.positions.length === 0) return a;
  if (a.positions.length === 0) return b;

  const aVerts = a.positions.length / 3;
  const bVerts = b.positions.length / 3;

  const positions = new Float32Array((aVerts + bVerts) * 3);
  positions.set(a.positions, 0);
  for (let i = 0; i < bVerts; i++) {
    positions[(aVerts + i) * 3 + 0] = b.positions[i * 3 + 0] + offset[0];
    positions[(aVerts + i) * 3 + 1] = b.positions[i * 3 + 1] + offset[1];
    positions[(aVerts + i) * 3 + 2] = b.positions[i * 3 + 2] + offset[2];
  }

  const indices = new Uint32Array(a.indices.length + b.indices.length);
  indices.set(a.indices, 0);
  for (let i = 0; i < b.indices.length; i++) {
    indices[a.indices.length + i] = b.indices[i] + aVerts;
  }

  let uvs: Float32Array | null = null;
  if (a.uvs || b.uvs) {
    uvs = new Float32Array((aVerts + bVerts) * 2);
    if (a.uvs) uvs.set(a.uvs, 0);
    if (b.uvs) uvs.set(b.uvs, aVerts * 2);
  }

  return { positions, indices, uvs };
}
