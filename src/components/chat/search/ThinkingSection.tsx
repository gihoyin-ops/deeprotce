'use client';

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ChevronDown, FileText, Search } from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import {
  extractCitedSourceIndices,
  normalizeSourceUrl,
  tokenizeTextWithCitations,
  type SearchSource,
  type SearchStatus,
  type ThinkingStep
} from '@/lib/search/source-display';
import { CitationPill } from './CitationPill';
import { StackedFavicons } from './StackedFavicons';

interface ThinkingSectionProps {
  content: string;
  isStreaming?: boolean;
  duration?: number;
  searchStatus?: SearchStatus;
  searchSources?: SearchSource[];
  readSources?: SearchSource[];
  thinkingSteps?: ThinkingStep[];
  answerContent?: string;
  isSidebarOpen?: boolean;
  onOpenSearchResults?: () => void;
}

function KineticThinkingDotIcon({
  active,
  hovered,
}: {
  active: boolean;
  hovered: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const gradId = `dc-dot-grad-${uid}`;
  const gooId = `dc-dot-goo-${uid}`;

  const svgRef = useRef<SVGSVGElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const dropARef = useRef<SVGCircleElement>(null);
  const dropBRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);

  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    const core = coreRef.current;
    const dropA = dropARef.current;
    const dropB = dropBRef.current;
    const halo = haloRef.current;
    if (!core || !dropA || !dropB || !halo) return;

    const ctx = gsap.context(() => {
      gsap.killTweensOf([core, dropA, dropB, halo]);

      if (reduce) {
        gsap.set(core, { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, transformOrigin: '50% 50%' });
        gsap.set([dropA, dropB], { x: 0, y: 0, scale: 0, opacity: 0, transformOrigin: '50% 50%' });
        gsap.set(halo, { scale: 1, opacity: active ? 0.36 : 0.2, transformOrigin: '50% 50%' });
        return;
      }

      if (active) {
        // Core organic liquid breathing + subtle squash/stretch
        gsap.fromTo(
          core,
          { scaleX: 1.06, scaleY: 0.94, transformOrigin: '50% 50%' },
          {
            scaleX: 0.94,
            scaleY: 1.07,
            duration: 1.15,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          }
        );

        // Droplet A: fluid figure-8 / Lissajous budding out & merging back
        gsap.set(dropA, { opacity: 0.96, scale: 1, transformOrigin: '50% 50%' });
        gsap
          .timeline({ repeat: -1 })
          .to(dropA, { x: 5.2, y: -2.4, scale: 1.05, duration: 0.65, ease: 'sine.inOut' })
          .to(dropA, { x: 1.8, y: 4.8, scale: 0.86, duration: 0.72, ease: 'sine.inOut' })
          .to(dropA, { x: -4.8, y: 1.6, scale: 1.02, duration: 0.68, ease: 'sine.inOut' })
          .to(dropA, { x: 0, y: 0, scale: 0.72, duration: 0.55, ease: 'sine.inOut' });

        // Droplet B: counter-phase harmonic orbit
        gsap.set(dropB, { opacity: 0.88, scale: 0.9, transformOrigin: '50% 50%' });
        gsap
          .timeline({ repeat: -1 })
          .to(dropB, { x: -4.6, y: -3.6, scale: 0.96, duration: 0.8, ease: 'sine.inOut' })
          .to(dropB, { x: 0.8, y: -5.2, scale: 0.78, duration: 0.75, ease: 'sine.inOut' })
          .to(dropB, { x: 4.2, y: 2.6, scale: 0.92, duration: 0.82, ease: 'sine.inOut' })
          .to(dropB, { x: 0, y: 0, scale: 0.65, duration: 0.6, ease: 'sine.inOut' });

        // Outer soft aura pulse
        gsap.fromTo(
          halo,
          { scale: 0.9, opacity: 0.16, transformOrigin: '50% 50%' },
          {
            scale: 1.14,
            opacity: 0.42,
            duration: 1.4,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          }
        );
      } else {
        // Coalesce smoothly into the signature settled DeepChat blue dot
        gsap.to([dropA, dropB], {
          x: 0,
          y: 0,
          scale: 0,
          opacity: 0,
          duration: 0.35,
          ease: 'power3.out',
          transformOrigin: '50% 50%',
        });
        gsap.to(core, {
          x: 0,
          y: 0,
          scale: hovered ? 1.12 : 1,
          scaleX: 1,
          scaleY: 1,
          duration: 0.32,
          ease: 'back.out(1.7)',
          transformOrigin: '50% 50%',
        });
        gsap.to(halo, {
          scale: hovered ? 1.18 : 1,
          opacity: hovered ? 0.45 : 0.2,
          duration: 0.3,
          ease: 'power2.out',
          transformOrigin: '50% 50%',
        });
      }
    }, svgRef);

    return () => ctx.revert();
  }, [active, hovered]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 24 24"
      fill="none"
      className="h-[19px] w-[19px] shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="35%" r="68%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="55%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </radialGradient>
        <filter id={gooId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.25" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>

      <circle
        ref={haloRef}
        cx="12"
        cy="12"
        r="8.4"
        stroke="#3b82f6"
        strokeWidth="1.15"
        opacity="0.2"
      />

      <g filter={active ? `url(#${gooId})` : undefined}>
        <circle ref={dropARef} cx="12" cy="12" r="2.15" fill={`url(#${gradId})`} />
        <circle ref={dropBRef} cx="12" cy="12" r="1.7" fill={`url(#${gradId})`} />
        <circle ref={coreRef} cx="12" cy="12" r="4.5" fill={`url(#${gradId})`} />
      </g>
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
  thinkingSteps,
  answerContent = '',
  isSidebarOpen = false,
  onOpenSearchResults
}: ThinkingSectionProps) {
  const isSearching = searchStatus === 'searching';
  const isActive = Boolean(isStreaming || isSearching);

  const [isExpanded, setIsExpanded] = useState<boolean>(() => isActive);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);

  const userToggledRef = useRef(false);
  const prevActiveRef = useRef(isActive);
  const firstBodyEffectRef = useRef(true);

  const rootRef = useRef<HTMLDivElement>(null);
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

  // Active shimmer glow
  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    const ctx = gsap.context(() => {
      if (!isActive || reduce) return;

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

  const timelineNodes = useMemo(() => {
    type TimelineNode =
      | { kind: 'thought'; text: string }
      | { kind: 'search'; status: 'searching' | 'completed'; count: number }
      | { kind: 'read'; status: 'reading' | 'completed'; count: number; sources: SearchSource[] };

    if (thinkingSteps && thinkingSteps.length > 0) {
      const nodes: TimelineNode[] = [];
      for (const step of thinkingSteps) {
        if (step.type === 'thought') {
          const parts = step.text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
          for (const part of parts) {
            nodes.push({ kind: 'thought', text: part });
          }
        } else if (step.type === 'search') {
          nodes.push({
            kind: 'search',
            status: step.status,
            count: step.count ?? searchSources.length
          });
        } else if (step.type === 'read') {
          if (step.status === 'reading') {
            nodes.push({
              kind: 'read',
              status: 'reading',
              count: step.count ?? 1,
              sources: []
            });
          } else if (step.sources.length > 0) {
            nodes.push({
              kind: 'read',
              status: 'completed',
              count: step.sources.length,
              sources: step.sources.slice(0, 5)
            });
          }
        }
      }
      return nodes;
    }

    const legacy: TimelineNode[] = [];
    if (isSearching || searchSources.length > 0) {
      legacy.push({
        kind: 'search',
        status: isSearching ? 'searching' : 'completed',
        count: searchSources.length
      });
    }
    for (const part of thoughtParagraphs) {
      legacy.push({ kind: 'thought', text: part });
    }
    if (effectiveReadSources.length > 0) {
      legacy.push({
        kind: 'read',
        status: 'completed',
        count: effectiveReadSources.length,
        sources: effectiveReadSources
      });
    }
    return legacy;
  }, [effectiveReadSources, isSearching, searchSources.length, thinkingSteps, thoughtParagraphs]);

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

  return (
    <div ref={rootRef} className="mb-3 w-full max-w-full">
      <button
        type="button"
        onClick={handleToggle}
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        aria-expanded={isExpanded}
        className="group inline-flex cursor-pointer items-center gap-2 rounded-lg py-1 pr-2 text-[14px] font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
      >
        <KineticThinkingDotIcon active={isActive} hovered={isHeaderHovered} />
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
          {timelineNodes.map((node, index) => {
            const hasNext = index < timelineNodes.length - 1;

            if (node.kind === 'search') {
              const searchingNow = node.status === 'searching';
              return (
                <div key={`search-${index}`} data-timeline-node className="flex items-stretch gap-2.5">
                  <div className="flex w-5 shrink-0 flex-col items-center">
                    <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 dark:text-slate-500">
                      <Search className="h-3.5 w-3.5" />
                    </span>
                    {hasNext && (
                      <span className="my-1.5 w-px flex-1 bg-slate-200 dark:bg-slate-700/75" />
                    )}
                  </div>
                  <div className={`min-w-0 flex-1 ${hasNext ? 'pb-3' : 'pb-1'}`}>
                    {searchingNow ? (
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
                          Found {node.count} web page{node.count === 1 ? '' : 's'}
                        </span>
                        <StackedFavicons sources={searchSources} max={4} size="sm" />
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            if (node.kind === 'thought') {
              const tokens = tokenizeTextWithCitations(node.text, searchSources);
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
                    {tokens.map((token, tokenIdx) =>
                      token.type === 'citation' ? (
                        <CitationPill key={`cite-${tokenIdx}`} sources={token.sources} />
                      ) : (
                        <React.Fragment key={`txt-${tokenIdx}`}>{token.text}</React.Fragment>
                      )
                    )}
                  </p>
                </div>
              );
            }

            if (node.status === 'reading') {
              return (
                <div key={`read-${index}`} data-timeline-node className="flex items-stretch gap-2.5">
                  <div className="flex w-5 shrink-0 flex-col items-center">
                    <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 dark:text-slate-500">
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    {hasNext && (
                      <span className="my-1.5 w-px flex-1 bg-slate-200 dark:bg-slate-700/75" />
                    )}
                  </div>
                  <div className={`min-w-0 flex-1 ${hasNext ? 'pb-3' : 'pb-1'}`}>
                    <span className="inline-block animate-pulse text-[13.5px] font-normal leading-[1.6] text-slate-500 dark:text-slate-400">
                      Reading {node.count} page{node.count === 1 ? '' : 's'}...
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div key={`read-${index}`} data-timeline-node className="flex items-stretch gap-2.5">
                <div className="flex w-5 shrink-0 flex-col items-center">
                  <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 dark:text-slate-500">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <span className={`mt-1.5 w-px flex-1 ${hasNext ? 'my-1.5 bg-slate-200 dark:bg-slate-700/75' : 'bg-slate-200/80 dark:bg-slate-700/60'}`} />
                </div>
                <div className={`min-w-0 flex-1 text-[13.5px] leading-[1.65] text-slate-500 dark:text-slate-400 ${hasNext ? 'pb-3' : 'pb-1'}`}>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      {onOpenSearchResults ? (
                        <button
                          type="button"
                          onClick={onOpenSearchResults}
                          className="cursor-pointer whitespace-nowrap text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          Read {node.sources.length} page{node.sources.length === 1 ? '' : 's'}
                        </button>
                      ) : (
                        <span className="whitespace-nowrap">
                          Read {node.sources.length} page{node.sources.length === 1 ? '' : 's'}
                        </span>
                      )}
                      <a
                        href={node.sources[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/link inline max-w-full break-words text-slate-500 underline decoration-slate-300 underline-offset-[3px] transition-colors hover:text-slate-800 hover:decoration-slate-500 dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-slate-200 dark:hover:decoration-slate-400"
                      >
                        <span>{node.sources[0].title}</span>
                        <DiagonalArrowIcon />
                      </a>
                    </div>
                    {node.sources.slice(1).map((source, idx) => (
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
