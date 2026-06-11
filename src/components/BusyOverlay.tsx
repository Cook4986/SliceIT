import { useStore } from '../store/useStore';

/**
 * Full-screen busy indicator shown while a model import or slice runs.
 * Slices (worker-bound, potentially slow on dense meshes) can be cancelled;
 * imports are near-instant local parses, so they can't.
 */
export function BusyOverlay() {
  const isSlicing = useStore(s => s.operation.isSlicing);
  const statusText = useStore(s => s.operation.statusText);
  const cancelSlice = useStore(s => s.cancelSlice);

  if (!isSlicing) return null;

  const isWorkerSlice = statusText === 'Slicing...';

  return (
    <div className="busy-overlay" role="status" aria-live="polite">
      <div className="busy-card">
        <div className="busy-spinner" aria-hidden="true" />
        <div className="busy-status">{statusText || 'Working...'}</div>
        {isWorkerSlice && (
          <button className="busy-cancel" onClick={cancelSlice}>
            CANCEL
          </button>
        )}
      </div>
    </div>
  );
}
