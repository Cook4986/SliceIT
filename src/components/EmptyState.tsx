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
        <h2 style={{ fontFamily: 'var(--font-logo)', color: 'var(--color-accent-yellow)', margin: '16px 0' }}>
          LOAD IT!
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', maxWidth: '300px' }}>
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

      <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
        <div style={{ background: '#3B20A1', padding: '12px 24px', borderRadius: '24px', border: '3px solid #1E1B4B' }}>
          <span style={{ color: 'var(--color-accent-lime)', fontWeight: 900 }}>3D MESH</span>
        </div>
        <div style={{ background: '#3B20A1', padding: '12px 24px', borderRadius: '24px', border: '3px solid #1E1B4B' }}>
          <span style={{ color: 'var(--color-accent-cyan)', fontWeight: 900 }}>POINT CLOUD</span>
        </div>
      </div>
    </div>
  );
}
