import { useStore } from '../store/useStore';
import { formatBytes } from '../utils/fileUtils';
import { VIEW_CONFIGS } from '../config/viewConfigs';

export function StatusBar() {
  const filename = useStore(s => s.model.filename);
  const vertexCount = useStore(s => s.model.vertexCount);
  const faceCount = useStore(s => s.model.faceCount);
  const scaleRatio = useStore(s => s.model.scaleRatio);
  const modelType = useStore(s => s.model.type);
  const fileSize = useStore(s => s.model.fileSize);
  const activeViewIndex = useStore(s => s.activeViewIndex);
  const activeTool = useStore(s => s.tool.activeTool);
  const isSlicing = useStore(s => s.operation.isSlicing);
  const statusText = useStore(s => s.operation.statusText);
  const isDrawingComplete = useStore(s => s.tool.isDrawingComplete);
  const pointCount = useStore(s => s.tool.points.length);

  const activeConfig = VIEW_CONFIGS[activeViewIndex];

  return (
    <div className="status-bar">
      {/* Left: Model Info */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {filename && (
          <>
            <span style={{ color: 'var(--color-accent-yellow)', fontWeight: 700 }}>{filename}</span>
            <span>{vertexCount.toLocaleString()} VERTICES</span>
            {faceCount > 0 && <span>{faceCount.toLocaleString()} FACES</span>}
            <span style={{ textTransform: 'uppercase' }}>{modelType}</span>
            <span>{formatBytes(fileSize)}</span>
            <span style={{ color: 'var(--color-accent-pink)' }}>
              SCALE: {(scaleRatio * 100).toFixed(1)}%
            </span>
          </>
        )}
      </div>

      {/* Center: Active View */}
      <div style={{ fontWeight: 700, color: 'var(--color-accent-lime)' }}>
        {activeConfig.label.toUpperCase()}
      </div>

      {/* Right: Tool / Status */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {isSlicing && (
          <span style={{ color: 'var(--color-accent-pink)', animation: 'pulse 1s infinite' }}>{statusText || 'SLICING...'}</span>
        )}
        {activeTool && !isSlicing && (
          <span>
            {activeTool.toUpperCase()} MODE
            {(activeTool === 'knife' || activeTool === 'lasso') && (
              <span style={{ color: 'var(--color-accent-cyan)', marginLeft: 8 }}>
                {isDrawingComplete ? '✓ READY TO SLICE' : `${pointCount}/${activeTool === 'knife' ? 3 : '3+'} pts`}
              </span>
            )}
          </span>
        )}
        {!activeTool && !isSlicing && (
          <span>READY!</span>
        )}
      </div>
    </div>
  );
}
