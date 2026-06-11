import { describe, it, expect } from 'vitest';
import { detectFormat, validateFileSize, formatBytes } from './fileUtils';
import { MAX_FILE_SIZE, FILE_SIZE_WARNING } from '../config/constants';

describe('detectFormat', () => {
  it('accepts supported extensions case-insensitively', () => {
    expect(detectFormat('model.stl')).toBe('.stl');
    expect(detectFormat('MODEL.STL')).toBe('.stl');
    expect(detectFormat('scene.glb')).toBe('.glb');
    expect(detectFormat('points.xyz')).toBe('.xyz');
  });

  it('rejects unsupported extensions', () => {
    expect(detectFormat('model.3mf')).toBeNull(); // no loader implemented
    expect(detectFormat('archive.zip')).toBeNull();
    expect(detectFormat('noextension')).toBeNull();
  });
});

describe('validateFileSize', () => {
  it('accepts small files without warning', () => {
    expect(validateFileSize(1024)).toEqual({ valid: true, warning: false });
  });

  it('warns above the warning threshold', () => {
    const res = validateFileSize(FILE_SIZE_WARNING + 1);
    expect(res.valid).toBe(true);
    expect(res.warning).toBe(true);
    expect(res.message).toBeTruthy();
  });

  it('rejects above the hard limit', () => {
    const res = validateFileSize(MAX_FILE_SIZE + 1);
    expect(res.valid).toBe(false);
    expect(res.message).toBeTruthy();
  });
});

describe('formatBytes', () => {
  it('formats sizes with sensible units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
  });
});
