'use client';

import React, { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ChevronRight, Globe } from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import type { SearchSource, SearchStatus } from '@/lib/search/source-display';
import { StackedFavicons } from './StackedFavicons';

interface SearchStatusIndicatorProps {
  status?: SearchStatus;
  sources: SearchSource[];
  isSidebarOpen?: boolean;
  onOpenSearchResults: () => void;
}

export function SearchStatusIndicator({
  status,
  sources,
  isSidebarOpen = false,
  onOpenSearchResults
}: SearchStatusIndicatorProps) {
  const isSearching = status === 'searching';
  const hasSources = sources.length > 0;

  const rootRef = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const chevronRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    const ctx = gsap.context(() => {
      if (isSearching) {
        if (reduce) return;
        if (shimmerRef.current) {
          gsap.fromTo(
            shimmerRef.current,
            { backgroundPosition: '130% 50%' },
            {
              backgroundPosition: '-130% 50%',
              duration: 1.75,
              ease: 'none',
              repeat: -1
            }
          );
        }
        if (iconRef.current) {
          gsap.fromTo(
            iconRef.current,
            { opacity: 0.45, scale: 0.94 },
            {
              opacity: 0.95,
              scale: 1.06,
              duration: 1.05,
              ease: 'sine.inOut',
              repeat: -1,
              yoyo: true
            }
          );
        }
        return;
      }

      if (hasSources && buttonRef.current) {
        gsap.fromTo(
          buttonRef.current,
          { opacity: 0, y: reduce ? 0 : 4 },
          {
            opacity: 1,
            y: 0,
            duration: reduce ? 0.01 : 0.3,
            ease: 'power3.out',
            clearProps: 'transform'
          }
        );
      }
    }, rootRef);

    return () => ctx.revert();
  }, [isSearching, hasSources]);

  const handleMouseEnter = () => {
    if (prefersReducedMotion() || !buttonRef.current) return;
    if (chevronRef.current) {
      gsap.to(chevronRef.current, { x: 2.5, duration: 0.2, ease: 'power2.out' });
    }
    const chips = buttonRef.current.querySelectorAll<HTMLElement>('[data-favicon-chip]');
    if (chips.length > 0) {
      gsap.to(chips, {
        scale: 1.08,
        x: (index) => index * 1.5,
        duration: 0.22,
        stagger: 0.02,
        ease: 'power2.out'
      });
    }
  };

  const handleMouseLeave = () => {
    if (prefersReducedMotion() || !buttonRef.current) return;
    if (chevronRef.current) {
      gsap.to(chevronRef.current, { x: 0, duration: 0.2, ease: 'power2.out' });
    }
    const chips = buttonRef.current.querySelectorAll<HTMLElement>('[data-favicon-chip]');
    if (chips.length > 0) {
      gsap.to(chips, {
        scale: 1,
        x: 0,
        duration: 0.22,
        ease: 'power2.out'
      });
    }
  };

  if (!isSearching && !hasSources) return null;

  return (
    <div ref={rootRef} className="mb-2.5 flex max-w-full items-center">
      {isSearching ? (
        <div
          role="status"
          aria-live="polite"
          className="inline-flex select-none items-center gap-2 py-0.5 text-[13.5px] font-medium"
        >
          <span ref={iconRef} className="inline-flex items-center justify-center text-slate-400 dark:text-slate-500">
            <Globe className="h-3.5 w-3.5" />
          </span>
          <span
            ref={shimmerRef}
            style={{ backgroundSize: '240% 100%' }}
            className="bg-gradient-to-r from-slate-400 via-slate-800 to-slate-400 bg-clip-text text-transparent dark:from-slate-500 dark:via-slate-100 dark:to-slate-500 motion-reduce:bg-none motion-reduce:text-slate-500 dark:motion-reduce:text-slate-400"
          >
            Searching the web
          </span>
        </div>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={onOpenSearchResults}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-expanded={isSidebarOpen}
          className={`group inline-flex cursor-pointer items-center gap-2 rounded-full py-1 pr-2 text-[13.5px] font-medium transition-colors ${
            isSidebarOpen
              ? 'text-[var(--dc-text-strong)]'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span>
            Searched {sources.length} source{sources.length === 1 ? '' : 's'}
          </span>
          <StackedFavicons sources={sources} max={4} size="sm" />
          <span ref={chevronRef} className="inline-flex items-center text-slate-400 transition-colors group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </button>
      )}
    </div>
  );
}
