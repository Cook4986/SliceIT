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
  const transformMode = useStore(s => s.tool.transformMode);
  const setTransformMode = useStore(s => s.setTransformMode);

  const activeConfig = VIEW_CONFIGS[activeViewIndex];
  const isPrimitiveTool = activeTool === 'box' || activeTool === 'sphere' || activeTool === 'plane';
  const showModeToggle = isPrimitiveTool || (isDrawingComplete && (activeTool === 'knife' || activeTool === 'lasso'));

  const pillBtn = (active: boolean, color: string) => ({
    background: active ? color : 'transparent',
    color: active ? '#0F0A28' : color,
    border: `1px solid ${color}`,
    borderRadius: '10px',
    padding: '1px 9px',
    cursor: 'pointer',
    fontWeight: 700,
    fontFamily: 'inherit',
    fontSize: '10px',
    letterSpacing: '0.04em',
    lineHeight: '18px',
  } as React.CSSProperties);

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

      {/* Center: Active View label + Move/Rotate/Scale toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
        <span style={{ color: 'var(--color-accent-lime)' }}>
          {activeConfig.label.toUpperCase()}
        </span>
        {showModeToggle && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>·</span>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <button
                style={pillBtn(transformMode === 'translate', '#22D3EE')}
                onClick={() => setTransformMode('translate')}
              >↔ MOVE [W]</button>
              <button
                style={pillBtn(transformMode === 'rotate', '#F472B6')}
                onClick={() => setTransformMode('rotate')}
              >↻ ROTATE [E]</button>
              {isPrimitiveTool && (
                <button
                  style={pillBtn(transformMode === 'scale', '#A3E635')}
                  onClick={() => setTransformMode('scale')}
                >⇲ SCALE [R]</button>
              )}
            </div>
          </>
        )}
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
              {isDrawingComplete ? '✓ READY TO SLICE' : activeTool === 'lasso' ? `${pointCount} PTS — CLICK FIRST POINT TO CLOSE` : `${pointCount}/${VIEW_CONFIGS[activeViewIndex]?.cameraType === 'orthographic' ? 2 : 3} pts`}
              </span>
            )}
          </span>
        )}
        {!activeTool && !isSlicing && (
          <span>READY!</span>
        )}
        <span style={{ color: 'var(--color-text-muted)' }}>? = SHORTCUTS</span>
        <a
          href="https://github.com/Cook4986/SliceIT"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
          title="View source on GitHub"
          aria-label="View source on GitHub"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
