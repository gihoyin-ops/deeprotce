'use client';

import { useEffect, useState } from 'react';

const MOBILE_MEDIA_QUERY = '(max-width: 639px)';

/**
 * Tracks whether the current viewport is under Tailwind's `sm` breakpoint (< 640px).
 * Starts `false` on SSR and hydrates immediately on mount to avoid hydration mismatches.
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
