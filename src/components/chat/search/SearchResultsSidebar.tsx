'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { X } from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import {
  formatSourceDate,
  getSourceSiteName,
  type SearchSource
} from '@/lib/search/source-display';
import { SourceFavicon } from './StackedFavicons';

interface SearchResultsSidebarProps {
  open: boolean;
  sources: SearchSource[];
  messageId: string;
  onClose: () => void;
  onExited?: () => void;
}

function SearchResultsList({
  sources,
  listRef
}: {
  sources: SearchSource[];
  listRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3 custom-scrollbar">
      {sources.map((source, index) => {
        const siteName = getSourceSiteName(source);
        const formattedDate = formatSourceDate(source.publishedDate);
        return (
          <a
            key={`${source.url}-${index}`}
            data-search-card
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-2xl px-3.5 py-3 no-underline transition-colors duration-150 hover:bg-[var(--dc-surface-hover)] focus-visible:bg-[var(--dc-surface-hover)] focus-visible:outline-none"
          >
            <div className="flex min-w-0 items-center gap-2 text-[13px] leading-none">
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-700/80">
                <SourceFavicon source={source} size={15} />
              </span>
              <span className="min-w-0 truncate font-medium text-[var(--dc-text-muted)] group-hover:text-[var(--dc-text-body)]">
                {siteName}
              </span>
              {formattedDate && (
                <>
                  <span className="shrink-0 text-[var(--dc-border-strong)]" aria-hidden="true">
                    |
                  </span>
                  <span className="shrink-0 tabular-nums text-[12.5px] text-[var(--dc-text-faint)]">
                    {formattedDate}
                  </span>
                </>
              )}
            </div>
            <h3 className="mt-1.5 line-clamp-2 text-[14.5px] font-semibold leading-[1.4] text-[var(--dc-text-strong)]">
              {source.title}
            </h3>
            {source.snippet && (
              <p className="mt-1.5 line-clamp-3 text-[13px] font-normal leading-[1.55] text-[var(--dc-text-muted)]">
                {source.snippet}
              </p>
            )}
          </a>
        );
      })}
    </div>
  );
}

