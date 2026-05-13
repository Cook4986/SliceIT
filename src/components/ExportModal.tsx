import { useStore } from '../store/useStore';
import type { ExportFormat } from '../types/store';

export function ExportModal() {
  const showExportModal = useStore(s => s.ui.showExportModal);
  const setUIState = useStore(s => s.setUIState);
  const exportModel = useStore(s => s.exportModel);
  const originalFilename = useStore(s => s.model.filename);
  const preserveTextures = useStore(s => s.ui.preserveTextures);
  const hasOriginalMaterial = useStore(s => !!s.model.originalMaterial);

  if (!showExportModal) return null;

  const formats: { id: ExportFormat; label: string; desc: string; supportsTextures: boolean }[] = [
    { id: 'glb', label: 'GLB', desc: 'Binary glTF (Recommended)', supportsTextures: true },
    { id: 'stl', label: 'STL', desc: 'Standard Triangle Language', supportsTextures: false },
    { id: 'obj', label: 'OBJ', desc: 'Wavefront Model', supportsTextures: true },
    { id: 'ply', label: 'PLY', desc: 'Polygon File Format', supportsTextures: false },
    { id: 'gltf', label: 'glTF', desc: 'JSON glTF', supportsTextures: true },
  ];

  // When texture mode is on AND the model has textures, disable geometry-only formats
  const textureConflict = preserveTextures && hasOriginalMaterial;

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
        <p className="modal-subtitle" style={{ color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
          Select your favorite flavor for <strong>{originalFilename || 'your model'}</strong>.
        </p>

        {/* Texture mode banner */}
        {textureConflict && (
          <div className="texture-banner">
            <span style={{ fontSize: '14px' }}>🎨</span>
            <span>Texture mode — some formats are geometry-only</span>
          </div>
        )}

        <div className="format-grid">
          {formats.map((f) => {
            const isDisabled = textureConflict && !f.supportsTextures;
            return (
              <button
                key={f.id}
                className={`format-btn ${isDisabled ? 'format-disabled' : ''}`}
                onClick={() => !isDisabled && handleExport(f.id)}
                disabled={isDisabled}
                title={isDisabled ? `${f.label} does not support textures` : `Export as ${f.label}`}
              >
                <div className="format-btn-row">
                  <div>
                    <div className="format-label" style={{ fontFamily: 'var(--font-heading)' }}>{f.label}</div>
                    <div className="format-desc">{f.desc}</div>
                  </div>
                  <div className="format-badges">
                    {f.supportsTextures && preserveTextures && hasOriginalMaterial && (
                      <span className="format-badge badge-texture">🎨 Textures</span>
                    )}
                    {!f.supportsTextures && preserveTextures && hasOriginalMaterial && (
                      <span className="format-badge badge-geo-only">Geometry Only</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
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

        .texture-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
          background: rgba(250, 204, 21, 0.12);
          border: 2px solid rgba(250, 204, 21, 0.3);
          border-radius: 12px;
          padding: 8px 14px;
          margin-bottom: 16px;
          font-size: 12px;
          color: var(--color-accent-yellow);
          font-weight: 700;
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
        }

        .format-btn-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }

        .format-btn:hover:not(.format-disabled) {
          background: var(--color-accent-cyan);
          border-color: white;
          transform: scale(1.02);
        }

        .format-btn:hover:not(.format-disabled) .format-label,
        .format-btn:hover:not(.format-disabled) .format-desc {
          color: var(--color-bg-main);
        }

        .format-btn:hover:not(.format-disabled) .format-badge {
          color: var(--color-bg-main);
          border-color: var(--color-bg-main);
        }

        .format-disabled {
          opacity: 0.35;
          cursor: not-allowed;
          border-style: dashed;
          filter: grayscale(0.5);
        }

        .format-label {
          font-size: 18px;
          color: var(--color-accent-cyan);
        }

        .format-desc {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .format-badges {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }

        .format-badge {
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 8px;
          font-weight: 700;
          white-space: nowrap;
        }

        .badge-texture {
          background: rgba(250, 204, 21, 0.15);
          color: var(--color-accent-yellow);
          border: 1px solid rgba(250, 204, 21, 0.3);
        }

        .badge-geo-only {
          background: rgba(255,255,255,0.06);
          color: var(--color-text-secondary);
          border: 1px solid rgba(255,255,255,0.1);
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
