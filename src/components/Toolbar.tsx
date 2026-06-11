import { useStore } from '../store/useStore';
import type { ToolType } from '../types/store';
import { SUPPORTED_IMPORT_FORMATS } from '../config/constants';
import { useRef } from 'react';

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
        title="Load It!"
        onClick={() => fileInputRef.current?.click()}
      >
        <span style={{ fontSize: '20px' }}>📂</span>
      </button>
      <button
        className="tool-btn btn-save"
        title="Save It!"
        disabled={!hasModel}
        onClick={() => setUIState({ showExportModal: true })}
      >
        <span style={{ fontSize: '20px' }}>💾</span>
      </button>

      <div className="tool-separator" />

      {tools.map(t => (
        <button
          key={t.type}
          className={`tool-btn ${activeTool === t.type ? 'active' : ''}`}
          title={`${t.label} (${t.shortcut})`}
          disabled={!hasModel}
          onClick={() => setActiveTool(activeTool === t.type ? null : t.type)}
        >
          <span style={{ fontSize: '22px' }}>{t.icon}</span>
        </button>
      ))}

      <div className="tool-separator" />

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
        title="Reverse It!"
        disabled={undoCount === 0}
        onClick={() => undo()}
      >
        <span style={{ fontSize: '20px' }}>↩️</span>
      </button>
      <button
        className="tool-btn"
        title="Repeat It!"
        disabled={redoCount === 0}
        onClick={() => redo()}
      >
        <span style={{ fontSize: '20px' }}>↪️</span>
      </button>

      <div className="tool-separator" />

      {/* Texture Preservation Toggle */}
      <button
        className={`tool-btn texture-toggle ${preserveTextures ? 'texture-on' : ''}`}
        title={preserveTextures
          ? 'Texture Preservation ON — UVs carried through cuts (click to disable)'
          : 'Texture Preservation OFF — geometry-only mode for 3D printing (click to enable)'}
        onClick={() => togglePreserveTextures()}
      >
        <span style={{ fontSize: '18px' }}>{preserveTextures ? '🎨' : '🖤'}</span>
      </button>
      {preserveTextures && hasOriginalMaterial && (
        <span className="texture-indicator">TEX</span>
      )}
    </div>
  );
}
