import { useStore } from '../store/useStore';
import type { ExportFormat } from '../types/store';

export function ExportModal() {
  const showExportModal = useStore(s => s.ui.showExportModal);
  const setUIState = useStore(s => s.setUIState);
  const exportModel = useStore(s => s.exportModel);
  const originalFilename = useStore(s => s.model.filename);

  if (!showExportModal) return null;

  const formats: { id: ExportFormat; label: string; desc: string }[] = [
    { id: 'glb', label: 'GLB', desc: 'Binary glTF (Recommended)' },
    { id: 'stl', label: 'STL', desc: 'Standard Triangle Language' },
    { id: 'obj', label: 'OBJ', desc: 'Wavefront Model' },
    { id: 'ply', label: 'PLY', desc: 'Polygon File Format' },
    { id: 'gltf', label: 'glTF', desc: 'JSON glTF' },
  ];

  const handleExport = (format: ExportFormat) => {
    exportModel(format);
    setUIState({ showExportModal: false });
  };

  return (
    <div className="modal-overlay" onClick={() => setUIState({ showExportModal: false })}>
      <div className="modal-content bop-it-border" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent-pink)' }}>
          SAVE IT!
        </h2>
        <p className="modal-subtitle" style={{ color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
          Select your favorite flavor for <strong>{originalFilename || 'your model'}</strong>.
        </p>

        <div className="format-grid">
          {formats.map((f) => (
            <button
              key={f.id}
              className="format-btn"
              onClick={() => handleExport(f.id)}
            >
              <div className="format-label" style={{ fontFamily: 'var(--font-heading)' }}>{f.label}</div>
              <div className="format-desc">{f.desc}</div>
            </button>
          ))}
        </div>

        <button 
          className="cancel-btn" 
          onClick={() => setUIState({ showExportModal: false })}
          style={{ 
            marginTop: '24px', 
            background: 'var(--color-bg-panel)',
            border: '2px solid var(--color-border)',
            padding: '10px 20px',
            borderRadius: '12px',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 'bold',
            width: '100%'
          }}
        >
          NOT NOW!
        </button>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(45, 27, 105, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s ease-out;
        }

        .modal-content {
          background: var(--color-bg-panel);
          width: 90%;
          max-width: 450px;
          padding: 30px;
          border-radius: 24px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5), inset 0 0 20px rgba(255,255,255,0.05);
          text-align: center;
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .bop-it-border {
          border: 6px solid var(--color-bg-main);
          outline: 4px solid var(--color-accent-cyan);
        }

        .modal-title {
          font-size: 32px;
          margin-bottom: 8px;
          letter-spacing: 2px;
          text-shadow: 3px 3px 0px rgba(0,0,0,0.2);
        }

        .format-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .format-btn {
          background: rgba(255,255,255,0.05);
          border: 2px solid var(--color-border);
          padding: 12px 20px;
          border-radius: 16px;
          color: white;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
        }

        .format-btn:hover {
          background: var(--color-accent-cyan);
          border-color: white;
          transform: scale(1.02);
        }

        .format-btn:hover .format-label,
        .format-btn:hover .format-desc {
          color: var(--color-bg-main);
        }

        .format-label {
          font-size: 18px;
          color: var(--color-accent-cyan);
        }

        .format-desc {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(40px) scale(0.9); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
