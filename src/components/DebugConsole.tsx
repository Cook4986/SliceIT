import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export function DebugConsole() {
  const showDebugConsole = useStore(s => s.ui.showDebugConsole);
  const logs = useStore(s => s.logs);
  const setUIState = useStore(s => s.setUIState);
  const clearLogs = useStore(s => s.clearLogs);
  
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (showDebugConsole && endRef.current) {
        endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showDebugConsole]);

  // Global hotkey listener (Ctrl+L or ~)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'l') || e.key === '`' || e.key === '~') {
        e.preventDefault();
        setUIState({ showDebugConsole: !useStore.getState().ui.showDebugConsole });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setUIState]);

  if (!showDebugConsole) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '60px', /* Above status bar */
        left: '20px',
        width: '400px',
        maxHeight: '300px',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        border: '2px solid var(--color-accent-pink)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        color: '#00FFCC',
        fontFamily: 'monospace',
        fontSize: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          padding: '8px 12px', 
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          backgroundColor: 'rgba(255,100,200,0.2)',
          fontWeight: 'bold',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
        }}
      >
        <span>RUNTIME LOGS [~ to toggle]</span>
        <div>
            <button 
                onClick={clearLogs}
                style={{ background: 'none', border: 'none', color: '#ff6666', cursor: 'pointer', marginRight: '8px' }}
            >
                Clear
            </button>
            <button 
                onClick={() => setUIState({ showDebugConsole: false })}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
                X
            </button>
        </div>
      </div>
      
      <div 
        style={{ 
          padding: '10px', 
          overflowY: 'auto', 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
      >
        {logs.length === 0 ? (
            <div style={{ color: '#888', fontStyle: 'italic' }}>Listening for events...</div>
        ) : (
            logs.map((log, i) => (
                <div key={i} style={{ wordBreak: 'break-all' }}>{log}</div>
            ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
