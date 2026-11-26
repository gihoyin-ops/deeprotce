'use client';

import { useEffect, useState } from 'react';

const MOBILE_MEDIA_QUERY = '(max-width: 639px)';

/**
 * Checks if the viewport is narrower than Tailwind's `sm` breakpoint (< 640px).
 * Starts `false` on SSR and updates right after mount so React doesn't shit itself over hydration mismatches.
 */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    const update = () => setIsMobile(mq.matches);
    const frame = window.requestAnimationFrame(update);
    mq.addEventListener('change', update);
    return () => {
      window.cancelAnimationFrame(frame);
      mq.removeEventListener('change', update);
    };
  }, []);

  return isMobile;
}
