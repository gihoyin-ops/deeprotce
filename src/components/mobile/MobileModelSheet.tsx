'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { X } from '@/components/ui/icons';
import {
  AnimatedCheckSvg,
  SliderWaveSvg,
} from '@/components/ui/ModelSelectorVisuals';
import {
  getModelProvider,
  useSelectedModelState,
  type ModelOption,
} from '@/lib/ai/model-selection';
import { prefersReducedMotion, triggerSubtleHaptic } from './gesture-utils';

interface MobileModelSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Particle {
  x: number;
  y: number;
  r: number;
  phase: number;
  twinkle: number;
  flow: number;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  ttl: number;
  color: string;
}

export default function MobileModelSheet({ isOpen, onClose }: MobileModelSheetProps) {
  const {
    selectedModel,
    tierIndex,
    currentTier,
    isUltra,
    models,
    loading,
    selectModel,
    commitTier,
  } = useSelectedModelState();

  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [dragPos, setDragPos] = useState<number | null>(null);
  const [closingPending, setClosingPending] = useState(false);

  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const modelsListRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const sparklesCanvasRef = useRef<HTMLCanvasElement>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

  const particlesRef = useRef<Particle[]>([]);
  const sparkRafRef = useRef<number>(0);
  const sparkLastRef = useRef<number>(0);

  const confettiPartsRef = useRef<ConfettiParticle[]>([]);
  const confettiRafRef = useRef<number>(0);
  const confettiLastRef = useRef<number>(0);
  const lastBurstRef = useRef<number>(0);

  const activePointerRef = useRef<number | null>(null);
  const isAnimatingOutRef = useRef(false);
  const dragDismissRef = useRef<{
    startY: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    dragging: boolean;
  } | null>(null);

  const animateAndClose = useCallback(
    (fromY = 0) => {
      if (isAnimatingOutRef.current) return;
      isAnimatingOutRef.current = true;
      setClosingPending(true);

      const sheetEl = sheetRef.current;
      const backdropEl = backdropRef.current;

      if (prefersReducedMotion() || !sheetEl || !backdropEl) {
        isAnimatingOutRef.current = false;
        setClosingPending(false);
        onClose();
        return;
      }

      gsap.killTweensOf([sheetEl, backdropEl]);
      gsap.set(sheetEl, { y: fromY });

      const tl = gsap.timeline({
        onComplete: () => {
          isAnimatingOutRef.current = false;
          setClosingPending(false);
          onClose();
        },
      });

      tl.to(
        sheetEl,
        {
          y: '100%',
          duration: 0.24,
          ease: 'power3.in',
        },
        0
      ).to(
        backdropEl,
        {
          opacity: 0,
          duration: 0.22,
          ease: 'power2.in',
        },
        0
      );
    },
    [onClose]
  );

  // Entrance animation + staggered model cards
  useEffect(() => {
    if (!isOpen) {
      isAnimatingOutRef.current = false;
      return;
    }

    const backdropEl = backdropRef.current;
    const sheetEl = sheetRef.current;
    const listEl = modelsListRef.current;
    if (!backdropEl || !sheetEl) return;

    const ctx = gsap.context(() => {
      const reduce = prefersReducedMotion();
      gsap.fromTo(
        backdropEl,
        { opacity: 0 },
        { opacity: 1, duration: reduce ? 0.01 : 0.24, ease: 'power2.out' }
      );
      gsap.fromTo(
        sheetEl,
        { y: reduce ? 0 : '100%' },
        {
          y: 0,
          duration: reduce ? 0.01 : 0.38,
          ease: 'expo.out',
          clearProps: 'transform',
        }
      );

      if (!reduce && listEl) {
        const cards = listEl.querySelectorAll<HTMLElement>('.dc-mob-model-card');
        if (cards.length > 0) {
          gsap.fromTo(
            cards,
            { opacity: 0, y: 8 },
            {
              opacity: 1,
              y: 0,
              duration: 0.28,
              delay: 0.07,
              stagger: 0.03,
              ease: 'expo.out',
              clearProps: 'transform',
            }
          );
        }
      }
    });

    return () => ctx.revert();
  }, [isOpen, loading]);

  // Escape key & closeModelSelector listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        animateAndClose();
      }
    };

    const handleExternalClose = () => {
      animateAndClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('closeModelSelector', handleExternalClose);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('closeModelSelector', handleExternalClose);
    };
  }, [isOpen, animateAndClose]);

  const fireConfetti = useCallback(() => {
    if (prefersReducedMotion()) return;

    const now = performance.now();
    if (now - lastBurstRef.current < 350) return;
    lastBurstRef.current = now;

    const track = trackRef.current;
    const canvas = confettiCanvasRef.current;
    if (!track || !canvas) return;

    const sw = track.offsetWidth;
    const sh = track.offsetHeight;
    if (!sw) return;

    const MX = 32;
    const MY = 40;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = sw + MX * 2;
    const h = sh + MY * 2;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const cx = sw - 17 + MX;
    const cy = sh / 2 + MY;
    const COLORS = ['#60A5FA', '#818CF8', '#C084FC', '#F472B6', '#38BDF8'];
    const R = 17;
    const N = 16;

    const newParticles: ConfettiParticle[] = [];
    for (let i = 0; i < N; i += 1) {
      const ang = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const sp = 105 + Math.random() * 45;
      newParticles.push({
        x: cx + Math.cos(ang) * R,
        y: cy + Math.sin(ang) * R,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 25,
        size: 4 + Math.random() * 1.4,
        life: 0,
        ttl: 0.24 + Math.random() * 0.08,
        color: COLORS[i % COLORS.length],
      });
    }

    confettiPartsRef.current = newParticles;
    confettiLastRef.current = now;

    const tick = (t: number) => {
      const dt = Math.min(0.032, Math.max(0, (t - confettiLastRef.current) / 1000));
      confettiLastRef.current = t;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      confettiPartsRef.current = confettiPartsRef.current.filter((p) => {
        p.life += dt;
        if (p.life >= p.ttl) return false;
        const damp = Math.exp(-6 * dt);
        p.vx *= damp;
        p.vy = p.vy * damp - 20 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = p.life / p.ttl;
        ctx.globalAlpha = Math.pow(1 - k, 1.5);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
      ctx.globalAlpha = 1;

      if (confettiPartsRef.current.length > 0) {
        confettiRafRef.current = requestAnimationFrame(tick);
      } else {
        confettiRafRef.current = 0;
        ctx.clearRect(0, 0, w, h);
      }
    };

    cancelAnimationFrame(confettiRafRef.current);
    confettiRafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleCommitSliderTier = useCallback(
    (index: number) => {
      const clamped = commitTier(index);
      if (clamped === 4) {
        triggerSubtleHaptic(14);
        fireConfetti();
      } else {
        triggerSubtleHaptic(6);
      }
    },
    [commitTier, fireConfetti]
  );

  // Sparkles canvas setup while sheet is open
  const initParticles = useCallback((w: number, h: number) => {
    const count = Math.max(6, Math.round(w / 24));
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: 4 + Math.random() * (h - 8),
      r: 0.8 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      twinkle: 2.5 + Math.random() * 4.5,
      flow: 85 + Math.random() * 50,
    }));
  }, []);

  useEffect(() => {
    if (!isOpen || prefersReducedMotion()) {
      cancelAnimationFrame(sparkRafRef.current);
      return;
    }

    const canvas = sparklesCanvasRef.current;
    const track = trackRef.current;
    if (!canvas || !track) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = track.clientWidth;
    const h = track.clientHeight;
    if (w <= 0 || h <= 0) return;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    initParticles(w, h);

    sparkLastRef.current = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(0.032, Math.max(0, (time - sparkLastRef.current) / 1000));
      sparkLastRef.current = time;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        const sec = time / 1000;

        for (const p of particlesRef.current) {
          p.x -= p.flow * dt;
          if (p.x < -3) p.x += w + 6;
          const s = 0.5 + 0.5 * Math.sin(sec * p.twinkle + p.phase);
          ctx.globalAlpha = 0.08 + 0.76 * s * s;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      sparkRafRef.current = requestAnimationFrame(loop);
    };

    sparkRafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(sparkRafRef.current);
    };
  }, [initParticles, isOpen]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(confettiRafRef.current);
    };
  }, []);

  // Slider pointer handling
  const updatePosFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const w = track.clientWidth;
    const K = 34;
    const frac = (clientX - rect.left) / rect.width;
    const pos = Math.min(1, Math.max(0, (frac * w - K / 2) / (w - K)));
    setDragPos(pos);
    const nearest = Math.round(pos * 4);
    if (nearest !== tierIndex) {
      commitTier(nearest);
      triggerSubtleHaptic(5);
    }
    return pos;
  };

  const handleSliderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== null) return;
    activePointerRef.current = e.pointerId;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore pointer capture issues
    }
    setIsDraggingSlider(true);
    updatePosFromClientX(e.clientX);
  };

  const handleSliderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSlider || e.pointerId !== activePointerRef.current) return;
    updatePosFromClientX(e.clientX);
  };

  const handleSliderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSlider || e.pointerId !== activePointerRef.current) return;
    setIsDraggingSlider(false);
    activePointerRef.current = null;
    const pos = dragPos ?? tierIndex / 4;
    setDragPos(null);
    handleCommitSliderTier(Math.round(pos * 4));
  };

  const handleSliderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      handleCommitSliderTier(tierIndex + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      handleCommitSliderTier(tierIndex - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      handleCommitSliderTier(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      handleCommitSliderTier(4);
    }
  };

  // 1:1 finger-tracked drag-to-dismiss on sheet handle + header
  const handleSheetTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1 || isAnimatingOutRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    const now = performance.now();
    dragDismissRef.current = {
      startY: e.touches[0].clientY,
      lastY: e.touches[0].clientY,
      lastTime: now,
      velocityY: 0,
      dragging: true,
    };
  };

  const handleSheetTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const drag = dragDismissRef.current;
    const sheetEl = sheetRef.current;
    const backdropEl = backdropRef.current;
    if (!drag || !drag.dragging || !sheetEl || !backdropEl || e.touches.length !== 1) return;

    const currentY = e.touches[0].clientY;
    const now = performance.now();
    const dt = Math.max(1, now - drag.lastTime);
    drag.velocityY = (currentY - drag.lastY) / dt;
    drag.lastY = currentY;
    drag.lastTime = now;

    const dy = Math.max(0, currentY - drag.startY);
    const height = Math.max(sheetEl.offsetHeight, 320);
    gsap.set(sheetEl, { y: dy });
    gsap.set(backdropEl, { opacity: Math.max(0, 1 - dy / height) });
  };

  const handleSheetTouchEnd = () => {
    const drag = dragDismissRef.current;
    dragDismissRef.current = null;
    const sheetEl = sheetRef.current;
    const backdropEl = backdropRef.current;
    if (!drag || !drag.dragging || !sheetEl || !backdropEl) return;

    const dy = Math.max(0, drag.lastY - drag.startY);
    if (dy > 90 || drag.velocityY > 0.5) {
      triggerSubtleHaptic(6);
      animateAndClose(dy);
      return;
    }

    const reduce = prefersReducedMotion();
    gsap.to(sheetEl, {
      y: 0,
      duration: reduce ? 0.01 : 0.34,
      ease: 'expo.out',
      clearProps: 'transform',
    });
    gsap.to(backdropEl, {
      opacity: 1,
      duration: reduce ? 0.01 : 0.24,
      ease: 'power2.out',
    });
  };

  const handleChooseModel = (option: ModelOption, event: React.MouseEvent<HTMLButtonElement>) => {
    if (closingPending) return;
    const cardEl = event.currentTarget;
    if (!prefersReducedMotion()) {
      gsap.fromTo(
        cardEl,
        { scale: 0.97 },
        { scale: 1, duration: 0.22, ease: 'back.out(2.2)', clearProps: 'transform' }
      );
    }
    triggerSubtleHaptic(10);
    selectModel(option);
    window.setTimeout(() => {
      animateAndClose();
    }, 125);
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const effectivePos = dragPos ?? tierIndex / 4;
  const knobStyle = {
    left: `calc(17px + ${effectivePos} * (100% - 34px))`,
  };
  const fillStyle = {
    width: `calc(17px + ${effectivePos} * (100% - 34px) + 17px)`,
  };
  const activeProvider = getModelProvider(selectedModel.id, selectedModel.name);

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex flex-col justify-end sm:hidden"
      data-mobile-overlay="true"
    >
      <div
        ref={backdropRef}
        onClick={() => animateAndClose()}
        className="dc-ms-backdrop dc-mob-scrim fixed inset-0"
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Model studio"
        className="dc-ms-sheet relative z-10 max-h-[85svh] w-full select-none px-4 pb-[max(1.15rem,env(safe-area-inset-bottom))] pt-2.5"
      >
        {isUltra && <div className="dc-ms-ultra-top-seam" aria-hidden="true" />}

        {/* Drag Handle + Header */}
        <div
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          onTouchCancel={handleSheetTouchEnd}
          className="touch-none pb-3"
        >
          <div className="dc-ms-sheet-handle mx-auto mb-3 h-1 w-10 rounded-full opacity-75" />

          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[17px] font-semibold tracking-tight text-[var(--dc-text-strong)]">
                  {selectedModel.name}
                </h2>
                <span className="shrink-0 rounded-full border border-[var(--dc-border)] bg-[var(--dc-fill)] px-2 py-0.5 text-[11px] font-semibold text-[var(--dc-text-muted)]">
                  {activeProvider}
                </span>
              </div>
              <p
                className={`mt-0.5 text-[12px] ${
                  isUltra
                    ? 'dc-ms-ultra-text font-semibold'
                    : 'font-medium text-[var(--dc-text-muted)]'
                }`}
              >
                {currentTier.key} · {currentTier.speed}
              </p>
            </div>

            <button
              type="button"
              onClick={() => animateAndClose()}
              aria-label="Close model studio"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--dc-fill)] text-[var(--dc-text-strong)] transition-transform active:scale-90 hover:bg-[var(--dc-fill-hover)]"
            >
              <X className="h-4.5 w-4.5" strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* Section 1: Immediate One-Thumb Intelligence Control */}
        <div className="mb-4 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface-subtle)] p-3.5">
          <div className="mb-2.5 flex min-h-[20px] items-center justify-between gap-2">
            <span className="text-[12.5px] font-semibold text-[var(--dc-text-strong)]">
              Intelligence
            </span>
            {isUltra ? (
              <span className="dc-ms-ultra-text truncate text-[12px] font-semibold">
                Consumes usage limits faster
              </span>
            ) : isDraggingSlider ? (
              <span className="text-[12px] font-medium text-[var(--dc-text-muted)]">
                Faster ↔ Smarter
              </span>
            ) : (
              <span className="text-[12px] font-medium text-[var(--dc-text-muted)]">
                {currentTier.key} · {currentTier.speed}
              </span>
            )}
          </div>

          <div
            tabIndex={0}
            role="slider"
            data-gesture-ignore="true"
            aria-label="Model intelligence"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={tierIndex}
            aria-valuetext={currentTier.valuetext}
            onKeyDown={handleSliderKeyDown}
            onPointerDown={handleSliderPointerDown}
            onPointerMove={handleSliderPointerMove}
            onPointerUp={handleSliderPointerUp}
            onPointerCancel={handleSliderPointerUp}
            className={`relative h-[38px] select-none touch-none outline-none ${
              isDraggingSlider ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <div
              ref={trackRef}
              className="dc-ms-slider-track absolute left-0 right-0 top-1/2 -translate-y-1/2"
            >
              <div className="pointer-events-none absolute inset-0">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    style={{ left: `calc(17px + ${idx / 4} * (100% - 34px))` }}
                    className={`absolute top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-200 ${
                      idx <= tierIndex
                        ? 'bg-white/45'
                        : 'bg-black/20 dark:bg-white/20'
                    }`}
                  />
                ))}
              </div>

              <div
                style={fillStyle}
                className={`dc-ms-slider-fill transition-[width] ${
                  isDraggingSlider ? 'duration-0' : 'duration-300 ease-out'
                }`}
              >
                <div
                  className={`dc-ms-ultra-fill absolute inset-0 transition-opacity duration-300 ${
                    isUltra ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <SliderWaveSvg active={tierIndex >= 2} isUltra={isUltra} />
                <canvas
                  ref={sparklesCanvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />
              </div>
            </div>

            <div
              style={knobStyle}
              className={`dc-ms-slider-knob -translate-x-1/2 -translate-y-1/2 transition-[left,transform,box-shadow] ${
                isUltra ? 'dc-ms-slider-knob-ultra' : ''
              } ${isDraggingSlider ? 'scale-105 duration-0' : 'duration-300 ease-out'}`}
            />

            <canvas
              ref={confettiCanvasRef}
              className="pointer-events-none absolute -left-8 -top-10 z-10"
            />
          </div>
        </div>

        {/* Section 2: Models List */}
        <div>
          <div className="mb-2 flex items-center justify-between px-0.5">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]">
              Models
            </span>
            <span className="text-[11.5px] font-medium text-[var(--dc-text-muted)]">
              {models.length} available
            </span>
          </div>

          <div
            ref={modelsListRef}
            className="custom-scrollbar max-h-[38svh] space-y-2 overflow-y-auto overscroll-contain pr-0.5"
          >
            {loading ? (
              <div className="space-y-2">
                <div className="h-[66px] animate-pulse rounded-2xl bg-[var(--dc-fill)]" />
                <div className="h-[66px] animate-pulse rounded-2xl bg-[var(--dc-fill)]" />
              </div>
            ) : models.length > 0 ? (
              models.map((m) => {
                const isSelected = m.id === selectedModel.id;
                const provider = getModelProvider(m.id, m.name);
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={closingPending}
                    onClick={(event) => handleChooseModel(m, event)}
                    className={`dc-mob-model-card flex min-h-[62px] w-full items-start justify-between gap-3 rounded-2xl border p-3.5 text-left transition-colors active:scale-[0.99] ${
                      isSelected
                        ? isUltra
                          ? 'dc-ms-model-item-ultra'
                          : 'dc-ms-model-item-active'
                        : 'border-[var(--dc-border)] bg-[var(--dc-surface)] hover:bg-[var(--dc-surface-subtle)]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-[14.5px] font-semibold leading-tight ${
                            isSelected
                              ? isUltra
                                ? 'text-[var(--dc-text-strong)]'
                                : 'text-[#0371DD] dark:text-[#38BDF8]'
                              : 'text-[var(--dc-text-strong)]'
                          }`}
                        >
                          {m.name}
                        </span>
                        <span className="rounded-md bg-[var(--dc-fill)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--dc-text-muted)]">
                          {provider}
                        </span>
                      </div>
                      {m.description && (
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[var(--dc-text-muted)]">
                          {m.description}
                        </p>
                      )}
                    </div>

                    {isSelected && <AnimatedCheckSvg isUltra={isUltra} size={20} />}
                  </button>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs font-medium text-[var(--dc-text-muted)]">
                No models found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
