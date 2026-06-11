import { Toolbar } from './Toolbar';
import { useStore } from '../store/useStore';

export function Header() {
  const clearModel = useStore(s => s.clearModel);
  const hasModel = useStore(s => s.model.geometry !== null);

  const handleLogoClick = () => {
    // Clearing throws away the model AND its undo history — confirm first.
    if (hasModel && !window.confirm('Clear the current model and return to the start screen? Undo history will be lost.')) {
      return;
    }
    clearModel();
  };

  return (
    <header className="header">
      <div 
        className="logo" 
        onClick={handleLogoClick}
        style={{ cursor: 'pointer' }}
        title={hasModel ? 'Clear model and return to start screen' : 'SLICE IT! home'}
        role="button"
        aria-label="Clear model and return to start screen"
      >
        <span className="logo-char" style={{ color: 'var(--color-accent-pink)' }}>S</span>
        <span className="logo-char" style={{ color: 'var(--color-accent-cyan)', animationDelay: '0.1s' }}>L</span>
        <span className="logo-char" style={{ color: 'var(--color-accent-yellow)', animationDelay: '0.2s' }}>I</span>
        <span className="logo-char" style={{ color: 'var(--color-accent-lime)', animationDelay: '0.3s' }}>C</span>
        <span className="logo-char" style={{ color: 'var(--color-accent-pink)', animationDelay: '0.4s' }}>E</span>
        <span className="logo-char" style={{ color: 'white', marginLeft: '8px', animationDelay: '0.5s' }}>IT!</span>
      </div>

      <Toolbar />

      <div style={{ paddingRight: '20px' }}>
        <a 
          href="https://mncook.net" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            color: '#ff00ff', 
            textShadow: '0 0 5px #ff00ff, 0 0 10px #ff00ff, 0 0 20px #ff00ff', 
            fontFamily: '"Impact", fantasy', 
            fontSize: '1.2rem', 
            textDecoration: 'none', 
            letterSpacing: '2px' 
          }}
        >
          mncook.net
        </a>
      </div>
    </header>
  );
}
