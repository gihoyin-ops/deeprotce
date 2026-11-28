'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
} from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import {
  exportDeckToPdf,
  exportDeckToPptx,
  SLIDE_THEME_PALETTES,
} from '@/lib/canvas/exporters';
import { parseStreamingDeck } from '@/lib/canvas/stream-parser';
import {
  parseDeckData,
  type CanvasDeckData,
  type CanvasFile,
  type CanvasMode,
  type CanvasSlide,
  type CanvasSlideLayout,
  type CanvasSlideTheme,
} from '@/lib/canvas/types';

function SlideRenderer({
  slide,
  theme,
  slideNumber,
  totalSlides,
  compact = false,
}: {
  slide: CanvasSlide;
  theme: CanvasSlideTheme;
  slideNumber: number;
  totalSlides: number;
  compact?: boolean;
}) {
  const palette = SLIDE_THEME_PALETTES[theme] || SLIDE_THEME_PALETTES.minimal;
  const bg = `#${palette.bg}`;
  const surface = `#${palette.surface}`;
  const text = `#${palette.text}`;
  const muted = `#${palette.muted}`;
  const accent = `#${palette.accent}`;
  const border = `#${palette.border}`;

  return (
    <div
      style={{ backgroundColor: bg, color: text }}
      className="relative flex aspect-[16/9] w-full flex-col justify-between overflow-hidden rounded-2xl border shadow-sm select-none"
    >
      <div style={{ backgroundColor: accent }} className="h-1.5 w-full shrink-0" />

      <div
        className={`flex min-h-0 flex-1 flex-col justify-center ${
          compact ? 'px-4 py-3' : 'px-6 py-5 sm:px-12 sm:py-8'
        }`}
      >
        {(slide.layout === 'title' || slide.layout === 'section') && (
          <div className="mx-auto max-w-2xl text-center">
            <h2
              className={`font-bold tracking-tight ${
                compact ? 'text-[13px] leading-tight' : 'text-xl sm:text-3xl leading-tight'
              }`}
            >
              {slide.title}
            </h2>
            {slide.subtitle && (
              <p
                style={{ color: muted }}
                className={compact ? 'mt-1 text-[9px]' : 'mt-3 text-sm sm:text-base'}
              >
                {slide.subtitle}
              </p>
            )}
          </div>
        )}

        {slide.layout === 'quote' && (
          <div className="mx-auto max-w-2xl text-center">
            <p
              className={`italic ${
                compact ? 'text-[11px] leading-snug' : 'text-lg sm:text-2xl leading-relaxed'
              }`}
            >
              &ldquo;{slide.quote || slide.title}&rdquo;
            </p>
            {slide.author && (
              <p
                style={{ color: accent }}
                className={compact ? 'mt-1.5 text-[9px] font-semibold' : 'mt-4 text-sm font-semibold'}
              >
                {slide.author}
              </p>
            )}
          </div>
        )}

        {slide.layout === 'content' && (
          <div className="flex h-full flex-col justify-center">
            <h3
              className={`font-bold tracking-tight ${
                compact ? 'text-[11px]' : 'text-lg sm:text-2xl'
              }`}
            >
              {slide.title}
            </h3>
            {slide.subtitle && (
              <p style={{ color: muted }} className={compact ? 'mt-0.5 text-[8px]' : 'mt-1 text-xs sm:text-sm'}>
                {slide.subtitle}
              </p>
            )}
            <ul className={compact ? 'mt-2 space-y-1' : 'mt-5 space-y-2.5 sm:space-y-3'}>
              {(slide.bullets || []).map((b, idx) => (
                <li
                  key={idx}
                  className={`flex items-start gap-2.5 ${
                    compact ? 'text-[8.5px] leading-tight' : 'text-xs sm:text-[15px] leading-relaxed'
                  }`}
                >
                  <span
                    style={{ backgroundColor: accent }}
                    className={`shrink-0 rounded-full ${compact ? 'mt-1 h-1 w-1' : 'mt-2 h-1.5 w-1.5'}`}
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {slide.layout === 'two-column' && (
          <div className="flex h-full flex-col justify-center">
            <h3 className={`font-bold tracking-tight ${compact ? 'text-[11px]' : 'text-lg sm:text-2xl'}`}>
              {slide.title}
            </h3>
            <div className={`grid grid-cols-2 ${compact ? 'mt-2 gap-2' : 'mt-5 gap-4'}`}>
              {[
                { title: slide.leftTitle, bullets: slide.leftBullets || [] },
                { title: slide.rightTitle, bullets: slide.rightBullets || [] },
              ].map((col, cIdx) => (
                <div
                  key={cIdx}
                  style={{ backgroundColor: surface, borderColor: border }}
                  className={`rounded-xl border ${compact ? 'p-2' : 'p-4'}`}
                >
                  {col.title && (
                    <p
                      style={{ color: accent }}
                      className={`font-semibold ${compact ? 'mb-1 text-[8.5px]' : 'mb-2.5 text-xs sm:text-sm'}`}
                    >
                      {col.title}
                    </p>
                  )}
                  <ul className={compact ? 'space-y-0.5' : 'space-y-1.5'}>
                    {col.bullets.map((b, bIdx) => (
                      <li
                        key={bIdx}
                        className={compact ? 'text-[7.5px] leading-tight' : 'text-xs sm:text-sm leading-snug'}
                      >
                        • {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {slide.layout === 'metrics' && (
          <div className="flex h-full flex-col justify-center">
            <h3 className={`font-bold tracking-tight ${compact ? 'text-[11px]' : 'text-lg sm:text-2xl'}`}>
              {slide.title}
            </h3>
            {slide.subtitle && (
              <p style={{ color: muted }} className={compact ? 'mt-0.5 text-[8px]' : 'mt-1 text-xs sm:text-sm'}>
                {slide.subtitle}
              </p>
            )}
            <div className={`grid grid-cols-2 sm:grid-cols-3 ${compact ? 'mt-2 gap-1.5' : 'mt-5 gap-3 sm:gap-4'}`}>
              {(slide.metrics || []).slice(0, 4).map((m, idx) => (
                <div
                  key={idx}
                  style={{ backgroundColor: surface, borderColor: border }}
                  className={`rounded-xl border ${compact ? 'p-1.5' : 'p-3.5 sm:p-4'}`}
                >
                  <div
                    style={{ color: accent }}
                    className={`font-bold tabular-nums ${compact ? 'text-[11px]' : 'text-lg sm:text-2xl'}`}
                  >
                    {m.value}
                  </div>
                  <div className={`font-semibold ${compact ? 'text-[7.5px]' : 'mt-1 text-xs sm:text-sm'}`}>
                    {m.label}
                  </div>
                  {m.note && !compact && (
                    <div style={{ color: muted }} className="mt-0.5 text-[11px]">
                      {m.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        style={{ color: muted }}
        className={`flex items-center justify-end ${compact ? 'px-3 pb-1.5 text-[8px]' : 'px-6 pb-3 text-[11px]'}`}
      >
        {slideNumber} / {totalSlides}
      </div>
    </div>
  );
}

export function SlidesCanvasEditor({
  file,
  mode,
  isStreaming,
  onChange,
}: {
  file: CanvasFile;
  mode: Exclude<CanvasMode, 'diff'>;
  isStreaming: boolean;
  onChange: (nextContent: string) => void;
}) {
  const deck: CanvasDeckData = useMemo(() => {
    if (isStreaming) {
      return parseStreamingDeck(file.content) || parseDeckData(file.content);
    }
    return parseDeckData(file.content);
  }, [file.content, isStreaming]);

  const [slideIdx, setSlideIdx] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dirRef = useRef(0);

  const safeIdx = Math.min(slideIdx, Math.max(0, deck.slides.length - 1));
  const activeSlide = deck.slides[safeIdx] || deck.slides[0];
  const baseName = file.path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'presentation';

  const goSlide = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(deck.slides.length - 1, nextIdx));
    if (clamped === safeIdx) return;
    dirRef.current = clamped > safeIdx ? 1 : -1;
    setSlideIdx(clamped);
  };

  useEffect(() => {
    const el = stageRef.current;
    if (!el || prefersReducedMotion()) return;
    const dir = dirRef.current || 1;
    dirRef.current = 0;
    gsap.fromTo(
      el,
      { opacity: 0.45, x: dir * 18 },
      { opacity: 1, x: 0, duration: 0.28, ease: 'expo.out', clearProps: 'transform,opacity' }
    );
  }, [safeIdx]);

  useEffect(() => {
    if (mode !== 'preview' && !presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') {
        const nextIdx = Math.min(deck.slides.length - 1, safeIdx + 1);
        if (nextIdx !== safeIdx) {
          dirRef.current = 1;
          setSlideIdx(nextIdx);
        }
      } else if (e.key === 'ArrowLeft') {
        const prevIdx = Math.max(0, safeIdx - 1);
        if (prevIdx !== safeIdx) {
          dirRef.current = -1;
          setSlideIdx(prevIdx);
        }
      } else if (e.key === 'Escape' && presenting) {
        setPresenting(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deck.slides.length, mode, presenting, safeIdx]);

  const commitDeck = (next: CanvasDeckData) => {
    onChange(JSON.stringify(next, null, 2));
  };

  const updateActiveSlide = (patch: Partial<CanvasSlide>) => {
    commitDeck({
      ...deck,
      slides: deck.slides.map((s, idx) => (idx === safeIdx ? { ...s, ...patch } : s)),
    });
  };

  const addSlide = () => {
    const nextSlides: CanvasSlide[] = [
      ...deck.slides,
      {
        id: `slide-${Date.now()}`,
        layout: 'content',
        title: `Slide ${deck.slides.length + 1}`,
        bullets: ['Key point one', 'Key point two'],
      },
    ];
    commitDeck({ ...deck, slides: nextSlides });
    setSlideIdx(nextSlides.length - 1);
  };

  const deleteActiveSlide = () => {
    if (deck.slides.length <= 1) return;
    const nextSlides = deck.slides.filter((_, idx) => idx !== safeIdx);
    commitDeck({ ...deck, slides: nextSlides });
    setSlideIdx(Math.max(0, safeIdx - 1));
  };

  const fullscreenOverlay =
    presenting && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[99999] flex flex-col bg-black p-4 sm:p-8">
            <div className="mb-3 flex items-center justify-between text-white/80">
              <span className="text-sm font-medium">{deck.title}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goSlide(safeIdx - 1)}
                  disabled={safeIdx === 0}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs tabular-nums">
                  {safeIdx + 1} / {deck.slides.length}
                </span>
                <button
                  type="button"
                  onClick={() => goSlide(safeIdx + 1)}
                  disabled={safeIdx === deck.slides.length - 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPresenting(false)}
                  className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="w-full max-w-5xl">
                <SlideRenderer
                  slide={activeSlide}
                  theme={deck.theme}
                  slideNumber={safeIdx + 1}
                  totalSlides={deck.slides.length}
                />
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  if (mode === 'preview') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--dc-panel-muted)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] px-3.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goSlide(safeIdx - 1)}
              disabled={safeIdx === 0}
              aria-label="Previous slide"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)] disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-12 text-center text-[12px] font-medium text-[var(--dc-text-muted)] tabular-nums">
              {safeIdx + 1} / {deck.slides.length}
            </span>
            <button
              type="button"
              onClick={() => goSlide(safeIdx + 1)}
              disabled={safeIdx === deck.slides.length - 1}
              aria-label="Next slide"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)] disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {activeSlide.notes && (
              <button
                type="button"
                onClick={() => setNotesOpen((o) => !o)}
                className="inline-flex h-7 items-center rounded-lg px-2 text-[12px] font-medium text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
              >
                Notes
              </button>
            )}
            <button
              type="button"
              onClick={() => setPresenting(true)}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Present</span>
            </button>
            <button
              type="button"
              onClick={() => void exportDeckToPptx(deck, `${baseName}.pptx`)}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2.5 text-[12px] font-medium text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)]"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>.pptx</span>
            </button>
            <button
              type="button"
              onClick={() => void exportDeckToPdf(deck, `${baseName}.pdf`)}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2.5 text-[12px] font-medium text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)]"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>.pdf</span>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Thumbnail strip */}
          <div className="custom-scrollbar flex shrink-0 gap-2 overflow-x-auto border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] p-2.5 lg:w-40 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r">
            {deck.slides.map((s, idx) => (
              <button
                key={`${s.id}-${idx}`}
                type="button"
                onClick={() => goSlide(idx)}
                className={`w-28 shrink-0 rounded-xl p-0.5 transition-all lg:w-full ${
                  idx === safeIdx
                    ? 'ring-2 ring-[var(--deepchat-accent)]'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                <SlideRenderer
                  slide={s}
                  theme={deck.theme}
                  slideNumber={idx + 1}
                  totalSlides={deck.slides.length}
                  compact
                />
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto p-3 sm:p-6">
            <div ref={stageRef} className="mx-auto my-auto w-full max-w-3xl">
              <SlideRenderer
                slide={activeSlide}
                theme={deck.theme}
                slideNumber={safeIdx + 1}
                totalSlides={deck.slides.length}
              />
            </div>

            {notesOpen && activeSlide.notes && (
              <div className="mx-auto mt-3 w-full max-w-3xl rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--dc-text-body)]">
                {activeSlide.notes}
              </div>
            )}
          </div>
        </div>

        {fullscreenOverlay}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--dc-canvas)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={deck.theme}
            onChange={(e) => commitDeck({ ...deck, theme: e.target.value as CanvasSlideTheme })}
            aria-label="Deck theme"
            className="h-7 rounded-md border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2 text-[12px] font-medium text-[var(--dc-text-strong)] outline-none"
          >
            <option value="minimal">Minimal</option>
            <option value="midnight">Midnight</option>
            <option value="editorial">Editorial</option>
            <option value="emerald">Emerald</option>
          </select>

          <select
            value={activeSlide.layout}
            onChange={(e) => updateActiveSlide({ layout: e.target.value as CanvasSlideLayout })}
            aria-label="Slide layout"
            className="h-7 rounded-md border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2 text-[12px] font-medium text-[var(--dc-text-strong)] outline-none"
          >
            <option value="title">Title</option>
            <option value="content">Bullets</option>
            <option value="two-column">Two Columns</option>
            <option value="metrics">Metrics</option>
            <option value="quote">Quote</option>
            <option value="section">Section</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={addSlide}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2.5 text-[12px] font-medium text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Slide</span>
          </button>
          {deck.slides.length > 1 && (
            <button
              type="button"
              onClick={deleteActiveSlide}
              aria-label="Delete slide"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--dc-text-muted)] hover:bg-rose-500/12 hover:text-rose-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Slide selector pills */}
          <div className="dc-canvas-tablist gap-1.5 pb-1">
            {deck.slides.map((s, idx) => (
              <button
                key={`${s.id}-${idx}`}
                type="button"
                onClick={() => setSlideIdx(idx)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  idx === safeIdx
                    ? 'bg-[var(--dc-invert)] text-[var(--dc-text-on-invert)]'
                    : 'bg-[var(--dc-panel-muted)] text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]'
                }`}
              >
                {idx + 1}. {s.title.slice(0, 18) || 'Slide'}
              </button>
            ))}
          </div>

          <div className="space-y-3 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] p-4">
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                Slide title
              </span>
              <input
                type="text"
                value={activeSlide.title}
                onChange={(e) => updateActiveSlide({ title: e.target.value })}
                className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-2 text-[13.5px] font-medium text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                Subtitle
              </span>
              <input
                type="text"
                value={activeSlide.subtitle || ''}
                onChange={(e) => updateActiveSlide({ subtitle: e.target.value })}
                className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-2 text-[13px] text-[var(--dc-text)] outline-none focus:border-[var(--deepchat-accent)]"
              />
            </label>

            {(activeSlide.layout === 'content' || activeSlide.layout === 'two-column') && (
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                  {activeSlide.layout === 'two-column' ? 'Left column bullets (one per line)' : 'Bullet points (one per line)'}
                </span>
                <textarea
                  rows={4}
                  value={(activeSlide.layout === 'two-column' ? activeSlide.leftBullets : activeSlide.bullets)?.join('\n') || ''}
                  onChange={(e) => {
                    const list = e.target.value.split('\n');
                    updateActiveSlide(
                      activeSlide.layout === 'two-column'
                        ? { leftBullets: list }
                        : { bullets: list }
                    );
                  }}
                  className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-2 text-[13px] leading-relaxed text-[var(--dc-text)] outline-none focus:border-[var(--deepchat-accent)]"
                />
              </label>
            )}

            {activeSlide.layout === 'two-column' && (
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                  Right column bullets (one per line)
                </span>
                <textarea
                  rows={4}
                  value={(activeSlide.rightBullets || []).join('\n')}
                  onChange={(e) => updateActiveSlide({ rightBullets: e.target.value.split('\n') })}
                  className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-2 text-[13px] leading-relaxed text-[var(--dc-text)] outline-none focus:border-[var(--deepchat-accent)]"
                />
              </label>
            )}

            {activeSlide.layout === 'quote' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                    Quote text
                  </span>
                  <textarea
                    rows={3}
                    value={activeSlide.quote || ''}
                    onChange={(e) => updateActiveSlide({ quote: e.target.value })}
                    className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-2 text-[13px] text-[var(--dc-text)] outline-none focus:border-[var(--deepchat-accent)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                    Author
                  </span>
                  <input
                    type="text"
                    value={activeSlide.author || ''}
                    onChange={(e) => updateActiveSlide({ author: e.target.value })}
                    className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-2 text-[13px] text-[var(--dc-text)] outline-none focus:border-[var(--deepchat-accent)]"
                  />
                </label>
              </div>
            )}

            {activeSlide.layout === 'metrics' && (
              <div className="space-y-2">
                <span className="block text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                  Metric cards
                </span>
                {(activeSlide.metrics || []).map((m, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={m.value}
                      placeholder="Value"
                      onChange={(e) => {
                        const next = [...(activeSlide.metrics || [])];
                        next[idx] = { ...next[idx], value: e.target.value };
                        updateActiveSlide({ metrics: next });
                      }}
                      className="rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-2.5 py-1.5 text-[12.5px] font-semibold outline-none"
                    />
                    <input
                      type="text"
                      value={m.label}
                      placeholder="Label"
                      onChange={(e) => {
                        const next = [...(activeSlide.metrics || [])];
                        next[idx] = { ...next[idx], label: e.target.value };
                        updateActiveSlide({ metrics: next });
                      }}
                      className="rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-2.5 py-1.5 text-[12.5px] outline-none"
                    />
                    <input
                      type="text"
                      value={m.note || ''}
                      placeholder="Delta"
                      onChange={(e) => {
                        const next = [...(activeSlide.metrics || [])];
                        next[idx] = { ...next[idx], note: e.target.value };
                        updateActiveSlide({ metrics: next });
                      }}
                      className="rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-2.5 py-1.5 text-[12.5px] outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                Speaker notes
              </span>
              <textarea
                rows={2}
                value={activeSlide.notes || ''}
                onChange={(e) => updateActiveSlide({ notes: e.target.value })}
                className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-canvas)] px-3 py-2 text-[12.5px] text-[var(--dc-text)] outline-none focus:border-[var(--deepchat-accent)]"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
