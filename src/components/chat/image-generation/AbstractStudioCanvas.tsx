'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import KineticDot from '@/components/ui/KineticDot';
import { IMAGE_GENERATION_STATUS_TEXTS } from '@/lib/images/image-generation';

export interface AbstractStudioCanvasProps {
  isExiting?: boolean;
}

interface DotPalette {
  baseRgb: string;
  accentRgb: string;
  isDark: boolean;
}

function readDotPalette(): DotPalette {
  const isDark =
    typeof document !== 'undefined' &&
    (document.documentElement.classList.contains('dark') ||
      document.documentElement.dataset.appearance === 'dark');

  return isDark
    ? {
        baseRgb: '148, 163, 184', // slate-400 bs
        accentRgb: '96, 165, 250', // blue-400 bs
        isDark: true,
      }
    : {
        baseRgb: '100, 116, 139', // slate-500 bs
        accentRgb: '37, 99, 235', // blue-600 bs
        isDark: false,
      };
}

export default function AbstractStudioCanvas({
  isExiting = false,
}: AbstractStudioCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ambientGlowRef = useRef<HTMLDivElement>(null);
  const coreDotRef = useRef<HTMLSpanElement>(null);
  const pulseRingRef = useRef<HTMLDivElement>(null);
  const orbitGroupRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const filamentRef = useRef<HTMLSpanElement>(null);

  const [statusIndex, setStatusIndex] = useState(0);
  const isFirstStatusMountRef = useRef(true);

  const simRef = useRef({
    width: 320,
    height: 240,
    dpr: 1,
    time: 0,
    exitProgress: 0,
    pointerX: 0.5,
    pointerY: 0.5,
    pointerStrength: 0,
    palette: readDotPalette(),
  });

  // GSAP dot-matrix canvas and blue dot animation bs
  useEffect(() => {
    const rootEl = rootRef.current;
    const canvasEl = canvasRef.current;
    if (!rootEl || !canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const sim = simRef.current;
    sim.palette = readDotPalette();
    sim.exitProgress = 0;

    const drawStaticOrAnimated = (deltaSec: number, animate: boolean) => {
      if (animate) {
        sim.time += Math.min(deltaSec, 0.05);
      }

      const { width, height, dpr, time, exitProgress, pointerX, pointerY, pointerStrength, palette } = sim;
      if (width <= 0 || height <= 0) return;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Grid spacing that scales from tiny phone screens up to desktop without looking like ass
      const spacing = Math.max(15, Math.min(22, Math.round(Math.min(width, height) / 13)));
      const cols = Math.max(6, Math.floor((width - spacing) / spacing));
      const rows = Math.max(6, Math.floor((height - spacing) / spacing));
      const offsetX = (width - (cols - 1) * spacing) * 0.5;
      const offsetY = (height - (rows - 1) * spacing) * 0.5;

      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const maxDist = Math.hypot(centerX, centerY) || 1;
      const px = pointerX * width;
      const py = pointerY * height;
      const pointerRadius = Math.min(width, height) * 0.34;

      const exitFade = 1 - exitProgress;

      for (let r = 0; r < rows; r += 1) {
        const baseY = offsetY + r * spacing;
        for (let c = 0; c < cols; c += 1) {
          const baseX = offsetX + c * spacing;
          const dxCenter = baseX - centerX;
          const dyCenter = baseY - centerY;
          const distCenter = Math.hypot(dxCenter, dyCenter);
          const normDist = distCenter / maxDist;

          // Radial wave + cross-drift interference so the dots actually move
          const radialWave = animate
            ? Math.sin(distCenter * 0.038 - time * 1.9) * 0.5 + 0.5
            : 0.45;
          const driftWave = animate
            ? Math.sin(c * 0.45 + time * 0.9) * Math.cos(r * 0.45 - time * 0.75) * 0.5 + 0.5
            : 0.5;

          // Fade out the edges so the border doesn't look harsh as shit
          const vignette = Math.max(0.18, 1 - normDist * 0.78);

          // Brighten dots near the pointer and nudge them slightly away
          let drawX = baseX;
          let drawY = baseY;
          let pointerBoost = 0;

          if (animate && pointerStrength > 0.01) {
            const pdx = baseX - px;
            const pdy = baseY - py;
            const pDist = Math.hypot(pdx, pdy);
            if (pDist < pointerRadius && pDist > 0.001) {
              const falloff = Math.pow(1 - pDist / pointerRadius, 2) * pointerStrength;
              pointerBoost = falloff;
              drawX += (pdx / pDist) * falloff * 3.2;
              drawY += (pdy / pDist) * falloff * 3.2;
            }
          }

          const energy = radialWave * 0.62 + driftWave * 0.38;
          const radius = 0.85 + energy * 0.75 + pointerBoost * 1.15;

          const baseAlpha = (palette.isDark ? 0.08 : 0.09) + energy * (palette.isDark ? 0.14 : 0.12);
          const alpha = (baseAlpha * vignette + pointerBoost * 0.34) * exitFade;

          // Tint toward brand blue near wave crests or the pointer
          const blueMix = Math.min(1, Math.max(0, (energy - 0.55) * 1.1 + pointerBoost * 0.95));

          if (blueMix > 0.15) {
            ctx.fillStyle = `rgba(${palette.accentRgb}, ${(alpha * (0.45 + blueMix * 0.55)).toFixed(3)})`;
          } else {
            ctx.fillStyle = `rgba(${palette.baseRgb}, ${alpha.toFixed(3)})`;
          }

          ctx.beginPath();
          ctx.arc(drawX, drawY, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    };

    const syncDimensions = () => {
      const rect = rootEl.getBoundingClientRect();
      const width = Math.max(120, Math.round(rect.width));
      const height = Math.max(120, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

      canvasEl.width = Math.round(width * dpr);
      canvasEl.height = Math.round(height * dpr);
      sim.width = width;
      sim.height = height;
      sim.dpr = dpr;
    };

    syncDimensions();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncDimensions) : null;
    resizeObserver?.observe(rootEl);

    const themeObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            sim.palette = readDotPalette();
            drawStaticOrAnimated(0, false);
          })
        : null;
    themeObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-appearance', 'data-contrast'],
    });

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: reduce)', () => {
      drawStaticOrAnimated(0, false);
      if (coreDotRef.current) {
        gsap.set(coreDotRef.current, { scale: 1, opacity: 1 });
      }
      if (filamentRef.current) {
        gsap.set(filamentRef.current, { opacity: 0.4, xPercent: 30 });
      }
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tickerFn = (_time: number, deltaTimeMs: number) => {
        drawStaticOrAnimated(deltaTimeMs / 1000, true);
      };
      gsap.ticker.add(tickerFn);

      // Breathing blue background glow
      if (ambientGlowRef.current) {
        gsap.to(ambientGlowRef.current, {
          scale: 1.18,
          opacity: 0.88,
          duration: 3.4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          force3D: true,
        });
      }

      // Main blue dot breathing + squash/stretch bs
      if (coreDotRef.current) {
        const dotTl = gsap.timeline({ repeat: -1, defaults: { force3D: true } });
        dotTl
          .to(coreDotRef.current, {
            scaleX: 1.24,
            scaleY: 1.14,
            opacity: 0.96,
            duration: 1.35,
            ease: 'sine.inOut',
          })
          .to(coreDotRef.current, {
            scaleX: 0.94,
            scaleY: 1.02,
            opacity: 0.78,
            duration: 1.35,
            ease: 'sine.inOut',
          })
          .to(coreDotRef.current, {
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            duration: 0.9,
            ease: 'sine.out',
          });
      }

      // Expanding sonar ring shooting out from the blue dot
      if (pulseRingRef.current) {
        gsap.fromTo(
          pulseRingRef.current,
          { scale: 0.65, opacity: 0.52 },
          {
            scale: 2.35,
            opacity: 0,
            duration: 2.6,
            repeat: -1,
            ease: 'power2.out',
            force3D: true,
          }
        );
      }

      // Spin the tiny satellite dots around the center
      if (orbitGroupRef.current) {
        gsap.to(orbitGroupRef.current, {
          rotation: 360,
          duration: 14,
          repeat: -1,
          ease: 'none',
          force3D: true,
        });
      }

      // Bottom progress line sweep
      if (filamentRef.current) {
        gsap.fromTo(
          filamentRef.current,
          { xPercent: -110 },
          {
            xPercent: 220,
            duration: 2.6,
            repeat: -1,
            ease: 'sine.inOut',
          }
        );
      }

      // Pointer tracking on desktop mouse devices only (fuck doing this on touch)
      const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      let removePointerListeners: (() => void) | undefined;

      if (canHover) {
        const quickPX = gsap.quickTo(sim, 'pointerX', { duration: 0.45, ease: 'power3.out' });
        const quickPY = gsap.quickTo(sim, 'pointerY', { duration: 0.45, ease: 'power3.out' });
        const quickStrength = gsap.quickTo(sim, 'pointerStrength', { duration: 0.45, ease: 'power2.out' });

        const onPointerMove = (e: PointerEvent) => {
          const rect = rootEl.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          quickPX((e.clientX - rect.left) / rect.width);
          quickPY((e.clientY - rect.top) / rect.height);
          quickStrength(1);
        };

        const onPointerLeave = () => {
          quickStrength(0);
        };

        rootEl.addEventListener('pointermove', onPointerMove);
        rootEl.addEventListener('pointerleave', onPointerLeave);
        removePointerListeners = () => {
          rootEl.removeEventListener('pointermove', onPointerMove);
          rootEl.removeEventListener('pointerleave', onPointerLeave);
        };
      }

      return () => {
        gsap.ticker.remove(tickerFn);
        removePointerListeners?.();
      };
    });

    return () => {
      mm.revert();
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
    };
  }, []);

  // Fade out the dot matrix when swapping in the finished image
  useEffect(() => {
    if (!isExiting) return;
    gsap.to(simRef.current, {
      exitProgress: 1,
      duration: 0.34,
      ease: 'power2.in',
    });
  }, [isExiting]);

  // Cycle through the status text strings every 3s
  useEffect(() => {
    if (isExiting) return;

    let cancelled = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const intervalId = window.setInterval(() => {
      if (cancelled) return;
      const el = statusRef.current;
      if (!el || reduce) {
        setStatusIndex((prev) => (prev + 1) % IMAGE_GENERATION_STATUS_TEXTS.length);
        return;
      }

      gsap.to(el, {
        opacity: 0,
        y: -4,
        duration: 0.22,
        ease: 'power2.in',
        onComplete: () => {
          if (!cancelled) {
            setStatusIndex((prev) => (prev + 1) % IMAGE_GENERATION_STATUS_TEXTS.length);
          }
        },
      });
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isExiting]);

  useEffect(() => {
    const el = statusRef.current;
    if (!el) return;

    if (isFirstStatusMountRef.current) {
      isFirstStatusMountRef.current = false;
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }

    gsap.fromTo(
      el,
      { opacity: 0, y: 4 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out', clearProps: 'transform' }
    );
  }, [statusIndex]);

  return (
    <div
      ref={rootRef}
      className="relative flex h-full w-full select-none items-center justify-center overflow-hidden"
    >
      {/* HiDPI dot-matrix canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Ambient blue blur */}
      <div
        ref={ambientGlowRef}
        aria-hidden="true"
        className="pointer-events-none absolute h-40 w-40 rounded-full opacity-65 blur-2xl"
        style={{
          background:
            'radial-gradient(circle, rgb(59 130 246 / 0.16) 0%, rgb(37 99 235 / 0.05) 55%, transparent 75%)',
        }}
      />

      {/* Centerpiece: blue dot + status label */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-3.5 px-4 text-center">
        <div className="relative flex h-11 w-11 items-center justify-center">
          {/* Expanding sonar ring */}
          <div
            ref={pulseRingRef}
            aria-hidden="true"
            className="pointer-events-none absolute h-5 w-5 rounded-full border"
            style={{ borderColor: 'rgb(59 130 246 / 0.45)' }}
          />

          {/* Orbiting micro-dots */}
          <div
            ref={orbitGroupRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <span
              className="absolute left-1/2 top-0.5 h-1 w-1 -translate-x-1/2 rounded-full opacity-60"
              style={{ backgroundColor: 'var(--dc-studio-accent-soft)' }}
            />
            <span
              className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full opacity-35"
              style={{ backgroundColor: 'var(--dc-studio-accent-glow)' }}
            />
          </div>

          {/* Kinetic blue dot */}
          <KineticDot ref={coreDotRef} mode="manual" size="lg" />
        </div>

        <span
          ref={statusRef}
          role="status"
          aria-live="polite"
          className="dc-img-status-text text-[12.5px] font-medium tracking-[-0.01em]"
        >
          {IMAGE_GENERATION_STATUS_TEXTS[statusIndex]}
        </span>
      </div>

      {/* Skinny bottom progress bar */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px] overflow-hidden"
        style={{ backgroundColor: 'var(--dc-studio-border)' }}
        aria-hidden="true"
      >
        <span
          ref={filamentRef}
          className="block h-full w-[40%] rounded-full"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, var(--dc-studio-accent) 50%, var(--dc-studio-accent-glow) 82%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
}
