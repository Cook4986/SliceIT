/**
 * Slice It! 90s "Bop It" Theme Configuration
 * High-saturation palette with vibrant accents.
 */

export const COLORS = {
  bg: {
    main: '#2D1B69',     // Deep Purple
    panel: '#3B20A1',    // Mid Purple
    dark: '#1E1B4B',     // Dark Navy
    surface: '#4C2BC7',  // Light Purple
  },
  accent: {
    yellow: '#FACC15',   // Bop It Yellow
    cyan: '#22D3EE',     // Bop It Cyan
    lime: '#A3E635',     // Bop It Lime
    pink: '#F472B6',     // Bop It Pink
    red: '#FB7185',      // Rose/Red
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#A5B4FC',
    dark: '#1E1B4B',
    muted: '#6366F1',
  },
};

export const MATERIALS = {
  model: {
    color: '#FACC15',        // Yellow by default (Bop It Style)
    metalness: 0.1,
    roughness: 0.5,
    emissive: '#000000',
  },
  pointCloud: {
    color: '#22D3EE',        // Cyan
    size: 0.05,
  },
  cutter: {
    color: '#F472B6',        // Pink
    opacity: 0.4,
  },
  cutterWireframe: {
    color: '#FFFFFF',        // White
    opacity: 0.6,
  },
};

export const GRID = {
  main: '#6366F1',
  secondary: '#3B20A1',
};
