import { Toolbar } from './Toolbar';
import { useStore } from '../store/useStore';

export function Header() {
  const clearModel = useStore(s => s.clearModel);

  return (
    <header className="header">
      <div 
        className="logo" 
        onClick={() => clearModel()}
        style={{ cursor: 'pointer' }}
        title="Go to Home"
      >
        <span className="logo-char" style={{ color: 'var(--color-accent-pink)' }}>S</span>
        <span className="logo-char" style={{ color: 'var(--color-accent-cyan)', animationDelay: '0.1s' }}>L</span>
        <span className="logo-char" style={{ color: 'var(--color-accent-yellow)', animationDelay: '0.2s' }}>I</span>
        <span className="logo-char" style={{ color: 'var(--color-accent-lime)', animationDelay: '0.3s' }}>C</span>
        <span className="logo-char" style={{ color: 'var(--color-accent-pink)', animationDelay: '0.4s' }}>E</span>
        <span className="logo-char" style={{ color: 'white', marginLeft: '8px', animationDelay: '0.5s' }}>IT!</span>
      </div>

      <Toolbar />

      <div style={{ width: 44 }} /> {/* Spacer */}
    </header>
  );
}
