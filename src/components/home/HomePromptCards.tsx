'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  ArrowUp,
  BarChart3,
  BookOpen,
  Code2,
  Globe,
  ImageIcon,
  Layers,
  Lightbulb,
  Palette,
  PenLine,
  Sparkles,
  Terminal,
  Zap,
} from '@/components/ui/icons';

export interface SelectedHomePrompt {
  prompt: string;
  enableWebSearch?: boolean;
  enableImageGeneration?: boolean;
}

interface HomePromptCardsProps {
  onSelectPrompt: (selection: SelectedHomePrompt) => void;
  compact?: boolean;
}

type CategoryId = 'featured' | 'code' | 'research' | 'create';
type PromptIconKey =
  | 'sparkles'
  | 'globe'
  | 'code'
  | 'image'
  | 'lightbulb'
  | 'terminal'
  | 'layers'
  | 'zap'
  | 'book'
  | 'chart'
  | 'pen'
  | 'palette';

interface PromptCardItem {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  icon: PromptIconKey;
  tag?: string;
  enableWebSearch?: boolean;
  enableImageGeneration?: boolean;
}

interface CategoryTab {
  id: CategoryId;
  label: string;
  icon: PromptIconKey;
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: 'featured', label: 'Featured', icon: 'sparkles' },
  { id: 'code', label: 'Code', icon: 'code' },
  { id: 'research', label: 'Research', icon: 'globe' },
  { id: 'create', label: 'Create', icon: 'palette' },
];

const PROMPTS_BY_CATEGORY: Record<CategoryId, PromptCardItem[]> = {
  featured: [
    {
      id: 'feat-news',
      title: 'Brief me on today\u2019s AI news',
      subtitle: 'Pull fresh headlines with live sources',
      prompt: 'Summarize the biggest AI and tech developments from this week with key takeaways and sources.',
      icon: 'globe',
      tag: 'Web',
      enableWebSearch: true,
    },
    {
      id: 'feat-code',
      title: 'Design a clean TypeScript helper',
      subtitle: 'Typed, minimal, and production-ready',
      prompt: 'Write a clean, type-safe TypeScript utility for debouncing async requests with AbortController cancellation.',
      icon: 'code',
    },
    {
      id: 'feat-image',
      title: 'Generate a minimalist studio scene',
      subtitle: 'Crisp lighting and editorial mood',
      prompt: 'Create a minimalist architectural studio workspace bathed in soft morning sunlight, warm alabaster tones, ultra-clean editorial photography.',
      icon: 'image',
      tag: 'Image',
      enableImageGeneration: true,
    },
    {
      id: 'feat-think',
      title: 'Break down a complex idea clearly',
      subtitle: 'First principles, zero fluff',
      prompt: 'Explain how modern LLM reasoning models work from first principles using a clear visual analogy.',
      icon: 'lightbulb',
    },
  ],
  code: [
    {
      id: 'code-api',
      title: 'Architect a resilient REST endpoint',
      subtitle: 'Validation, rate limits, and clean errors',
      prompt: 'Design a clean Next.js Route Handler pattern with Zod-style input validation, typed responses, and graceful error handling.',
      icon: 'terminal',
    },
    {
      id: 'code-perf',
      title: 'Audit React rendering bottlenecks',
      subtitle: 'Find wasted re-renders and heavy bundles',
      prompt: 'Give me a practical checklist to diagnose and fix slow React 19 re-renders and layout thrashing in a real-time streaming chat UI.',
      icon: 'layers',
    },
    {
      id: 'code-sql',
      title: 'Optimize a slow SQL query plan',
      subtitle: 'Indexes, composite keys, and scans',
      prompt: 'Walk me through how to read an EXPLAIN ANALYZE plan and design composite indexes for multi-tenant pagination queries.',
      icon: 'code',
    },
    {
      id: 'code-ui',
      title: 'Craft micro-interactive UI physics',
      subtitle: 'Smooth 60fps transitions without jank',
      prompt: 'Show best practices for building accessible 60fps GSAP micro-interactions in React with prefers-reduced-motion support.',
      icon: 'zap',
    },
  ],
  research: [
    {
      id: 'res-compare',
      title: 'Compare frameworks with live benchmarks',
      subtitle: 'Evidence-backed tradeoffs and recs',
      prompt: 'Compare the latest real-world tradeoffs between React Server Components, Astro, and SvelteKit for interactive AI web apps.',
      icon: 'globe',
      tag: 'Web',
      enableWebSearch: true,
    },
    {
      id: 'res-releases',
      title: 'Catch up on recent model releases',
      subtitle: 'Capabilities, speed, and pricing shifts',
      prompt: 'Research the latest open-weight and frontier AI model releases this month and summarize where each excels.',
      icon: 'sparkles',
      tag: 'Web',
      enableWebSearch: true,
    },
    {
      id: 'res-deep',
      title: 'Synthesize a technical topic fast',
      subtitle: 'Structured overview with citations',
      prompt: 'Give me an executive technical briefing on WebGPU inference in browsers, citing current browser support and bottlenecks.',
      icon: 'book',
      tag: 'Web',
      enableWebSearch: true,
    },
    {
      id: 'res-market',
      title: 'Spot emerging product UX trends',
      subtitle: 'Patterns top AI products are adopting',
      prompt: 'Analyze the most effective UI and UX interaction patterns emerging across modern AI workspaces right now.',
      icon: 'chart',
      tag: 'Web',
      enableWebSearch: true,
    },
  ],
  create: [
    {
      id: 'cre-launch',
      title: 'Draft crisp product launch copy',
      subtitle: 'Sharp headline, zero corporate buzzwords',
      prompt: 'Write punchy, human-sounding launch notes for a fast AI workspace update focused on clarity and thoughtful design.',
      icon: 'pen',
    },
    {
      id: 'cre-art',
      title: 'Illustrate an editorial brand visual',
      subtitle: 'Sculptural glass and soft daylight',
      prompt: 'Create a refined abstract 3D glass prism floating over matte limestone in soft diffused daylight, subtle indigo refraction, minimalist editorial aesthetic.',
      icon: 'image',
      tag: 'Image',
      enableImageGeneration: true,
    },
    {
      id: 'cre-mood',
      title: 'Design a calm workspace moodboard',
      subtitle: 'Palette, typography, and tactile surfaces',
      prompt: 'Generate a warm minimalist desk setup photography piece with matte ceramic textures, brushed aluminum, and soft natural afternoon light.',
      icon: 'palette',
      tag: 'Image',
      enableImageGeneration: true,
    },
    {
      id: 'cre-memo',
      title: 'Turn rough notes into a sharp memo',
      subtitle: 'Clear structure, decisions, next steps',
      prompt: 'Help me turn messy brainstorming notes into a concise 1-page decision memo with clear options, risks, and a recommendation.',
      icon: 'sparkles',
    },
  ],
};

