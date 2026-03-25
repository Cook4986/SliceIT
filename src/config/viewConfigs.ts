import type { ViewConfig } from '../types/store';

/**
 * Camera configurations for all 9 viewports.
 * Position values are direction vectors — they get multiplied
 * by the bounding-sphere-derived distance D at runtime.
 */
export const VIEW_CONFIGS: ViewConfig[] = [
  // Row 1: Top, Front, Right (Orthographic)
  {
    label: 'Top',
    cameraType: 'orthographic',
    position: [0, 1, 0],
    up: [0, 0, -1],
    orbitEnabled: false,
  },
  {
    label: 'Front',
    cameraType: 'orthographic',
    position: [0, 0, 1],
    up: [0, 1, 0],
    orbitEnabled: false,
  },
  {
    label: 'Right',
    cameraType: 'orthographic',
    position: [1, 0, 0],
    up: [0, 1, 0],
    orbitEnabled: false,
  },

  // Row 2: Bottom, Back, Left (Orthographic)
  {
    label: 'Bottom',
    cameraType: 'orthographic',
    position: [0, -1, 0],
    up: [0, 0, 1],
    orbitEnabled: false,
  },
  {
    label: 'Back',
    cameraType: 'orthographic',
    position: [0, 0, -1],
    up: [0, 1, 0],
    orbitEnabled: false,
  },
  {
    label: 'Left',
    cameraType: 'orthographic',
    position: [-1, 0, 0],
    up: [0, 1, 0],
    orbitEnabled: false,
  },

  // Row 3: Iso 1, Iso 2, Iso 3 (Perspective)
  {
    label: 'Iso 1',
    cameraType: 'perspective',
    position: [1, 1, 1],
    up: [0, 1, 0],
    orbitEnabled: true,
  },
  {
    label: 'Iso 2',
    cameraType: 'perspective',
    position: [-1, 1, 1],
    up: [0, 1, 0],
    orbitEnabled: true,
  },
  {
    label: 'Iso 3',
    cameraType: 'perspective',
    position: [1, 1, -1],
    up: [0, 1, 0],
    orbitEnabled: true,
  },
];
