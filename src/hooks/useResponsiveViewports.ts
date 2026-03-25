import { useState, useEffect } from 'react';
import type { ViewConfig } from '../types/store';
import { VIEW_CONFIGS } from '../config/viewConfigs';

/**
 * Dynamic viewport scaling rules:
 * 
 * | Window Width   | Viewports | Grid    | Views Selected                        |
 * |----------------|-----------|---------|---------------------------------------|
 * | < 600px        | 1         | 1×1     | Iso 1 (index 6)                       |
 * | 600–999px      | 2         | 2×1     | Top (0), Iso 1 (6)                    |
 * | 1000–1399px    | 4         | 2×2     | Top (0), Front (1), Right (2), Iso 1  |
 * | ≥ 1400px       | 9         | 3×3     | All views                             |
 * 
 * Priority order: Iso perspectives are most useful for general inspection,
 * ortho views add precision as screen real estate permits.
 */

interface ViewportLayout {
  configs: ViewConfig[];
  indices: number[];
  columns: number;
  rows: number;
}

const LAYOUT_RULES: { minWidth: number; indices: number[]; columns: number; rows: number }[] = [
  { minWidth: 1400, indices: [0, 1, 2, 3, 4, 5, 6, 7, 8], columns: 3, rows: 3 },
  { minWidth: 1000, indices: [0, 1, 2, 6],                 columns: 2, rows: 2 },
  { minWidth: 600,  indices: [0, 6],                       columns: 2, rows: 1 },
  { minWidth: 0,    indices: [6],                          columns: 1, rows: 1 },
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
  // Fallback
  return { configs: [VIEW_CONFIGS[6]], indices: [6], columns: 1, rows: 1 };
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
    // Run once on mount to get initial size
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return layout;
}
