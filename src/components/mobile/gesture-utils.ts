'use client';

/**
 * Determines whether a touch gesture originating at `target` should yield
 * to an interactive control or horizontal scroll region instead of triggering
 * global mobile drawer swiping.
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
 * Checks whether a blocking modal or bottom sheet is currently mounted on screen.
 */
export function hasBlockingModalOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.querySelector('[aria-modal="true"], [data-mobile-overlay="true"]')
  );
}

/**
 * Fires a subtle micro-vibration on supported mobile devices without throwing.
 */
export function triggerSubtleHaptic(duration = 8): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(duration);
    }
  } catch {
    // ignore unsupported vibration errors
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