export function SearchResultsSidebar({
  open,
  sources,
  messageId,
  onClose,
  onExited
}: SearchResultsSidebarProps) {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );

  const asideRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const wasOpenRef = useRef(false);
  const prevMessageIdRef = useRef(messageId);
  const onExitedRef = useRef(onExited);

  useEffect(() => {
    onExitedRef.current = onExited;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const handleChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();

    if (isDesktop) {
      const asideEl = asideRef.current;
      const innerEl = innerRef.current;
      if (!asideEl || !innerEl) return;

      if (open) {
        const isFreshOpen = !wasOpenRef.current;
        wasOpenRef.current = true;

        if (isFreshOpen) {
          const targetWidth = Math.max(310, Math.min(388, Math.round(window.innerWidth * 0.36)));
          gsap.killTweensOf([asideEl, innerEl]);
          gsap.fromTo(
            asideEl,
            { width: 0 },
            {
              width: targetWidth,
              duration: reduce ? 0.01 : 0.36,
              ease: 'power3.out',
              clearProps: 'width'
            }
          );
          gsap.fromTo(
            innerEl,
            { opacity: 0, x: reduce ? 0 : 28 },
            {
              opacity: 1,
              x: 0,
              duration: reduce ? 0.01 : 0.34,
              ease: 'power3.out',
              clearProps: 'transform,opacity'
            }
          );
        }

        if (!reduce && (isFreshOpen || prevMessageIdRef.current !== messageId)) {
          const cards = listRef.current?.querySelectorAll<HTMLElement>('[data-search-card]');
          if (cards && cards.length > 0) {
            gsap.killTweensOf(cards);
            gsap.fromTo(
              cards,
              { opacity: 0, y: 10 },
              {
                opacity: 1,
                y: 0,
                duration: 0.28,
                stagger: 0.03,
                delay: isFreshOpen ? 0.05 : 0,
                ease: 'power2.out',
                clearProps: 'transform,opacity'
              }
            );
          }
        }
        prevMessageIdRef.current = messageId;
        return;
      }

      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        gsap.killTweensOf([asideEl, innerEl]);
        gsap.to(innerEl, {
          opacity: 0,
          x: reduce ? 0 : 24,
          duration: reduce ? 0.01 : 0.2,
          ease: 'power2.in'
        });
        gsap.to(asideEl, {
          width: 0,
          duration: reduce ? 0.01 : 0.26,
          ease: 'power3.inOut',
          onComplete: () => {
            onExitedRef.current?.();
          }
        });
      }
      return;
    }

    const backdropEl = backdropRef.current;
    const panelEl = mobilePanelRef.current;
    if (!panelEl || !backdropEl) return;

    if (open) {
      const isFreshOpen = !wasOpenRef.current;
      wasOpenRef.current = true;
      gsap.killTweensOf([backdropEl, panelEl]);

      if (isFreshOpen) {
        gsap.fromTo(
          backdropEl,
          { opacity: 0 },
          { opacity: 1, duration: reduce ? 0.01 : 0.24, ease: 'power2.out' }
        );
        gsap.fromTo(
          panelEl,
          { x: '100%' },
          {
            x: '0%',
            duration: reduce ? 0.01 : 0.34,
            ease: 'power3.out',
            clearProps: 'transform'
          }
        );
      }

      if (!reduce && (isFreshOpen || prevMessageIdRef.current !== messageId)) {
        const cards = listRef.current?.querySelectorAll<HTMLElement>('[data-search-card]');
        if (cards && cards.length > 0) {
          gsap.killTweensOf(cards);
          gsap.fromTo(
            cards,
            { opacity: 0, y: 10 },
            {
              opacity: 1,
              y: 0,
              duration: 0.26,
              stagger: 0.028,
              delay: isFreshOpen ? 0.05 : 0,
              ease: 'power2.out',
              clearProps: 'transform,opacity'
            }
          );
        }
      }
      prevMessageIdRef.current = messageId;
      return;
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      gsap.killTweensOf([backdropEl, panelEl]);
      gsap.to(backdropEl, {
        opacity: 0,
        duration: reduce ? 0.01 : 0.2,
        ease: 'power2.in'
      });
      gsap.to(panelEl, {
        x: '100%',
        duration: reduce ? 0.01 : 0.24,
        ease: 'power2.in',
        onComplete: () => {
          onExitedRef.current?.();
        }
      });
    }
  }, [isDesktop, messageId, open]);

  if (isDesktop) {
    return (
      <aside
        ref={asideRef}
        aria-label="Search results"
        className="relative h-full shrink-0 overflow-hidden border-l border-[var(--dc-border-subtle)] bg-[var(--dc-canvas)]"
      >
        <div
          ref={innerRef}
          className="flex h-full w-[clamp(310px,36vw,388px)] flex-col"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--dc-border-subtle)] px-5">
            <h2 className="text-[15.5px] font-semibold tracking-[-0.01em] text-[var(--dc-text-strong)]">
              Search results
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search results"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
            >
              <X className="h-4.5 w-4.5" strokeWidth={2} />
            </button>
          </div>
          <SearchResultsList sources={sources} listRef={listRef} />
        </div>
      </aside>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        ref={backdropRef}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
        aria-hidden="true"
      />
      <aside
        ref={mobilePanelRef}
        aria-label="Search results"
        className="relative z-10 flex h-full w-[min(92vw,380px)] flex-col border-l border-[var(--dc-border-subtle)] bg-[var(--dc-canvas)] shadow-2xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--dc-border-subtle)] px-4">
          <h2 className="text-[15.5px] font-semibold tracking-[-0.01em] text-[var(--dc-text-strong)]">
            Search results
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search results"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>
        <SearchResultsList sources={sources} listRef={listRef} />
      </aside>
    </div>
  );
}
