import type { ViewConfig } from '../types/store';

/**
 * Camera configurations for all viewports.
 * Iso 2 (index 0) is the primary window for mobile and center for 3x3.
 */
export const VIEW_CONFIGS: ViewConfig[] = [
  {
    label: 'Iso 2', // Primary Centerpiece
    cameraType: 'perspective',
    position: [1, 1, 1],
    up: [0, 1, 0],
    orbitEnabled: true,
  },
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
  {
    label: 'Iso 1',
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
