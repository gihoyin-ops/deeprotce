'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { prefersReducedMotion, triggerSubtleHaptic } from '@/components/mobile/gesture-utils';

export interface ZenSnakeCanvasProps {
  isExiting?: boolean;
}

type Point = { x: number; y: number };
type Direction = { dx: number; dy: number };
type EmberTone = 'clay' | 'ochre' | 'sage';

interface AmbientEmber {
  x: number;
  y: number;
  phase: number;
  tone: EmberTone;
  bornAt: number;
}

interface WaterRipple {
  x: number;
  y: number;
  bornAt: number;
  tone: EmberTone;
}

interface StudioPalette {
  ink: string;
  inkMuted: string;
  dot: string;
  clay: string;
  ochre: string;
  sage: string;
  headSpec: string;
}

const DIR_UP: Direction = { dx: 0, dy: -1 };
const DIR_DOWN: Direction = { dx: 0, dy: 1 };
const DIR_LEFT: Direction = { dx: -1, dy: 0 };
const DIR_RIGHT: Direction = { dx: 1, dy: 0 };

const INITIAL_LENGTH = 7;
const MAX_LENGTH = 22;
const EMBER_COUNT = 3;
const EMBER_TONES: EmberTone[] = ['clay', 'ochre', 'sage'];

function readStudioPalette(el: HTMLElement | null): StudioPalette {
  const isDark =
    typeof document !== 'undefined' &&
    (document.documentElement.classList.contains('dark') ||
      document.documentElement.dataset.appearance === 'dark');

  if (typeof window === 'undefined' || !el) {
    return isDark
      ? {
          ink: '#e5ddd2',
          inkMuted: '#a99f93',
          dot: 'rgba(243, 237, 228, 0.11)',
          clay: '#e28666',
          ochre: '#c89d72',
          sage: '#7c9082',
          headSpec: '#fff5ec',
        }
      : {
          ink: '#3a332b',
          inkMuted: '#655c52',
          dot: 'rgba(101, 92, 82, 0.13)',
          clay: '#d97757',
          ochre: '#d4a36a',
          sage: '#6e8774',
          headSpec: '#fffdf9',
        };
  }

  const styles = window.getComputedStyle(el);
  const readVar = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    ink: isDark ? '#e6ded3' : '#3a332b',
    inkMuted: readVar('--dc-studio-ink-muted', isDark ? '#b0a699' : '#655c52'),
    dot: isDark ? 'rgba(243, 237, 228, 0.11)' : 'rgba(101, 92, 82, 0.13)',
    clay: readVar('--dc-studio-clay', isDark ? '#e28666' : '#d97757'),
    ochre: readVar('--dc-studio-ochre', isDark ? '#c89d72' : '#d4a36a'),
    sage: readVar('--dc-studio-sage', isDark ? '#7c9082' : '#7b9280'),
    headSpec: isDark ? '#fff5ec' : '#fffdf9',
  };
}

function wrapCoord(value: number, max: number): number {
  if (max <= 0) return 0;
  return ((value % max) + max) % max;
}

function spawnEmber(
  cols: number,
  rows: number,
  occupied: Point[],
  toneIndex: number,
  now: number
): AmbientEmber {
  let candidate: Point = {
    x: Math.floor(Math.random() * cols),
    y: Math.floor(Math.random() * rows),
  };

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const x = Math.floor(Math.random() * cols);
    const y = Math.floor(Math.random() * rows);
    const taken = occupied.some((pt) => pt.x === x && pt.y === y);
    if (!taken) {
      candidate = { x, y };
      break;
    }
  }

  return {
    x: candidate.x,
    y: candidate.y,
    phase: Math.random() * Math.PI * 2,
    tone: EMBER_TONES[toneIndex % EMBER_TONES.length],
    bornAt: now,
  };
}

