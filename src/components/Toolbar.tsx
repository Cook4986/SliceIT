import { useStore } from '../store/useStore';
import type { ToolType } from '../types/store';
import { useRef } from 'react';

export function Toolbar() {
  const activeTool = useStore(s => s.tool.activeTool);
  const hasModel = useStore(s => s.model.geometry !== null);
  const isSlicing = useStore(s => s.operation.isSlicing);
  const undoCount = useStore(s => s.undoStack.length);
  const redoCount = useStore(s => s.redoStack.length);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const setActiveTool = useStore(s => s.setActiveTool);
  const importModel = useStore(s => s.importModel);
  const executeSlice = useStore(s => s.executeSlice);
  const undo = useStore(s => s.undo);
  const redo = useStore(s => s.redo);
  const setUIState = useStore(s => s.setUIState);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importModel(file);
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const tools: { type: ToolType; icon: string; label: string; shortcut: string }[] = [
    { type: 'box', icon: '📦', label: 'Bop It! (Box)', shortcut: 'B' },
    { type: 'sphere', icon: '🎾', label: 'Bop It! (Sphere)', shortcut: 'S' },
    { type: 'plane', icon: '📏', label: 'Bop It! (Plane)', shortcut: 'P' },
    { type: 'knife', icon: '🔪', label: 'Flick It!', shortcut: 'K' },
    { type: 'lasso', icon: '➰', label: 'Spin It!', shortcut: 'L' },
  ];

  return (
    <div className="toolbar">
      {/* File Operations */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".stl,.obj,.gltf,.glb,.ply,.3mf,.xyz"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        className="tool-btn"
        title="Load It!"
        onClick={() => fileInputRef.current?.click()}
      >
        📂
      </button>
      <button
        className="tool-btn"
        title="Save It!"
        disabled={!hasModel}
        onClick={() => setUIState({ showExportModal: true })}
      >
        💾
      </button>

      <div className="tool-separator" />

      {/* Cutting Tools */}
      {tools.map(t => (
        <button
          key={t.type}
          className={`tool-btn ${activeTool === t.type ? 'active' : ''}`}
          title={`${t.label} (${t.shortcut})`}
          disabled={!hasModel}
          onClick={() => setActiveTool(activeTool === t.type ? null : t.type)}
        >
          {t.icon}
        </button>
      ))}

      <div className="tool-separator" />

      {/* Slice! */}
      <button
        className={`slice-btn ${isSlicing ? 'slicing' : ''}`}
        disabled={!hasModel || !activeTool || isSlicing}
        onClick={() => executeSlice()}
      >
        {isSlicing ? '⏳' : '✅'} Slice It!
      </button>

      <div className="tool-separator" />

      {/* Transform Modes moved to separate tooltips or kept? 
          The user said "remove corresponding controls from header UI" 
          but then said "support click/drag in window".
          I'll remove them from here.
      */}

      {/* Undo / Redo */}
      <button
        className="tool-btn"
        title="Reverse It!"
        disabled={undoCount === 0}
        onClick={() => undo()}
      >
        ↩️
      </button>
      <button
        className="tool-btn"
        title="Repeat It!"
        disabled={redoCount === 0}
        onClick={() => redo()}
      >
        ↪️
      </button>
    </div>
  );
}
