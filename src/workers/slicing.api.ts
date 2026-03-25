import { wrap } from 'comlink';
import type { SlicingAPI } from './slicing.worker';

let worker: Worker | null = null;
let api: ReturnType<typeof wrap<SlicingAPI>> | null = null;

/**
 * Get (or create) the slicing worker API via Comlink.
 */
export function getSlicingAPI(): ReturnType<typeof wrap<SlicingAPI>> {
  if (!worker) {
    worker = new Worker(
      new URL('./slicing.worker.ts', import.meta.url),
      { type: 'module' }
    );
    api = wrap<SlicingAPI>(worker);
  }
  return api!;
}

/**
 * Terminate the slicing worker.
 */
export function terminateSlicingWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    api = null;
  }
}
