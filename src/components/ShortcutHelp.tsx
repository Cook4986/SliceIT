import { useStore } from '../store/useStore';

interface Shortcut {
  keys: string[];
  desc: string;
}

const SECTIONS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'Tools',
    items: [
      { keys: ['K'], desc: 'Slice It (knife plane)' },
      { keys: ['L'], desc: 'Rope It (lasso)' },
      { keys: ['B'], desc: 'Cube It (box cutter)' },
      { keys: ['S'], desc: 'Bop It (sphere cutter)' },
      { keys: ['P'], desc: 'Plane cutter' },
      { keys: ['Esc'], desc: 'Cancel drawing / deselect tool' },
    ],
  },
  {
    title: 'Transform',
    items: [
      { keys: ['W'], desc: 'Move gizmo' },
      { keys: ['E'], desc: 'Rotate gizmo' },
      { keys: ['R'], desc: 'Scale gizmo (primitives)' },
    ],
  },
  {
    title: 'Actions',
    items: [
      { keys: ['Enter'], desc: 'Execute slice' },
      { keys: ['⌘/Ctrl', 'Z'], desc: 'Undo' },
      { keys: ['⌘/Ctrl', 'Shift', 'Z'], desc: 'Redo' },
      { keys: ['1', '–', '9'], desc: 'Select viewport' },
      { keys: ['?'], desc: 'Toggle this help' },
    ],
  },
];

export function ShortcutHelp() {
  const showHelp = useStore(s => s.ui.showHelp);
  const setUIState = useStore(s => s.setUIState);

  if (!showHelp) return null;

  return (
    <div
      className="help-overlay"
      onClick={() => setUIState({ showHelp: false })}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="help-card" onClick={e => e.stopPropagation()}>
        <h2>SHORTCUTS!</h2>
        {SECTIONS.map(section => (
          <div key={section.title}>
            <div className="help-section-title">{section.title}</div>
            {section.items.map(item => (
              <div className="help-row" key={item.desc}>
                <span>{item.desc}</span>
                <span className="help-keys">
                  {item.keys.map(k => (
                    <kbd className="help-key" key={k}>{k}</kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
