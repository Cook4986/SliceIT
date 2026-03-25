import type { ViewConfig } from '../types/store';

interface ViewHelpersProps {
  config: ViewConfig;
}

export function ViewHelpers({ config }: ViewHelpersProps) {
  if (config.cameraType !== 'orthographic') {
    // Perspective views: vibrant purple grid with cyan axes
    return (
      <>
        <gridHelper args={[20, 40, '#6366F1', '#3B20A1']} />
        <axesHelper args={[2]} />
      </>
    );
  }

  // Orthographic views: subtle purple grid
  return (
    <>
      <gridHelper args={[20, 40, '#4C2BC7', '#2D1B69']} />
    </>
  );
}
