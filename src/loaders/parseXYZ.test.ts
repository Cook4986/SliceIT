import { describe, it, expect } from 'vitest';
import { parseXYZ } from './loaderFactory';

describe('parseXYZ', () => {
  it('parses valid space-delimited points', () => {
    const geo = parseXYZ('0 0 0\n1 2 3\n-4.5 6.7e1 .5');
    expect(geo.attributes.position.count).toBe(3);
    const arr = geo.attributes.position.array;
    expect(arr[3]).toBe(1);
    expect(arr[4]).toBe(2);
    expect(arr[5]).toBe(3);
  });

  it('skips comment lines and blank lines', () => {
    const geo = parseXYZ('# header comment\n\n// another comment\n1 1 1\n');
    expect(geo.attributes.position.count).toBe(1);
  });

  it('skips lines with non-finite or garbage coordinates', () => {
    // parseFloat would have accepted '1abc' as 1 — Number() must not.
    const geo = parseXYZ('1abc 2 3\nNaN 1 2\nInfinity 0 0\n5 5 5');
    expect(geo.attributes.position.count).toBe(1);
    expect(geo.attributes.position.array[0]).toBe(5);
  });

  it('skips lines with fewer than 3 columns', () => {
    const geo = parseXYZ('1 2\n3\n7 8 9');
    expect(geo.attributes.position.count).toBe(1);
  });

  it('throws when no valid points exist', () => {
    expect(() => parseXYZ('# only comments\ngarbage line')).toThrow(/No valid points/);
  });

  it('tolerates extra columns (intensity / rgb)', () => {
    const geo = parseXYZ('1 2 3 255 0 0\n4 5 6 0.5');
    expect(geo.attributes.position.count).toBe(2);
  });
});
