'use client';

/**
 * Checks if a touch on `target` belongs to a slider, input, or horizontal scroller so we don't hijack it for drawer swipes
 */
export function shouldIgnoreHorizontalSwipe(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  let current: Element | null = target;
  while (current && current !== document.body && current !== document.documentElement) {
    if (
      current.matches(
        '[data-gesture-ignore], [role="slider"], input, textarea, select, button[data-no-swipe]'
      )
    ) {
      return true;
    }

    if (current instanceof HTMLElement) {
      const style = window.getComputedStyle(current);
      const overflowX = style.overflowX;
      if (
        (overflowX === 'auto' || overflowX === 'scroll') &&
        current.scrollWidth > current.clientWidth + 2
      ) {
        return true;
      }
    }

    current = current.parentElement;
  }

  return false;
}

/**
 * True if some modal or bottom sheet is already blocking the screen
 */
export function hasBlockingModalOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.querySelector('[aria-modal="true"], [data-mobile-overlay="true"]')
  );
}

/**
 * Buzzes the phone slightly if the browser supports it, silently eats any bs errors
 */
export function triggerSubtleHaptic(duration = 8): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(duration);
    }
  } catch {
    // Browser doesn't support vibrate, whatever, ignore it
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
