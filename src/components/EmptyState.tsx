import { useStore } from '../store/useStore';

export function EmptyState() {
  const importModel = useStore(s => s.importModel);
  const isSlicing = useStore(s => s.operation.isSlicing);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await importModel(file);
  };

  return (
    <div className="empty-state">
      <div className="logo" style={{ fontSize: '64px', marginBottom: '32px' }}>
        <span style={{ color: 'var(--color-accent-pink)' }}>S</span>
        <span style={{ color: 'var(--color-accent-cyan)' }}>L</span>
        <span style={{ color: 'var(--color-accent-yellow)' }}>I</span>
        <span style={{ color: 'var(--color-accent-lime)' }}>C</span>
        <span style={{ color: 'var(--color-accent-pink)' }}>E</span>
        <span style={{ color: 'white', marginLeft: '8px' }}>IT!</span>
      </div>

      <div 
        className="drop-zone"
        onClick={() => document.getElementById('main-import')?.click()}
      >
        <div className="drop-zone-icon">📥</div>
        <h2 style={{ fontFamily: 'var(--font-logo)', color: 'var(--color-accent-yellow)', margin: '16px 0', fontSize: '24px' }}>
          LOAD IT!
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: '300px', fontSize: '12px' }}>
          DROP AN STL, OBJ, OR GLB FILE HERE TO START SLICING!
        </p>
        
        <input
          id="main-import"
          type="file"
          accept=".stl,.obj,.gltf,.glb,.ply,.3mf,.xyz"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={isSlicing}
        />
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
        <button 
          className="preset-btn"
          style={{ background: 'var(--color-accent-cyan)' }}
          onClick={() => useStore.getState().loadPreset('box')}
        >
          Bop It! (Box)
        </button>
      </div>

    </div>
  );
}