function renderPromptIcon(icon: PromptIconKey, className = 'h-4 w-4') {
  switch (icon) {
    case 'sparkles':
      return <Sparkles className={className} strokeWidth={1.9} />;
    case 'globe':
      return <Globe className={className} strokeWidth={1.9} />;
    case 'code':
      return <Code2 className={className} strokeWidth={1.9} />;
    case 'image':
      return <ImageIcon className={className} strokeWidth={1.9} />;
    case 'lightbulb':
      return <Lightbulb className={className} strokeWidth={1.9} />;
    case 'terminal':
      return <Terminal className={className} strokeWidth={1.9} />;
    case 'layers':
      return <Layers className={className} strokeWidth={1.9} />;
    case 'zap':
      return <Zap className={className} strokeWidth={1.9} />;
    case 'book':
      return <BookOpen className={className} strokeWidth={1.9} />;
    case 'chart':
      return <BarChart3 className={className} strokeWidth={1.9} />;
    case 'pen':
      return <PenLine className={className} strokeWidth={1.9} />;
    case 'palette':
      return <Palette className={className} strokeWidth={1.9} />;
  }
}

interface InteractivePromptCardProps {
  item: PromptCardItem;
  compact: boolean;
  onSelect: (selection: SelectedHomePrompt) => void;
}

