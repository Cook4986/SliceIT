import { useState, useEffect } from 'react';
import type { ViewConfig } from '../types/store';
import { VIEW_CONFIGS } from '../config/viewConfigs';

/**
 * Dynamic viewport scaling rules using Iso 2 (index 0) as the anchor.
 */

interface ViewportLayout {
  configs: ViewConfig[];
  indices: number[];
  columns: number;
  rows: number;
}

// Iso 2 is at VIEW_CONFIGS[0]
const LAYOUT_RULES: { minWidth: number; indices: number[]; columns: number; rows: number }[] = [
  // 9 views: Iso 2 is the exact center (index 4 in the grid)
  { minWidth: 1400, indices: [1, 2, 3, 6, 0, 4, 7, 5, 8], columns: 3, rows: 3 },
  // 4 views: Iso 2 is in the bottom-right
  { minWidth: 1000, indices: [1, 2, 3, 0], columns: 2, rows: 2 },
  // 2 views: Iso 2 is the right-hand view
  { minWidth: 600,  indices: [1, 0], columns: 2, rows: 1 },
  // 1 view: Iso 2 is the only view (Mobile)
  { minWidth: 0,    indices: [0], columns: 1, rows: 1 },
];

function getLayout(width: number): ViewportLayout {
  for (const rule of LAYOUT_RULES) {
    if (width >= rule.minWidth) {
      return {
        configs: rule.indices.map(i => VIEW_CONFIGS[i]),
        indices: rule.indices,
        columns: rule.columns,
        rows: rule.rows,
      };
    }
  }
  return { configs: [VIEW_CONFIGS[0]], indices: [0], columns: 1, rows: 1 };
}

export function useResponsiveViewports(): ViewportLayout {
  const [layout, setLayout] = useState<ViewportLayout>(() => 
    getLayout(typeof window !== 'undefined' ? window.innerWidth : 1400)
  );

  useEffect(() => {
    function handleResize() {
      setLayout(getLayout(window.innerWidth));
    }

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return layout;
}
