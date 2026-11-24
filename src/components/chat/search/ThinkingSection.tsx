'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ChevronDown, FileText, Search } from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import {
  extractCitedSourceIndices,
  normalizeSourceUrl,
  type SearchSource,
  type SearchStatus
} from '@/lib/search/source-display';
import { StackedFavicons } from './StackedFavicons';

interface ThinkingSectionProps {
  content: string;
  isStreaming?: boolean;
  duration?: number;
  searchStatus?: SearchStatus;
  searchSources?: SearchSource[];
  readSources?: SearchSource[];
  answerContent?: string;
  isSidebarOpen?: boolean;
  onOpenSearchResults?: () => void;
}

function OrbitalThinkingIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-[18px] w-[18px] shrink-0 transition-colors ${
        active
          ? 'text-indigo-500 dark:text-indigo-400'
          : 'text-indigo-500/85 dark:text-indigo-400/85'
      }`}
      aria-hidden="true"
    >
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(35 12 12)" stroke="currentColor" strokeWidth="1.65" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(-35 12 12)" stroke="currentColor" strokeWidth="1.65" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(90 12 12)" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
    </svg>
  );
}

function DiagonalArrowIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      className="ml-0.5 inline-block h-[11px] w-[11px] -translate-y-[1px] shrink-0 opacity-70 transition-transform group-hover/link:translate-x-[1px] group-hover/link:-translate-y-[2px]"
      aria-hidden="true"
    >
      <path
        d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThinkingSection({
  content,
  isStreaming = false,
  duration,
  searchStatus,
  searchSources = [],
  readSources = [],
  answerContent = '',
  isSidebarOpen = false,
  onOpenSearchResults
}: ThinkingSectionProps) {
  const isSearching = searchStatus === 'searching';
  const isActive = Boolean(isStreaming || isSearching);

  const [isExpanded, setIsExpanded] = useState<boolean>(() => isActive);
  const [liveSeconds, setLiveSeconds] = useState(0);

  const userToggledRef = useRef(false);
  const prevActiveRef = useRef(isActive);
  const firstBodyEffectRef = useRef(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const atomRef = useRef<HTMLSpanElement>(null);
  const shimmerHeaderRef = useRef<HTMLSpanElement>(null);
  const shimmerStepRef = useRef<HTMLSpanElement>(null);
  const chevronRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const foundBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isActive) return;
    const interval = window.setInterval(() => {
      setLiveSeconds(prev => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = isActive;
    if (userToggledRef.current) return;

    if (wasActive && !isActive) {
      const timer = window.setTimeout(() => {
        setIsExpanded(false);
      }, 180);
      return () => window.clearTimeout(timer);
    }

    if (!wasActive && isActive) {
      const timer = window.setTimeout(() => {
        setIsExpanded(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [isActive]);

  // Active shimmer & atom rotation
  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    const ctx = gsap.context(() => {
      if (!isActive || reduce) return;

      if (atomRef.current) {
        gsap.to(atomRef.current, {
          rotation: 360,
          duration: 8,
          ease: 'none',
          repeat: -1,
          transformOrigin: '50% 50%'
        });
      }
      if (shimmerHeaderRef.current) {
        gsap.fromTo(
          shimmerHeaderRef.current,
          { backgroundPosition: '130% 50%' },
          { backgroundPosition: '-130% 50%', duration: 1.75, ease: 'none', repeat: -1 }
        );
      }
      if (isSearching && shimmerStepRef.current) {
        gsap.fromTo(
          shimmerStepRef.current,
          { backgroundPosition: '130% 50%' },
          { backgroundPosition: '-130% 50%', duration: 1.75, ease: 'none', repeat: -1 }
        );
      }
    }, rootRef);

    return () => ctx.revert();
  }, [isActive, isSearching]);

  // Chevron rotation + timeline expand/collapse
  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    const chevronEl = chevronRef.current;
    const bodyEl = bodyRef.current;

    if (chevronEl) {
      if (firstBodyEffectRef.current) {
        gsap.set(chevronEl, { rotate: isExpanded ? 0 : -90 });
      } else {
        gsap.killTweensOf(chevronEl);
        gsap.to(chevronEl, {
          rotate: isExpanded ? 0 : -90,
          duration: reduce ? 0.01 : 0.26,
          ease: 'power3.out'
        });
      }
    }

    if (bodyEl) {
      if (firstBodyEffectRef.current) {
        firstBodyEffectRef.current = false;
        if (isExpanded) {
          gsap.set(bodyEl, { display: 'block', height: 'auto', opacity: 1, overflow: 'visible' });
        } else {
          gsap.set(bodyEl, { display: 'none', height: 0, opacity: 0, overflow: 'hidden' });
        }
        return;
      }

      gsap.killTweensOf(bodyEl);
      if (isExpanded) {
        gsap.set(bodyEl, { display: 'block', overflow: 'hidden', height: 'auto' });
        const targetHeight = bodyEl.scrollHeight;
        gsap.fromTo(
          bodyEl,
          { height: 0, opacity: 0, y: reduce ? 0 : -4 },
          {
            height: targetHeight,
            opacity: 1,
            y: 0,
            duration: reduce ? 0.01 : 0.32,
            ease: 'power3.out',
            onComplete: () => {
              gsap.set(bodyEl, { height: 'auto', overflow: 'visible', clearProps: 'transform' });
            }
          }
        );

        if (!reduce) {
          const nodes = bodyEl.querySelectorAll<HTMLElement>('[data-timeline-node]');
          if (nodes.length > 0) {
            gsap.fromTo(
              nodes,
              { opacity: 0, y: 4 },
              {
                opacity: 1,
                y: 0,
                duration: 0.24,
                stagger: 0.03,
                ease: 'power2.out',
                clearProps: 'transform,opacity'
              }
            );
          }
        }
      } else {
        gsap.set(bodyEl, { overflow: 'hidden', height: bodyEl.offsetHeight });
        gsap.to(bodyEl, {
          height: 0,
          opacity: 0,
          y: reduce ? 0 : -4,
          duration: reduce ? 0.01 : 0.24,
          ease: 'power2.inOut',
          onComplete: () => {
            gsap.set(bodyEl, { display: 'none', clearProps: 'transform' });
          }
        });
      }
    }
  }, [isExpanded]);

  const thoughtParagraphs = useMemo(
    () =>
      content
        .split(/\n{2,}/)
        .map(part => part.trim())
        .filter(Boolean),
    [content]
  );

  const effectiveReadSources = useMemo(() => {
    const merged: SearchSource[] = [];
    const seen = new Set<string>();
    const pushSource = (source: SearchSource) => {
      const key = normalizeSourceUrl(source.url);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(source);
    };

    for (const src of readSources) pushSource(src);
    if (answerContent && searchSources.length > 0) {
      for (const index of extractCitedSourceIndices(answerContent, searchSources)) {
        pushSource(searchSources[index]);
      }
    }
    if (merged.length === 0 && !isSearching && searchSources.length > 0) {
      for (const src of searchSources.slice(0, 5)) pushSource(src);
    }

    return merged.slice(0, 5);
  }, [answerContent, isSearching, readSources, searchSources]);

  const showSearchNode = isSearching || searchSources.length > 0;
  const showReadNode = effectiveReadSources.length > 0;
  const hasThoughts = thoughtParagraphs.length > 0;

  const displayDuration = duration !== undefined ? duration : liveSeconds;
  const completedTitle =
    displayDuration < 5 ? 'Thought for a few seconds' : `Thought for ${displayDuration} seconds`;

  const handleToggle = () => {
    userToggledRef.current = true;
    setIsExpanded(prev => !prev);
  };

  const handleFoundHover = (entering: boolean) => {
    if (prefersReducedMotion() || !foundBtnRef.current) return;
    const chips = foundBtnRef.current.querySelectorAll<HTMLElement>('[data-favicon-chip]');
    if (chips.length === 0) return;
    gsap.to(chips, {
      scale: entering ? 1.08 : 1,
      x: entering ? (index) => index * 1.5 : 0,
      duration: 0.22,
      stagger: entering ? 0.02 : 0,
      ease: 'power2.out'
    });
  };

  const searchNodeHasNext = hasThoughts || showReadNode;

  return (
    <div ref={rootRef} className="mb-3 w-full max-w-full">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        className="group inline-flex cursor-pointer items-center gap-2 rounded-lg py-1 pr-2 text-[14px] font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
      >
        <span ref={atomRef} className="inline-flex items-center justify-center">
          <OrbitalThinkingIcon active={isActive} />
        </span>
        {isActive ? (
          <span
            ref={shimmerHeaderRef}
            style={{ backgroundSize: '240% 100%' }}
            className="bg-gradient-to-r from-slate-500 via-slate-900 to-slate-500 bg-clip-text text-transparent dark:from-slate-400 dark:via-slate-100 dark:to-slate-400 motion-reduce:bg-none motion-reduce:text-slate-700 dark:motion-reduce:text-slate-200"
          >
            Thinking
          </span>
        ) : (
          <span>{completedTitle}</span>
        )}
        <span ref={chevronRef} className="inline-flex items-center text-slate-400 transition-colors group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>

      <div ref={bodyRef} className="mt-1.5 pl-0.5">
        <div className="flex flex-col">
          {showSearchNode && (
            <div data-timeline-node className="flex items-stretch gap-2.5">
              <div className="flex w-5 shrink-0 flex-col items-center">
                <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 dark:text-slate-500">
                  <Search className="h-3.5 w-3.5" />
                </span>
                {searchNodeHasNext && (
                  <span className="my-1.5 w-px flex-1 bg-slate-200 dark:bg-slate-700/75" />
                )}
              </div>
              <div className={`min-w-0 flex-1 ${searchNodeHasNext ? 'pb-3' : 'pb-1'}`}>
                {isSearching ? (
                  <span
                    ref={shimmerStepRef}
                    style={{ backgroundSize: '240% 100%' }}
                    className="inline-block bg-gradient-to-r from-slate-400 via-slate-800 to-slate-400 bg-clip-text text-[13.5px] font-normal leading-[1.6] text-transparent dark:from-slate-500 dark:via-slate-100 dark:to-slate-500 motion-reduce:bg-none motion-reduce:text-slate-500"
                  >
                    Searching the web
                  </span>
                ) : (
                  <button
                    ref={foundBtnRef}
                    type="button"
                    onClick={onOpenSearchResults}
                    onMouseEnter={() => handleFoundHover(true)}
                    onMouseLeave={() => handleFoundHover(false)}
                    disabled={!onOpenSearchResults || searchSources.length === 0}
                    aria-expanded={isSidebarOpen}
                    className="inline-flex cursor-pointer flex-wrap items-center gap-2 text-left text-[13.5px] font-normal leading-[1.6] text-slate-500 transition-colors hover:text-slate-800 disabled:cursor-default dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <span>
                      Found {searchSources.length} web page{searchSources.length === 1 ? '' : 's'}
                    </span>
                    <StackedFavicons sources={searchSources} max={4} size="sm" />
                  </button>
                )}
              </div>
            </div>
          )}

          {thoughtParagraphs.map((paragraph, index) => {
            const hasNext = index < thoughtParagraphs.length - 1 || showReadNode;
            return (
              <div key={`thought-${index}`} data-timeline-node className="flex items-stretch gap-2.5">
                <div className="flex w-5 shrink-0 flex-col items-center">
                  <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />
                  {hasNext && (
                    <span className="my-1.5 w-px flex-1 bg-slate-200 dark:bg-slate-700/75" />
                  )}
                </div>
                <p
                  className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-[13.5px] font-normal leading-[1.65] text-slate-500 dark:text-slate-400 ${
                    hasNext ? 'pb-3' : 'pb-1'
                  }`}
                >
                  {paragraph}
                </p>
              </div>
            );
          })}

          {showReadNode && (
            <div data-timeline-node className="flex items-stretch gap-2.5">
              <div className="flex w-5 shrink-0 flex-col items-center">
                <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 dark:text-slate-500">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <span className="mt-1.5 w-px flex-1 bg-slate-200/80 dark:bg-slate-700/60" />
              </div>
              <div className="min-w-0 flex-1 pb-1 text-[13.5px] leading-[1.65] text-slate-500 dark:text-slate-400">
                <div className="flex flex-col items-start gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {onOpenSearchResults ? (
                      <button
                        type="button"
                        onClick={onOpenSearchResults}
                        className="cursor-pointer whitespace-nowrap text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        Read {effectiveReadSources.length} page{effectiveReadSources.length === 1 ? '' : 's'}
                      </button>
                    ) : (
                      <span className="whitespace-nowrap">
                        Read {effectiveReadSources.length} page{effectiveReadSources.length === 1 ? '' : 's'}
                      </span>
                    )}
                    <a
                      href={effectiveReadSources[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/link inline max-w-full break-words text-slate-500 underline decoration-slate-300 underline-offset-[3px] transition-colors hover:text-slate-800 hover:decoration-slate-500 dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-slate-200 dark:hover:decoration-slate-400"
                    >
                      <span>{effectiveReadSources[0].title}</span>
                      <DiagonalArrowIcon />
                    </a>
                  </div>
                  {effectiveReadSources.slice(1).map((source, idx) => (
                    <a
                      key={`${source.url}-${idx}`}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/link inline max-w-full break-words text-slate-500 underline decoration-slate-300 underline-offset-[3px] transition-colors hover:text-slate-800 hover:decoration-slate-500 dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-slate-200 dark:hover:decoration-slate-400"
                    >
                      <span>{source.title}</span>
                      <DiagonalArrowIcon />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
