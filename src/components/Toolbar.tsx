import { useStore } from '../store/useStore';
import type { ToolType, SliceMode } from '../types/store';
import { SUPPORTED_IMPORT_FORMATS } from '../config/constants';
import { useRef } from 'react';

const MODE_META: Record<SliceMode, { icon: string; label: string; next: SliceMode }> = {
  subtract: { icon: '✂️', label: 'CUT — remove the tool volume', next: 'intersect' },
  intersect: { icon: '🎯', label: 'KEEP — keep only the tool volume', next: 'both' },
  both: { icon: '💥', label: 'BOTH — keep both halves, exploded apart', next: 'subtract' },
};

export function Toolbar() {
  const activeTool = useStore(s => s.tool.activeTool);
  const hasModel = useStore(s => s.model.geometry !== null);
  const isSlicing = useStore(s => s.operation.isSlicing);
  const undoCount = useStore(s => s.undoStack.length);
  const redoCount = useStore(s => s.redoStack.length);
  const preserveTextures = useStore(s => s.ui.preserveTextures);
  const hasOriginalMaterial = useStore(s => !!s.model.originalMaterial);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const setActiveTool = useStore(s => s.setActiveTool);
  const importModel = useStore(s => s.importModel);
  const executeSlice = useStore(s => s.executeSlice);
  const undo = useStore(s => s.undo);
  const redo = useStore(s => s.redo);
  const setUIState = useStore(s => s.setUIState);
  const togglePreserveTextures = useStore(s => s.togglePreserveTextures);
  const sliceMode = useStore(s => s.sliceMode);
  const setSliceMode = useStore(s => s.setSliceMode);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importModel(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const tools: { type: ToolType; icon: string; label: string; shortcut: string }[] = [
    { type: 'knife', icon: '🔪', label: 'Slice It', shortcut: 'K' },
    { type: 'lasso', icon: '🤠', label: 'Rope It', shortcut: 'L' },
    { type: 'box', icon: '📦', label: 'Cube It', shortcut: 'B' },
    { type: 'sphere', icon: '⚽', label: 'Bop It', shortcut: 'S' },
    { type: 'plane', icon: '🛹', label: 'Plane It', shortcut: 'P' },
  ];

  return (
    <div className="toolbar">
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_IMPORT_FORMATS.join(',')}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        className="tool-btn btn-load"
        title="Load It! — import a 3D model"
        aria-label="Load a 3D model"
        onClick={() => fileInputRef.current?.click()}
      >
        <span style={{ fontSize: '20px' }} aria-hidden="true">📂</span>
      </button>
      <button
        className="tool-btn btn-save"
        title="Save It! — export the model"
        aria-label="Export the model"
        disabled={!hasModel}
        onClick={() => setUIState({ showExportModal: true })}
      >
        <span style={{ fontSize: '20px' }} aria-hidden="true">💾</span>
      </button>

      <div className="tool-separator" />

      {tools.map(t => (
        <button
          key={t.type}
          className={`tool-btn ${activeTool === t.type ? 'active' : ''}`}
          title={`${t.label} (${t.shortcut})`}
          aria-label={`${t.label} tool`}
          aria-pressed={activeTool === t.type}
          disabled={!hasModel}
          onClick={() => setActiveTool(activeTool === t.type ? null : t.type)}
        >
          <span style={{ fontSize: '22px' }} aria-hidden="true">{t.icon}</span>
        </button>
      ))}

      <div className="tool-separator" />

      <button
        className="tool-btn"
        title={`Slice mode: ${MODE_META[sliceMode].label} (click to change)`}
        aria-label={`Slice mode: ${MODE_META[sliceMode].label}`}
        onClick={() => setSliceMode(MODE_META[sliceMode].next)}
      >
        <span style={{ fontSize: '18px' }} aria-hidden="true">{MODE_META[sliceMode].icon}</span>
      </button>

      <button
        className={`slice-btn ${isSlicing ? 'slicing' : ''}`}
        disabled={!hasModel || !activeTool || isSlicing}
        onClick={() => executeSlice()}
      >
        {isSlicing ? '⏳ ' : ''}SLICE IT!
      </button>

      <div className="tool-separator" />

      <button
        className="tool-btn"
        title="Reverse It! (⌘Z)"
        aria-label="Undo"
        disabled={undoCount === 0}
        onClick={() => undo()}
      >
        <span style={{ fontSize: '20px' }} aria-hidden="true">↩️</span>
      </button>
      <button
        className="tool-btn"
        title="Repeat It! (⌘⇧Z)"
        aria-label="Redo"
        disabled={redoCount === 0}
        onClick={() => redo()}
      >
        <span style={{ fontSize: '20px' }} aria-hidden="true">↪️</span>
      </button>

      <div className="tool-separator" />

      {/* Texture Preservation Toggle */}
      <button
        className={`tool-btn texture-toggle ${preserveTextures ? 'texture-on' : ''}`}
        title={preserveTextures
          ? 'Texture Preservation ON — UVs carried through cuts (click to disable)'
          : 'Texture Preservation OFF — geometry-only mode for 3D printing (click to enable)'}
        aria-label="Toggle texture preservation"
        aria-pressed={preserveTextures}
        onClick={() => togglePreserveTextures()}
      >
        <span style={{ fontSize: '18px' }} aria-hidden="true">{preserveTextures ? '🎨' : '🖤'}</span>
      </button>
      {preserveTextures && hasOriginalMaterial && (
        <span className="texture-indicator">TEX</span>
      )}

      <button
        className="tool-btn"
        title="Tweak It! — settings"
        aria-label="Open settings"
        onClick={() => setUIState({ showSettings: true })}
      >
        <span style={{ fontSize: '18px' }} aria-hidden="true">⚙️</span>
      </button>
    </div>
  );
}
