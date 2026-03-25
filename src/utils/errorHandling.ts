import type { ToastType } from '../types/store';

/**
 * Format an error for user display.
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred.';
}

/**
 * Get toast type from error context.
 */
export function getErrorToastType(_error: unknown): ToastType {
  return 'error';
}
