import { useStore } from '../store/useStore';
import type { SliceMode } from '../types/store';

const MODES: { id: SliceMode; icon: string; name: string; desc: string }[] = [
  { id: 'subtract', icon: '✂️', name: 'CUT', desc: 'Remove the tool volume from the model' },
  { id: 'intersect', icon: '🎯', name: 'KEEP', desc: 'Keep only what the tool covers' },
  { id: 'both', icon: '💥', name: 'BOTH', desc: 'Keep both halves, exploded apart (meshes only)' },
];

export function SettingsModal() {
  const showSettings = useStore(s => s.ui.showSettings);
  const setUIState = useStore(s => s.setUIState);
  const sliceMode = useStore(s => s.sliceMode);
  const setSliceMode = useStore(s => s.setSliceMode);
  const preserveTextures = useStore(s => s.ui.preserveTextures);
  const togglePreserveTextures = useStore(s => s.togglePreserveTextures);
  const undoDepth = useStore(s => s.ui.undoDepth);

  if (!showSettings) return null;

  return (
    <div className="settings-overlay" onClick={() => setUIState({ showSettings: false })}>
      <div
        className="settings-card"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <h2 id="settings-title">TWEAK IT!</h2>

        <div className="settings-section">Slice mode</div>
        <div className="settings-modes">
          {MODES.map(m => (
            <button
              key={m.id}
              className={`settings-mode-btn ${sliceMode === m.id ? 'selected' : ''}`}
              onClick={() => setSliceMode(m.id)}
              aria-pressed={sliceMode === m.id}
            >
              <span className="settings-mode-head">
                <span aria-hidden="true">{m.icon}</span> {m.name}
              </span>
              <span className="settings-mode-desc">{m.desc}</span>
            </button>
          ))}
        </div>

        <div className="settings-section">Textures</div>
        <label className="settings-row">
          <span>
            Preserve textures through cuts
            <span className="settings-hint">UVs carried through CSG; off = geometry-only (3D print)</span>
          </span>
          <input
            type="checkbox"
            checked={preserveTextures}
            onChange={() => togglePreserveTextures()}
          />
        </label>

        <div className="settings-section">History</div>
        <label className="settings-row">
          <span>
            Undo depth: <strong>{undoDepth}</strong>
            <span className="settings-hint">Each step stores a full mesh snapshot — higher uses more memory</span>
          </span>
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            value={undoDepth}
            onChange={e => setUIState({ undoDepth: Number(e.target.value) })}
          />
        </label>

        <button className="settings-close" onClick={() => setUIState({ showSettings: false })}>
          DONE!
        </button>
      </div>
    </div>
  );
}
