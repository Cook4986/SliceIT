import { useEffect, useState } from 'react';

/**
 * Slice It! is a precision, multi-viewport 3D tool built around a mouse and a
 * large canvas. Rather than degrade that experience on phones, we gate the
 * whole app behind a desktop-redirect placeholder.
 *
 * "Mobile" here means either a genuinely narrow viewport OR a coarse-pointer
 * (touch-first) device that isn't wide enough to host the multi-viewport grid.
 * Combining the two avoids two classic false positives:
 *   - a narrow desktop browser window (caught by width, but it has a fine
 *     pointer + hover, so we still treat sub-breakpoint widths as mobile to be
 *     safe — a 600px desktop window can't run the grid comfortably either), and
 *   - a large touchscreen / 2-in-1 in desktop mode (fine pointer, wide enough).
 */
const MOBILE_QUERY =
  '(max-width: 768px), (pointer: coarse) and (hover: none) and (max-width: 1024px)';

function getMatches(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(getMatches);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);

    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