function InteractivePromptCard({ item, compact, onSelect }: InteractivePromptCardProps) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const cardEl = cardRef.current;
    const iconEl = iconRef.current;
    const arrowEl = arrowRef.current;
    if (!cardEl) return;

    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!isFinePointer) return;

    if (arrowEl) {
      gsap.set(arrowEl, { opacity: 0, x: -4, y: 4 });
    }

    const spot = { x: 0, y: 0 };
    const xTo = gsap.quickTo(spot, 'x', {
      duration: 0.25,
      ease: 'power3.out',
      onUpdate: () => cardEl.style.setProperty('--card-x', `${spot.x.toFixed(1)}px`),
    });
    const yTo = gsap.quickTo(spot, 'y', {
      duration: 0.25,
      ease: 'power3.out',
      onUpdate: () => cardEl.style.setProperty('--card-y', `${spot.y.toFixed(1)}px`),
    });

    const handleEnter = (event: MouseEvent) => {
      const rect = cardEl.getBoundingClientRect();
      const relX = event.clientX - rect.left;
      const relY = event.clientY - rect.top;
      spot.x = relX;
      spot.y = relY;
      cardEl.style.setProperty('--card-x', `${relX.toFixed(1)}px`);
      cardEl.style.setProperty('--card-y', `${relY.toFixed(1)}px`);
      cardEl.style.setProperty('--card-spot-opacity', '1');

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.to(cardEl, {
        y: -2.5,
        duration: 0.26,
        ease: 'power3.out',
      });
      if (iconEl) {
        gsap.to(iconEl, {
          scale: 1.09,
          rotate: -6,
          duration: 0.36,
          ease: 'back.out(2.2)',
        });
      }
      if (arrowEl) {
        gsap.to(arrowEl, {
          opacity: 1,
          x: 0,
          y: 0,
          duration: 0.24,
          ease: 'power2.out',
        });
      }
    };

    const handleMove = (event: MouseEvent) => {
      const rect = cardEl.getBoundingClientRect();
      xTo(event.clientX - rect.left);
      yTo(event.clientY - rect.top);
    };

    const handleLeave = () => {
      cardEl.style.setProperty('--card-spot-opacity', '0');

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.to(cardEl, {
        y: 0,
        duration: 0.26,
        ease: 'power3.out',
      });
      if (iconEl) {
        gsap.to(iconEl, {
          scale: 1,
          rotate: 0,
          duration: 0.26,
          ease: 'power3.out',
        });
      }
      if (arrowEl) {
        gsap.to(arrowEl, {
          opacity: 0,
          x: -4,
          y: 4,
          duration: 0.2,
          ease: 'power2.in',
        });
      }
    };

    cardEl.addEventListener('mouseenter', handleEnter);
    cardEl.addEventListener('mousemove', handleMove);
    cardEl.addEventListener('mouseleave', handleLeave);

    return () => {
      cardEl.removeEventListener('mouseenter', handleEnter);
      cardEl.removeEventListener('mousemove', handleMove);
      cardEl.removeEventListener('mouseleave', handleLeave);
      gsap.killTweensOf(spot);
      gsap.killTweensOf(cardEl);
      if (iconEl) gsap.killTweensOf(iconEl);
      if (arrowEl) gsap.killTweensOf(arrowEl);
    };
  }, []);

  const handleClick = () => {
    const cardEl = cardRef.current;
    if (cardEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(
        cardEl,
        { scale: 0.98 },
        {
          scale: 1,
          duration: 0.26,
          ease: 'back.out(2.2)',
          clearProps: 'scale',
        }
      );
    }

    onSelect({
      prompt: item.prompt,
      enableWebSearch: item.enableWebSearch,
      enableImageGeneration: item.enableImageGeneration,
    });
  };

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={handleClick}
      className={`dc-home-card dc-home-card-item group flex w-full items-start gap-3 ${
        compact ? 'px-3.5 py-3' : 'px-4 py-3.5'
      }`}
    >
      <div ref={iconRef} className="dc-home-card-icon mt-0.5">
        {renderPromptIcon(item.icon, 'h-4 w-4')}
      </div>

      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13.5px] font-semibold leading-snug text-[var(--dc-text-strong)]">
            {item.title}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {item.tag && <span className="dc-home-card-tag">{item.tag}</span>}
            <span
              ref={arrowRef}
              className="hidden h-5 w-5 items-center justify-center text-[var(--dc-text-muted)] opacity-0 sm:inline-flex"
              aria-hidden="true"
            >
              <ArrowUp className="h-3.5 w-3.5 rotate-45" strokeWidth={2.2} />
            </span>
          </div>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[12px] font-normal leading-relaxed text-[var(--dc-text-muted)]">
          {item.subtitle}
        </p>
      </div>
    </button>
  );
}

