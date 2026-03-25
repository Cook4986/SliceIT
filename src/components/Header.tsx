import { Toolbar } from './Toolbar';

export function Header() {
  return (
    <header className="header">
      <div className="logo">
        <span style={{ color: 'var(--color-accent-pink)' }}>S</span>
        <span style={{ color: 'var(--color-accent-cyan)' }}>L</span>
        <span style={{ color: 'var(--color-accent-yellow)' }}>I</span>
        <span style={{ color: 'var(--color-accent-lime)' }}>C</span>
        <span style={{ color: 'var(--color-accent-pink)' }}>E</span>
        <span style={{ color: 'white', marginLeft: '4px' }}>IT!</span>
      </div>

      <Toolbar />

      <div style={{ width: 44 }} /> {/* Spacer */}
    </header>
  );
}
