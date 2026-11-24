'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { ArrowLeft, ArrowRight } from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import {
  getSourceSiteName,
  normalizeSourceUrl,
  type SearchSource
} from '@/lib/search/source-display';
import { SourceFavicon } from './StackedFavicons';

interface CitationPillProps {
  sources: SearchSource[];
}

interface PopoverCoords {
  left: number;
  top: number;
  width: number;
  placement: 'bottom' | 'top';
}

export function CitationPill({ sources }: CitationPillProps) {
  const uniqueSources = useMemo(() => {
    const deduped: SearchSource[] = [];
    const seen = new Set<string>();
    for (const source of sources) {
      const key = normalizeSourceUrl(source.url);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(source);
    }
    return deduped;
  }, [sources]);

  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<PopoverCoords>({
    left: 0,
    top: 0,
    width: 340,
    placement: 'bottom'
  });

  const triggerRef = useRef<HTMLAnchorElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLAnchorElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const slideDirRef = useRef<number>(0);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const computePosition = useCallback((): PopoverCoords => {
    const anchor = triggerRef.current;
    if (!anchor || typeof window === 'undefined') {
      return { left: 16, top: 16, width: 340, placement: 'bottom' };
    }
    const rect = anchor.getBoundingClientRect();
    const margin = 12;
    const gap = 8;
    const width = Math.min(352, window.innerWidth - margin * 2);
    const estHeight = uniqueSources.length > 1 ? 186 : 154;

    let left = rect.left;
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin;
    }
    if (left < margin) left = margin;

    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const placement: 'bottom' | 'top' =
      spaceBelow >= estHeight || spaceBelow >= rect.top - margin ? 'bottom' : 'top';
    let top = placement === 'bottom' ? rect.bottom + gap : rect.top - estHeight - gap;
    if (top < margin) top = margin;
    if (top + estHeight > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - estHeight - margin);
    }

    return { left, top, width, placement };
  }, [uniqueSources.length]);

  const openPopover = useCallback(
    (pin: boolean) => {
      clearCloseTimer();
      setCoords(computePosition());
      setIsMounted(true);
      setIsOpen(true);
      if (pin) setIsPinned(true);
    },
    [clearCloseTimer, computePosition]
  );

  const closePopover = useCallback(() => {
    clearCloseTimer();
    setIsPinned(false);
    setIsOpen(false);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    if (isPinned) return;
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 170);
  }, [clearCloseTimer, isPinned]);

  useEffect(() => {
    return () => clearCloseTimer();
  }, [clearCloseTimer]);

  // Reposition on scroll/resize while mounted, and close on Escape or outside click
  useEffect(() => {
    if (!isMounted) return;
    const update = () => setCoords(computePosition());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePopover();
      } else if (isPinned && uniqueSources.length > 1) {
        if (event.key === 'ArrowLeft') {
          slideDirRef.current = -1;
          setActiveIndex(prev => Math.max(0, prev - 1));
        } else if (event.key === 'ArrowRight') {
          slideDirRef.current = 1;
          setActiveIndex(prev => Math.min(uniqueSources.length - 1, prev + 1));
        }
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      closePopover();
    };

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [closePopover, computePosition, isMounted, isPinned, uniqueSources.length]);

  // GSAP open/close animation
  useLayoutEffect(() => {
    if (!isMounted) return;
    const cardEl = popoverRef.current;
    if (!cardEl) return;
    const reduce = prefersReducedMotion();

    gsap.killTweensOf(cardEl);
    if (isOpen) {
      gsap.fromTo(
        cardEl,
        {
          opacity: 0,
          y: reduce ? 0 : coords.placement === 'bottom' ? -6 : 6,
          scale: reduce ? 1 : 0.96
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: reduce ? 0.01 : 0.22,
          ease: 'power3.out',
          clearProps: 'transform'
        }
      );
    } else {
      gsap.to(cardEl, {
        opacity: 0,
        y: reduce ? 0 : coords.placement === 'bottom' ? -4 : 4,
        scale: reduce ? 1 : 0.97,
        duration: reduce ? 0.01 : 0.14,
        ease: 'power2.in',
        onComplete: () => {
          setIsMounted(false);
          setActiveIndex(0);
        }
      });
    }
  }, [coords.placement, isMounted, isOpen]);

  // GSAP pagination slide when flipping between sources
  useLayoutEffect(() => {
    if (!isMounted || slideDirRef.current === 0) return;
    const bodyEl = bodyRef.current;
    const dir = slideDirRef.current;
    slideDirRef.current = 0;
    if (!bodyEl || prefersReducedMotion()) return;

    gsap.killTweensOf(bodyEl);
    gsap.fromTo(
      bodyEl,
      { opacity: 0, x: dir * 12 },
      { opacity: 1, x: 0, duration: 0.2, ease: 'power2.out', clearProps: 'transform,opacity' }
    );
  }, [activeIndex, isMounted]);

  if (uniqueSources.length === 0) return null;

  const primarySource = uniqueSources[0];
  const primarySiteName = getSourceSiteName(primarySource);
  const safeIndex = Math.min(activeIndex, uniqueSources.length - 1);
  const activeSource = uniqueSources[safeIndex];
  const activeSiteName = getSourceSiteName(activeSource);
  const extraCount = uniqueSources.length - 1;

  const handleStep = (delta: -1 | 1) => {
    slideDirRef.current = delta;
    setActiveIndex(prev => Math.min(Math.max(0, prev + delta), uniqueSources.length - 1));
  };

  const handleTriggerClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 640;
    if (uniqueSources.length === 1 && !isSmallScreen) {
      return;
    }
    event.preventDefault();
    if (isOpen && isPinned) {
      closePopover();
    } else {
      openPopover(true);
    }
  };

  return (
    <span className="not-prose relative mx-0.5 inline-flex align-baseline">
      <a
        ref={triggerRef}
        href={primarySource.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleTriggerClick}
        onMouseEnter={() => openPopover(false)}
        onMouseLeave={scheduleClose}
        onFocus={() => openPopover(false)}
        onBlur={scheduleClose}
        aria-label={
          extraCount > 0
            ? `${primarySiteName} and ${extraCount} more source${extraCount === 1 ? '' : 's'}`
            : `Source: ${activeSource.title}`
        }
        aria-expanded={isOpen}
        className="inline-flex h-[22px] max-w-[172px] cursor-pointer items-center gap-1.5 rounded-full !bg-slate-200/75 px-2 py-0.5 !text-[11.5px] font-medium leading-none !text-slate-700 !no-underline transition-colors hover:!bg-slate-200 dark:!bg-slate-800/90 dark:!text-slate-200 dark:hover:!bg-slate-700"
      >
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white dark:bg-slate-900">
          <SourceFavicon source={primarySource} size={13} />
        </span>
        <span className="min-w-0 truncate">{primarySiteName}</span>
        {extraCount > 0 && (
          <span className="shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            +{extraCount}
          </span>
        )}
      </a>

      {isMounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Citation details"
            style={{
              left: coords.left,
              top: coords.top,
              width: coords.width
            }}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
            className="pointer-events-auto fixed z-[70] overflow-hidden rounded-2xl border border-slate-200/90 bg-white text-left shadow-xl shadow-slate-900/12 dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-black/50"
          >
            {uniqueSources.length > 1 && (
              <div className="flex items-center justify-between px-3.5 pt-3 pb-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleStep(-1)}
                    disabled={safeIndex === 0}
                    aria-label="Previous source"
                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStep(1)}
                    disabled={safeIndex === uniqueSources.length - 1}
                    aria-label="Next source"
                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
                <span className="tabular-nums text-[12px] font-medium text-slate-400 dark:text-slate-500">
                  {safeIndex + 1}/{uniqueSources.length}
                </span>
              </div>
            )}

            <a
              ref={bodyRef}
              href={activeSource.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`group block px-3.5 pb-3.5 !no-underline transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 ${
                uniqueSources.length > 1 ? 'pt-2' : 'pt-3.5'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <SourceFavicon source={activeSource} size={15} />
                </span>
                <span className="min-w-0 truncate text-[12.5px] font-medium text-slate-600 dark:text-slate-300">
                  {activeSiteName}
                </span>
              </span>
              <span className="mt-2 block line-clamp-2 text-[14px] font-semibold leading-snug text-slate-900 group-hover:underline dark:text-slate-100">
                {activeSource.title}
              </span>
              {activeSource.snippet && (
                <span className="mt-1.5 block line-clamp-3 text-[12.5px] font-normal leading-relaxed text-slate-500 dark:text-slate-400">
                  {activeSource.snippet}
                </span>
              )}
            </a>
          </div>,
          document.body
        )}
    </span>
  );
}