export default function ZenSnakeCanvas({ isExiting = false }: ZenSnakeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const swipeRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const stateRef = useRef<{
    cols: number;
    rows: number;
    width: number;
    height: number;
    dpr: number;
    snake: Point[];
    prevSnake: Point[];
    dir: Direction;
    dirQueue: Direction[];
    targetLength: number;
    embers: AmbientEmber[];
    ripples: WaterRipple[];
    stepProgress: number;
    palette: StudioPalette;
  }>({
    cols: 16,
    rows: 12,
    width: 320,
    height: 240,
    dpr: 1,
    snake: [],
    prevSnake: [],
    dir: DIR_RIGHT,
    dirQueue: [],
    targetLength: INITIAL_LENGTH,
    embers: [],
    ripples: [],
    stepProgress: 0,
    palette: readStudioPalette(null),
  });

  const enqueueDirection = useCallback((next: Direction) => {
    if (isExiting) return;
    const sim = stateRef.current;
    const reference = sim.dirQueue[sim.dirQueue.length - 1] || sim.dir;
    if (reference.dx === next.dx && reference.dy === next.dy) return;
    if (reference.dx + next.dx === 0 && reference.dy + next.dy === 0) return;
    if (sim.dirQueue.length >= 2) return;
    sim.dirQueue.push(next);
    setHasInteracted(true);
  }, [isExiting]);

  // Fade out the steering hint once the user actually touches a key or swipes
  useEffect(() => {
    const hintEl = hintRef.current;
    if (!hintEl || !hasInteracted) return;
    const reduce = prefersReducedMotion();
    gsap.to(hintEl, {
      opacity: 0,
      y: reduce ? 0 : 4,
      duration: reduce ? 0.05 : 0.35,
      ease: 'power2.out',
      onComplete: () => {
        if (hintEl) hintEl.style.pointerEvents = 'none';
      },
    });
  }, [hasInteracted]);

  // Arrow + WASD steering, backing off if an input or menu has focus
  useEffect(() => {
    if (isExiting) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const active = document.activeElement;
      if (
        active &&
        active.closest(
          'input, textarea, select, [contenteditable="true"], [role="menu"], [role="dialog"]'
        )
      ) {
        return;
      }

      let mapped: Direction | null = null;
      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          mapped = DIR_UP;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          mapped = DIR_DOWN;
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          mapped = DIR_LEFT;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          mapped = DIR_RIGHT;
          break;
        default:
          break;
      }

      if (!mapped) return;
      if (event.key.startsWith('Arrow')) {
        event.preventDefault();
      }
      enqueueDirection(mapped);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enqueueDirection, isExiting]);

  // HiDPI canvas resize, theme observer, and GSAP ticker game loop
  useEffect(() => {
    const containerEl = containerRef.current;
    const canvasEl = canvasRef.current;
    if (!containerEl || !canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const sim = stateRef.current;
    sim.palette = readStudioPalette(containerEl);

    const initBoard = (cols: number, rows: number) => {
      const cx = Math.floor(cols / 2);
      const cy = Math.floor(rows / 2);
      const startBody: Point[] = [];
      for (let i = 0; i < INITIAL_LENGTH; i += 1) {
        startBody.push({ x: wrapCoord(cx - i, cols), y: cy });
      }
      sim.snake = startBody;
      sim.prevSnake = startBody.map((pt) => ({ ...pt }));
      sim.dir = DIR_RIGHT;
      sim.dirQueue = [];
      sim.targetLength = INITIAL_LENGTH;

      const now = performance.now();
      const embers: AmbientEmber[] = [];
      for (let i = 0; i < EMBER_COUNT; i += 1) {
        const occupied = [...startBody, ...embers];
        embers.push(spawnEmber(cols, rows, occupied, i, now));
      }
      sim.embers = embers;
    };

    const syncDimensions = () => {
      const rect = containerEl.getBoundingClientRect();
      const width = Math.max(120, Math.round(rect.width));
      const height = Math.max(120, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

      const cellTarget = Math.max(16, Math.min(24, Math.round(Math.min(width, height) / 13)));
      const cols = Math.max(8, Math.floor(width / cellTarget));
      const rows = Math.max(8, Math.floor(height / cellTarget));

      canvasEl.width = Math.round(width * dpr);
      canvasEl.height = Math.round(height * dpr);

      sim.width = width;
      sim.height = height;
      sim.dpr = dpr;

      if (sim.snake.length === 0) {
        sim.cols = cols;
        sim.rows = rows;
        initBoard(cols, rows);
        return;
      }

      if (sim.cols !== cols || sim.rows !== rows) {
        sim.cols = cols;
        sim.rows = rows;
        sim.snake = sim.snake.map((pt) => ({
          x: wrapCoord(pt.x, cols),
          y: wrapCoord(pt.y, rows),
        }));
        sim.prevSnake = sim.snake.map((pt) => ({ ...pt }));
        sim.embers = sim.embers.map((ember) => ({
          ...ember,
          x: wrapCoord(ember.x, cols),
          y: wrapCoord(ember.y, rows),
        }));
      }
    };

    syncDimensions();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncDimensions) : null;
    resizeObserver?.observe(containerEl);

    const themeObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            sim.palette = readStudioPalette(containerEl);
          })
        : null;
    themeObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-appearance', 'data-contrast'],
    });

    const toneColor = (tone: EmberTone, palette: StudioPalette) => {
      if (tone === 'ochre') return palette.ochre;
      if (tone === 'sage') return palette.sage;
      return palette.clay;
    };

    const advanceStep = (now: number) => {
      if (sim.dirQueue.length > 0) {
        const queued = sim.dirQueue.shift();
        if (queued) sim.dir = queued;
      }

      sim.prevSnake = sim.snake.map((pt) => ({ ...pt }));

      const currentHead = sim.snake[0];
      const nextHead: Point = {
        x: wrapCoord(currentHead.x + sim.dir.dx, sim.cols),
        y: wrapCoord(currentHead.y + sim.dir.dy, sim.rows),
      };

      const nextBody = [nextHead, ...sim.snake];
      while (nextBody.length > sim.targetLength) {
        nextBody.pop();
      }
      sim.snake = nextBody;

      // Keep prevSnake the same length so tail interpolation doesn't shit itself
      while (sim.prevSnake.length < sim.snake.length) {
        const last = sim.prevSnake[sim.prevSnake.length - 1] || nextHead;
        sim.prevSnake.push({ ...last });
      }
      while (sim.prevSnake.length > sim.snake.length) {
        sim.prevSnake.pop();
      }

      const cellW = sim.width / sim.cols;
      const cellH = sim.height / sim.rows;

      // Eat ambient embers (no score, no game over, just chill shit)
      for (let i = 0; i < sim.embers.length; i += 1) {
        const ember = sim.embers[i];
        if (ember.x === nextHead.x && ember.y === nextHead.y) {
          sim.ripples.push({
            x: (ember.x + 0.5) * cellW,
            y: (ember.y + 0.5) * cellH,
            bornAt: now,
            tone: ember.tone,
          });
          triggerSubtleHaptic(4);
          if (sim.targetLength < MAX_LENGTH) {
            sim.targetLength += 1;
          }
          const occupied = [
            ...sim.snake,
            ...sim.embers.filter((_, idx) => idx !== i),
          ];
          sim.embers[i] = spawnEmber(sim.cols, sim.rows, occupied, i, now);
        }
      }
    };

    const drawFrame = (_time: number, deltaTime: number) => {
      const clampedDelta = Math.min(Math.max(deltaTime, 0), 64);
      const reduceMotion = prefersReducedMotion();
      const stepMs = reduceMotion ? 225 : 132;
      const now = performance.now();

      if (!isExiting) {
        sim.stepProgress += clampedDelta / stepMs;
        if (sim.stepProgress >= 1) {
          sim.stepProgress %= 1;
          advanceStep(now);
        }
      }

      const { width, height, dpr, cols, rows, palette } = sim;
      if (width <= 0 || height <= 0 || cols <= 0 || rows <= 0) return;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const cellW = width / cols;
      const cellH = height / rows;
      const cellMin = Math.min(cellW, cellH);

      // Background grid dot matrix
      ctx.fillStyle = palette.dot;
      for (let gx = 0; gx < cols; gx += 1) {
        for (let gy = 0; gy < rows; gy += 1) {
          const cx = (gx + 0.5) * cellW;
          const cy = (gy + 0.5) * cellH;
          ctx.beginPath();
          ctx.arc(cx, cy, 1.05, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Expanding hit ripples
      for (let i = sim.ripples.length - 1; i >= 0; i -= 1) {
        const ripple = sim.ripples[i];
        const age = (now - ripple.bornAt) / 860;
        if (age >= 1) {
          sim.ripples.splice(i, 1);
          continue;
        }
        const eased = 1 - Math.pow(1 - age, 3);
        const radius = cellMin * (0.35 + eased * 2.1);
        ctx.save();
        ctx.globalAlpha = (1 - age) * 0.52;
        ctx.strokeStyle = toneColor(ripple.tone, palette);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Pulsing ember pickups
      for (const ember of sim.embers) {
        const cx = (ember.x + 0.5) * cellW;
        const cy = (ember.y + 0.5) * cellH;
        const spawnScale = Math.min(1, (now - ember.bornAt) / 360);
        const pulse = reduceMotion
          ? 1
          : 0.88 + Math.sin(now * 0.0034 + ember.phase) * 0.14;
        const radius = Math.max(3, cellMin * 0.22 * spawnScale * pulse);
        const color = toneColor(ember.tone, palette);

        ctx.save();
        ctx.globalAlpha = 0.22 * spawnScale;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 2.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.9 * spawnScale;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Sub-pixel interpolated snake body points (tail to head)
      const t = sim.stepProgress;
      const pts: Point[] = [];
      for (let i = sim.snake.length - 1; i >= 0; i -= 1) {
        const curr = sim.snake[i];
        const prev = sim.prevSnake[i] || curr;
        let dx = curr.x - prev.x;
        let dy = curr.y - prev.y;
        if (dx > cols / 2) dx -= cols;
        if (dx < -cols / 2) dx += cols;
        if (dy > rows / 2) dy -= rows;
        if (dy < -rows / 2) dy += rows;

        const ix = wrapCoord(prev.x + dx * t, cols);
        const iy = wrapCoord(prev.y + dy * t, rows);
        pts.push({
          x: (ix + 0.5) * cellW,
          y: (iy + 0.5) * cellH,
        });
      }

      // Ink ribbon body; skip segments that wrap across screen edges so we don't draw a giant line across the canvas
      const len = pts.length;
      if (len > 1) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < len - 1; i += 1) {
          const a = pts[i];
          const b = pts[i + 1];
          const jumpX = Math.abs(b.x - a.x);
          const jumpY = Math.abs(b.y - a.y);
          if (jumpX > cellW * 1.65 || jumpY > cellH * 1.65) {
            continue;
          }
          const ratio = (i + 1) / len;
          ctx.strokeStyle = ratio > 0.72 ? palette.clay : palette.ink;
          ctx.globalAlpha = 0.32 + ratio * 0.64;
          ctx.lineWidth = Math.max(4, cellMin * (0.24 + ratio * 0.34));
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Terracotta snake head with a tiny highlight dot
      if (len > 0) {
        const head = pts[len - 1];
        const headRadius = Math.max(4.5, cellMin * 0.32);

        ctx.save();
        ctx.globalAlpha = 0.24;
        ctx.fillStyle = palette.clay;
        ctx.beginPath();
        ctx.arc(head.x, head.y, headRadius * 1.75, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.96;
        ctx.fillStyle = palette.clay;
        ctx.beginPath();
        ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.85;
        ctx.fillStyle = palette.headSpec;
        ctx.beginPath();
        ctx.arc(
          head.x - headRadius * 0.24,
          head.y - headRadius * 0.24,
          Math.max(1.3, headRadius * 0.26),
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    };

    gsap.ticker.add(drawFrame);

    return () => {
      gsap.ticker.remove(drawFrame);
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
    };
  }, [isExiting]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    containerRef.current?.focus({ preventScroll: true });
    swipeRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const active = swipeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;

    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (Math.hypot(dx, dy) < 18) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      enqueueDirection(dx > 0 ? DIR_RIGHT : DIR_LEFT);
    } else {
      enqueueDirection(dy > 0 ? DIR_DOWN : DIR_UP);
    }

    swipeRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (swipeRef.current?.pointerId === event.pointerId) {
      swipeRef.current = null;
    }
  };

  const steerFromDpad = (dir: Direction) => (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    enqueueDirection(dir);
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Zen snake canvas while generating image. Use arrow keys, WASD, or swipe to steer."
      data-gesture-ignore="true"
      className="dc-img-snake-focus relative h-full w-full select-none outline-none"
    >
      <canvas
        ref={canvasRef}
        data-gesture-ignore="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'none' }}
        className="block h-full w-full cursor-grab active:cursor-grabbing"
      />

      {/* Bottom-left control hint that disappears after first input */}
      <div
        ref={hintRef}
        className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium"
        style={{
          backgroundColor: 'var(--dc-studio-pill-bg)',
          border: '1px solid var(--dc-studio-border)',
          color: 'var(--dc-studio-ink-muted)',
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: 'var(--dc-studio-clay)' }}
          aria-hidden="true"
        />
        <span>Swipe or arrow keys</span>
      </div>

      {/* Touch D-Pad for mobile/tablet screens */}
      <div
        className="dc-snake-dpad absolute bottom-2.5 right-2.5 grid-cols-3 gap-1"
        data-gesture-ignore="true"
        aria-label="Snake steering controls"
      >
        <span />
        <button
          type="button"
          onPointerDown={steerFromDpad(DIR_UP)}
          onClick={() => enqueueDirection(DIR_UP)}
          aria-label="Steer up"
          data-gesture-ignore="true"
          className="dc-snake-dpad-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
        <span />
        <button
          type="button"
          onPointerDown={steerFromDpad(DIR_LEFT)}
          onClick={() => enqueueDirection(DIR_LEFT)}
          aria-label="Steer left"
          data-gesture-ignore="true"
          className="dc-snake-dpad-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onPointerDown={steerFromDpad(DIR_DOWN)}
          onClick={() => enqueueDirection(DIR_DOWN)}
          aria-label="Steer down"
          data-gesture-ignore="true"
          className="dc-snake-dpad-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onPointerDown={steerFromDpad(DIR_RIGHT)}
          onClick={() => enqueueDirection(DIR_RIGHT)}
          aria-label="Steer right"
          data-gesture-ignore="true"
          className="dc-snake-dpad-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        Generating image...
      </span>
    </div>
  );
}
