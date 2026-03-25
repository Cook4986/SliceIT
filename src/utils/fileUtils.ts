import { SUPPORTED_IMPORT_FORMATS, MAX_FILE_SIZE, FILE_SIZE_WARNING } from '../config/constants';

/**
 * Detect format from file extension.
 */
export function detectFormat(filename: string): string | null {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  if (SUPPORTED_IMPORT_FORMATS.includes(ext)) {
    return ext;
  }
  return null;
}

/**
 * Validate file size. Returns an object with the validation result.
 */
export function validateFileSize(size: number): { valid: boolean; warning: boolean; message?: string } {
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      warning: false,
      message: `File is too large (${formatBytes(size)}). Maximum allowed is ${formatBytes(MAX_FILE_SIZE)}.`,
    };
  }

  if (size > FILE_SIZE_WARNING) {
    return {
      valid: true,
      warning: true,
      message: `File is ${formatBytes(size)} — performance may be degraded.`,
    };
  }

  return { valid: true, warning: false };
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
