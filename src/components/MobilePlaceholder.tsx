import { useState } from 'react';

/**
 * Shown in place of the entire app on phones / small touch devices. Slice It!
 * needs a mouse and a wide canvas for precision multi-viewport cutting, so we
 * set that expectation up front instead of shipping a degraded touch build.
 *
 * Rendering this INSTEAD of <App>'s normal tree means none of the heavy machinery
 * (Three.js canvases, slicing workers, global key/drag listeners) ever mounts.
 */
export function MobilePlaceholder() {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard can be blocked (insecure context / permissions). Fall back to
      // a prompt so the user can still grab the link manually.
      window.prompt('Copy this link and open it on your desktop:', url);
    }
  };

  return (
    <div className="mobile-gate" role="alertdialog" aria-labelledby="mobile-gate-title">
      <div className="mobile-gate-card">
        <div className="logo mobile-gate-logo" aria-hidden="true">
          <span className="logo-char" style={{ color: 'var(--color-accent-pink)' }}>S</span>
          <span className="logo-char" style={{ color: 'var(--color-accent-cyan)', animationDelay: '0.1s' }}>L</span>
          <span className="logo-char" style={{ color: 'var(--color-accent-yellow)', animationDelay: '0.2s' }}>I</span>
          <span className="logo-char" style={{ color: 'var(--color-accent-lime)', animationDelay: '0.3s' }}>C</span>
          <span className="logo-char" style={{ color: 'var(--color-accent-pink)', animationDelay: '0.4s' }}>E</span>
          <span className="logo-char" style={{ color: 'white', marginLeft: '8px', animationDelay: '0.5s' }}>IT!</span>
        </div>

        <div className="mobile-gate-icon" aria-hidden="true">🖥️</div>

        <h1 id="mobile-gate-title" className="mobile-gate-title">
          BEST SLICED ON DESKTOP
        </h1>

        <button className="mobile-gate-btn" onClick={handleCopyLink}>
          {copied ? '✓ LINK COPIED!' : '🔗 COPY LINK FOR DESKTOP'}
        </button>

        <p className="mobile-gate-hint">
          Load it · Slice it · Save it
        </p>

        <a
          href="https://github.com/Cook4986/SliceIT"
          target="_blank"
          rel="noopener noreferrer"
          className="mobile-gate-github"
          title="View source on GitHub"
          aria-label="View source on GitHub"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          <span>VIEW SOURCE</span>
        </a>
      </div>
    </div>
  );
}