export default function HomePromptCards({ onSelectPrompt, compact = false }: HomePromptCardsProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('featured');

  const trackRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<CategoryId, HTMLButtonElement | null>>({
    featured: null,
    code: null,
    research: null,
    create: null,
  });
  const hasMeasuredIndicatorRef = useRef(false);
  const isInitialCardsMountRef = useRef(true);
  const switchDirectionRef = useRef(1);

  const positionIndicator = useCallback(
    (animate: boolean) => {
      const activeTab = tabRefs.current[activeCategory];
      const indicatorEl = indicatorRef.current;
      if (!activeTab || !indicatorEl) return;

      const targetLeft = activeTab.offsetLeft;
      const targetWidth = activeTab.offsetWidth;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!animate || reduceMotion || !hasMeasuredIndicatorRef.current) {
        gsap.set(indicatorEl, { x: targetLeft, width: targetWidth, opacity: 1 });
        hasMeasuredIndicatorRef.current = true;
        return;
      }

      gsap.to(indicatorEl, {
        x: targetLeft,
        width: targetWidth,
        opacity: 1,
        duration: 0.38,
        ease: 'expo.out',
      });
    },
    [activeCategory]
  );

  useEffect(() => {
    if (compact) return;
    positionIndicator(hasMeasuredIndicatorRef.current);

    const trackEl = trackRef.current;
    if (!trackEl || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      positionIndicator(false);
    });
    observer.observe(trackEl);

    return () => {
      observer.disconnect();
    };
  }, [compact, positionIndicator]);

  useEffect(() => {
    const gridEl = gridRef.current;
    if (!gridEl) return;

    const cards = gridEl.querySelectorAll<HTMLElement>('.dc-home-card-item');
    if (cards.length === 0) return;

    const isFirst = isInitialCardsMountRef.current;
    isInitialCardsMountRef.current = false;
    const dir = switchDirectionRef.current;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(cards, { opacity: 1, x: 0, y: 0, scale: 1 });
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (isFirst) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 16, scale: 0.97 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.5,
            stagger: 0.055,
            delay: compact ? 0.14 : 0.28,
            ease: 'expo.out',
            clearProps: 'transform',
          }
        );
      } else {
        gsap.fromTo(
          cards,
          { opacity: 0, x: dir * 14, y: 8, scale: 0.98 },
          {
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: 0.36,
            stagger: 0.042,
            ease: 'power3.out',
            clearProps: 'transform',
          }
        );
      }
    });

    return () => {
      mm.revert();
    };
  }, [activeCategory, compact]);

  const handleCategoryChange = (nextCategory: CategoryId) => {
    if (nextCategory === activeCategory) return;
    const currentIndex = CATEGORY_TABS.findIndex((tab) => tab.id === activeCategory);
    const nextIndex = CATEGORY_TABS.findIndex((tab) => tab.id === nextCategory);
    switchDirectionRef.current = nextIndex >= currentIndex ? 1 : -1;
    setActiveCategory(nextCategory);
  };

  const visibleCards = PROMPTS_BY_CATEGORY[activeCategory];

  return (
    <div className="w-full">
      {!compact && (
        <div className="mb-3.5 flex justify-center sm:mb-4">
          <div
            ref={trackRef}
            role="tablist"
            aria-label="Prompt categories"
            className="dc-home-pill-track max-w-full overflow-x-auto no-scrollbar"
          >
            <div ref={indicatorRef} className="dc-home-pill-indicator opacity-0" aria-hidden="true" />
            {CATEGORY_TABS.map((tab) => {
              const isActive = tab.id === activeCategory;
              return (
                <button
                  key={tab.id}
                  ref={(node) => {
                    tabRefs.current[tab.id] = node;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleCategoryChange(tab.id)}
                  className={`relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors duration-200 ${
                    isActive
                      ? 'text-[var(--dc-text-strong)]'
                      : 'text-[var(--dc-text-muted)] hover:text-[var(--dc-text)]'
                  }`}
                >
                  {renderPromptIcon(tab.icon, 'h-3.5 w-3.5')}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        ref={gridRef}
        className={`grid grid-cols-1 sm:grid-cols-2 ${compact ? 'gap-2.5' : 'gap-2.5 sm:gap-3'}`}
      >
        {visibleCards.map((item) => (
          <InteractivePromptCard
            key={item.id}
            item={item}
            compact={compact}
            onSelect={onSelectPrompt}
          />
        ))}
      </div>
    </div>
  );
}
