'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { IMAGE_GENERATION_STATUS_TEXTS } from '@/lib/images/image-generation';
import { type ImageAspectRatio } from '@/lib/images/image-aspect-ratio';

export interface AbstractStudioCanvasProps {
  variant: 'abstract-text' | 'abstract-pure';
  requestedAspectRatio?: ImageAspectRatio;
  isExiting?: boolean;
}

interface StudioQuote {
  tag: string;
  line: string;
}

const STUDIO_QUOTES: StudioQuote[] = [
  {
    tag: 'On Craft',
    line: 'Every memorable form begins as a quiet silhouette waiting for light.',
  },
  {
    tag: 'On Composition',
    line: 'Leave room around the subject — empty space is what lets an idea breathe.',
  },
  {
    tag: 'On Imagination',
    line: 'What feels uncertain in a first sketch is often the seed of something original.',
  },
  {
    tag: 'On Light',
    line: 'Light never merely reveals a scene; it chooses the emotion of the frame.',
  },
  {
    tag: 'On Making',
    line: 'Curiosity opens the door. Patience turns a fleeting thought into something real.',
  },
  {
    tag: 'On Detail',
    line: 'True craft is rarely loud — it rewards the person who looks a second time.',
  },
  {
    tag: 'On Perspective',
    line: 'Shift the angle by a few degrees, and the familiar suddenly becomes a story.',
  },
  {
    tag: 'On Creation',
    line: 'A blank canvas is not an absence; it is an invitation to build something unseen.',
  },
  {
    tag: 'On Rhythm',
    line: 'Contrast gives a frame its pulse — softness makes sharpness feel intentional.',
  },
  {
    tag: 'On Vision',
    line: 'Great work begins the moment you trust a small visual hunch enough to follow it.',
  },
  {
    tag: 'On Texture',
    line: 'Warmth lives in the subtle imperfections that make a surface feel touched by hand.',
  },
  {
    tag: 'On Exploration',
    line: 'The most interesting direction is rarely the first obvious one you think of.',
  },
  {
    tag: 'On Wonder',
    line: 'Make things that invite someone to pause and wonder how it feels inside the frame.',
  },
  {
    tag: 'On Clarity',
    line: 'Removing one unnecessary element often says more than adding three new ones.',
  },
  {
    tag: 'On Momentum',
    line: 'Every creative breakthrough is built from small experiments you dared to render.',
  },
  {
    tag: 'On Color',
    line: 'Two restrained tones in harmony carry more weight than a dozen competing at once.',
  },
  {
    tag: 'On Presence',
    line: 'Thoughtful design slows the eye down just enough to notice what truly matters.',
  },
  {
    tag: 'On Originality',
    line: 'Bring two quiet worlds together, and let their meeting spark something unexpected.',
  },
];

type PureArtworkStyle = 'sculpted-orbits' | 'living-contours';

function pickInitialQuoteIndex(): number {
  return Math.floor(Math.random() * STUDIO_QUOTES.length);
}

function pickPureArtworkStyle(): PureArtworkStyle {
  return Math.random() < 0.5 ? 'sculpted-orbits' : 'living-contours';
}

const MOTES = [
  { cx: 56, cy: 254, r: 2.1, o: 0.45 },
  { cx: 128, cy: 220, r: 1.5, o: 0.35 },
  { cx: 204, cy: 266, r: 2.3, o: 0.4 },
  { cx: 282, cy: 238, r: 1.7, o: 0.38 },
  { cx: 344, cy: 260, r: 1.9, o: 0.34 },
  { cx: 92, cy: 132, r: 1.4, o: 0.28 },
  { cx: 316, cy: 112, r: 1.8, o: 0.3 },
];

const CONTOUR_PATHS = [
  'M 180 62 C 238 60, 294 106, 298 172 C 302 238, 250 296, 180 298 C 110 300, 62 246, 62 178 C 62 110, 122 64, 180 62 Z',
  'M 184 78 C 232 82, 278 120, 280 176 C 282 232, 236 280, 178 282 C 120 284, 78 236, 80 180 C 82 124, 136 74, 184 78 Z',
  'M 178 96 C 224 96, 264 134, 264 178 C 264 226, 224 264, 178 264 C 132 264, 96 226, 98 180 C 100 134, 132 96, 178 96 Z',
  'M 182 114 C 218 118, 246 144, 246 180 C 246 218, 214 246, 180 246 C 144 246, 114 216, 116 178 C 118 140, 146 110, 182 114 Z',
  'M 179 130 C 208 130, 230 152, 230 180 C 230 208, 208 230, 180 230 C 150 230, 130 208, 130 180 C 130 152, 150 130, 179 130 Z',
  'M 181 144 C 201 146, 216 161, 216 180 C 216 200, 200 216, 180 216 C 160 216, 144 199, 144 180 C 144 161, 161 142, 181 144 Z',
  'M 180 158 C 193 158, 202 168, 202 180 C 202 193, 192 202, 180 202 C 168 202, 158 192, 158 180 C 158 168, 167 158, 180 158 Z',
];

function StudioBloomMark({
  bloomRef,
  size = 16,
}: {
  bloomRef?: React.RefObject<SVGSVGElement | null>;
  size?: number;
}) {
  return (
    <svg
      ref={bloomRef}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 will-change-transform"
    >
      <g stroke="var(--dc-studio-clay)" strokeWidth="1.9" strokeLinecap="round">
        <line x1="12" y1="3" x2="12" y2="7.4" />
        <line x1="12" y1="16.6" x2="12" y2="21" />
        <line x1="3" y1="12" x2="7.4" y2="12" />
        <line x1="16.6" y1="12" x2="21" y2="12" />
        <line x1="5.6" y1="5.6" x2="8.8" y2="8.8" />
        <line x1="15.2" y1="15.2" x2="18.4" y2="18.4" />
        <line x1="18.4" y1="5.6" x2="15.2" y2="8.8" />
        <line x1="8.8" y1="15.2" x2="5.6" y2="18.4" />
      </g>
      <circle cx="12" cy="12" r="2.2" fill="var(--dc-studio-clay)" />
    </svg>
  );
}

export default function AbstractStudioCanvas({
  variant,
  requestedAspectRatio = 'auto',
  isExiting = false,
}: AbstractStudioCanvasProps) {
  const uid = useId().replace(/:/g, '');
  const rootRef = useRef<HTMLDivElement>(null);
  const quoteContainerRef = useRef<HTMLParagraphElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const bloomRef = useRef<SVGSVGElement>(null);
  const shimmerRef = useRef<HTMLSpanElement>(null);

  const [quoteIndex, setQuoteIndex] = useState(pickInitialQuoteIndex);
  const [statusIndex, setStatusIndex] = useState(0);
  const [pureStyle] = useState<PureArtworkStyle>(pickPureArtworkStyle);

  const isFirstQuoteMountRef = useRef(true);
  const isFirstStatusMountRef = useRef(true);

  // Continuous ambient GSAP motion for BOTH 'abstract-text' and 'abstract-pure'
  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: reduce)', () => {
      const words = rootEl.querySelectorAll<HTMLElement>('.dc-img-quote-word');
      if (words.length > 0) {
        gsap.set(words, { opacity: 1, y: 0, filter: 'none' });
      }
      if (shimmerRef.current) {
        gsap.set(shimmerRef.current, { opacity: 0.35, xPercent: 0 });
      }
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // Drifting atmospheric light blobs (shared across both abstract variants)
      const blobs = rootEl.querySelectorAll<HTMLElement>('.dc-abs-blob');
      const blobConfigs = [
        { x: 26, y: -18, scaleX: 1.12, scaleY: 0.94, rotation: 18, duration: 7.3 },
        { x: -24, y: 22, scaleX: 0.92, scaleY: 1.14, rotation: -22, duration: 9.7 },
        { x: 18, y: 20, scaleX: 1.08, scaleY: 1.06, rotation: 14, duration: 11.3 },
      ];
      blobs.forEach((blob, idx) => {
        const cfg = blobConfigs[idx % blobConfigs.length];
        gsap.to(blob, {
          x: cfg.x,
          y: cfg.y,
          scaleX: cfg.scaleX,
          scaleY: cfg.scaleY,
          rotation: cfg.rotation,
          transformOrigin: '50% 50%',
          duration: cfg.duration,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      });

      // Flowing silk curves & traveling light filaments
      const ribbons = rootEl.querySelectorAll<SVGElement>('.dc-abs-ribbon');
      ribbons.forEach((ribbon, idx) => {
        gsap.to(ribbon, {
          y: idx % 2 === 0 ? -10 : 11,
          rotation: idx % 2 === 0 ? 2.4 : -2.2,
          scaleY: idx % 2 === 0 ? 1.06 : 0.95,
          transformOrigin: '50% 50%',
          duration: 6.4 + idx * 1.45,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      });

      const filaments = rootEl.querySelectorAll<SVGPathElement>('.dc-abs-filament');
      filaments.forEach((filament, idx) => {
        gsap.fromTo(
          filament,
          { strokeDashoffset: idx % 2 === 0 ? 0 : 380 },
          {
            strokeDashoffset: idx % 2 === 0 ? -380 : 0,
            duration: 8.5 + idx * 2.1,
            repeat: -1,
            ease: 'none',
          }
        );
      });

      // Floating dust motes
      const motes = rootEl.querySelectorAll<SVGCircleElement>('.dc-abs-mote');
      motes.forEach((mote, idx) => {
        gsap.to(mote, {
          y: -26 - (idx % 3) * 10,
          x: idx % 2 === 0 ? 8 : -9,
          opacity: 0.72,
          scale: 1.35,
          transformOrigin: '50% 50%',
          duration: 4.8 + (idx % 4) * 1.3,
          delay: idx * 0.45,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      });

      // Bloom mark rotation + gentle breathing
      if (bloomRef.current) {
        gsap.to(bloomRef.current, {
          rotation: 360,
          transformOrigin: '50% 50%',
          duration: 18,
          repeat: -1,
          ease: 'none',
        });
        gsap.to(bloomRef.current, {
          scale: 1.14,
          transformOrigin: '50% 50%',
          duration: 2.6,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }

      // Bottom ultra-thin warm filament sweep
      if (shimmerRef.current) {
        gsap.fromTo(
          shimmerRef.current,
          { xPercent: -110 },
          {
            xPercent: 210,
            duration: 3.1,
            repeat: -1,
            ease: 'sine.inOut',
          }
        );
      }

      // Kinetic sculpture animations for 'abstract-pure' (5%)
      if (variant === 'abstract-pure') {
        const orbitShapes = rootEl.querySelectorAll<SVGElement>('.dc-pure-orbit');
        const orbitMotions = [
          { x: 24, y: -18, rotation: 22, scaleX: 1.1, scaleY: 0.92, duration: 6.8 },
          { x: -22, y: 20, rotation: -26, scaleX: 0.92, scaleY: 1.1, duration: 8.3 },
          { x: 16, y: 24, rotation: 18, scaleX: 1.08, scaleY: 1.04, duration: 9.9 },
          { x: -18, y: -22, rotation: -16, scaleX: 0.94, scaleY: 1.08, duration: 11.4 },
        ];
        orbitShapes.forEach((shape, idx) => {
          const m = orbitMotions[idx % orbitMotions.length];
          gsap.to(shape, {
            x: m.x,
            y: m.y,
            rotation: m.rotation,
            scaleX: m.scaleX,
            scaleY: m.scaleY,
            transformOrigin: '50% 50%',
            duration: m.duration,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          });
        });

        const rings = rootEl.querySelectorAll<SVGElement>('.dc-pure-ring');
        rings.forEach((ring, idx) => {
          gsap.to(ring, {
            rotation: idx % 2 === 0 ? 360 : -360,
            transformOrigin: '180px 180px',
            duration: 22 + idx * 7,
            repeat: -1,
            ease: 'none',
          });
        });

        const contours = rootEl.querySelectorAll<SVGPathElement>('.dc-pure-contour');
        contours.forEach((contour, idx) => {
          gsap.to(contour, {
            scale: idx % 2 === 0 ? 1.055 : 0.955,
            rotation: idx % 2 === 0 ? 7 : -7,
            x: idx % 2 === 0 ? 6 : -6,
            y: idx % 3 === 0 ? -5 : 5,
            transformOrigin: '180px 180px',
            duration: 5.2 + idx * 0.55,
            delay: idx * 0.18,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          });
          if (idx % 2 === 1) {
            gsap.fromTo(
              contour,
              { strokeDashoffset: 0 },
              {
                strokeDashoffset: -220,
                duration: 14 + idx * 2,
                repeat: -1,
                ease: 'none',
              }
            );
          }
        });

        const coreOrb = rootEl.querySelector<SVGElement>('.dc-pure-core');
        if (coreOrb) {
          gsap.to(coreOrb, {
            scale: 1.18,
            opacity: 0.92,
            transformOrigin: '180px 180px',
            duration: 3.4,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          });
        }

        // Subtle magnetic parallax on desktop fine pointers
        const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        if (canHover) {
          const backLayer = rootEl.querySelector<HTMLElement>('.dc-pure-parallax-back');
          const midLayer = rootEl.querySelector<HTMLElement>('.dc-pure-parallax-mid');
          const frontLayer = rootEl.querySelector<HTMLElement>('.dc-pure-parallax-front');

          const xBack = backLayer ? gsap.quickTo(backLayer, 'x', { duration: 0.65, ease: 'power3.out' }) : null;
          const yBack = backLayer ? gsap.quickTo(backLayer, 'y', { duration: 0.65, ease: 'power3.out' }) : null;
          const xMid = midLayer ? gsap.quickTo(midLayer, 'x', { duration: 0.52, ease: 'power3.out' }) : null;
          const yMid = midLayer ? gsap.quickTo(midLayer, 'y', { duration: 0.52, ease: 'power3.out' }) : null;
          const xFront = frontLayer ? gsap.quickTo(frontLayer, 'x', { duration: 0.42, ease: 'power3.out' }) : null;
          const yFront = frontLayer ? gsap.quickTo(frontLayer, 'y', { duration: 0.42, ease: 'power3.out' }) : null;

          const handleMove = (event: PointerEvent) => {
            const rect = rootEl.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const nx = (event.clientX - rect.left) / rect.width - 0.5;
            const ny = (event.clientY - rect.top) / rect.height - 0.5;
            xBack?.(nx * 10);
            yBack?.(ny * 10);
            xMid?.(nx * 18);
            yMid?.(ny * 18);
            xFront?.(nx * 26);
            yFront?.(ny * 26);
          };

          const handleLeave = () => {
            xBack?.(0);
            yBack?.(0);
            xMid?.(0);
            yMid?.(0);
            xFront?.(0);
            yFront?.(0);
          };

          rootEl.addEventListener('pointermove', handleMove);
          rootEl.addEventListener('pointerleave', handleLeave);

          return () => {
            rootEl.removeEventListener('pointermove', handleMove);
            rootEl.removeEventListener('pointerleave', handleLeave);
          };
        }
      }
    });

    return () => {
      mm.revert();
    };
  }, [variant, pureStyle]);

  // Cycle inspirational quotes gracefully while generating (paused during exit morph)
  useEffect(() => {
    if (variant !== 'abstract-text' || isExiting) return;

    let cancelled = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const intervalId = window.setInterval(() => {
      if (cancelled) return;
      const container = quoteContainerRef.current;
      const words = container?.querySelectorAll<HTMLElement>('.dc-img-quote-word');

      if (!words || words.length === 0 || reduce) {
        setQuoteIndex((prev) => (prev + 1) % STUDIO_QUOTES.length);
        return;
      }

      gsap.to(words, {
        opacity: 0,
        y: -8,
        filter: 'blur(3px)',
        duration: 0.34,
        stagger: 0.014,
        ease: 'power2.in',
        onComplete: () => {
          if (!cancelled) {
            setQuoteIndex((prev) => (prev + 1) % STUDIO_QUOTES.length);
          }
        },
      });
    }, 5400);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [variant, isExiting]);

  // Animate each newly displayed quote in with GSAP word-stagger
  useEffect(() => {
    if (variant !== 'abstract-text') return;
    const container = quoteContainerRef.current;
    if (!container) return;
    const words = container.querySelectorAll<HTMLElement>('.dc-img-quote-word');
    if (words.length === 0) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const initialMount = isFirstQuoteMountRef.current;
    isFirstQuoteMountRef.current = false;

    if (reduce) {
      gsap.set(words, { opacity: 1, y: 0, filter: 'none' });
      return;
    }

    gsap.killTweensOf(words);
    gsap.fromTo(
      words,
      { opacity: 0, y: 10, filter: 'blur(4px)' },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.6,
        delay: initialMount ? 0.08 : 0.02,
        stagger: 0.032,
        ease: 'power3.out',
        clearProps: 'transform,filter',
      }
    );
  }, [quoteIndex, variant]);

  // Cycle subtle studio status whispers in 'abstract-text' mode
  useEffect(() => {
    if (variant !== 'abstract-text' || isExiting) return;

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
        y: -5,
        duration: 0.24,
        ease: 'power2.in',
        onComplete: () => {
          if (!cancelled) {
            setStatusIndex((prev) => (prev + 1) % IMAGE_GENERATION_STATUS_TEXTS.length);
          }
        },
      });
    }, 3200);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [variant, isExiting]);

  useEffect(() => {
    if (variant !== 'abstract-text') return;
    const el = statusRef.current;
    if (!el) return;

    if (isFirstStatusMountRef.current) {
      isFirstStatusMountRef.current = false;
      return;
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }

    gsap.fromTo(
      el,
      { opacity: 0, y: 5 },
      { opacity: 1, y: 0, duration: 0.34, ease: 'power3.out', clearProps: 'transform' }
    );
  }, [statusIndex, variant]);

  const activeQuote = STUDIO_QUOTES[quoteIndex] || STUDIO_QUOTES[0];
  const quoteWords = activeQuote.line.split(' ');

  return (
    <div ref={rootRef} className="relative h-full w-full select-none overflow-hidden">
      {/* Moving Atmospheric SVG Canvas (Active in BOTH abstract-text and abstract-pure) */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={variant === 'abstract-pure' ? '0 0 360 360' : '0 0 400 320'}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`dc-clay-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--dc-studio-clay)" stopOpacity="0.28" />
            <stop offset="58%" stopColor="var(--dc-studio-clay)" stopOpacity="0.09" />
            <stop offset="100%" stopColor="var(--dc-studio-clay)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`dc-ochre-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--dc-studio-ochre)" stopOpacity="0.34" />
            <stop offset="56%" stopColor="var(--dc-studio-ochre)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--dc-studio-ochre)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`dc-sage-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--dc-studio-sage)" stopOpacity="0.26" />
            <stop offset="60%" stopColor="var(--dc-studio-sage)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--dc-studio-sage)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`dc-silk-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--dc-studio-clay)" stopOpacity="0.04" />
            <stop offset="50%" stopColor="var(--dc-studio-clay)" stopOpacity="0.48" />
            <stop offset="100%" stopColor="var(--dc-studio-ochre)" stopOpacity="0.06" />
          </linearGradient>
          <filter id={`dc-grain-${uid}`} x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.78"
              numOctaves={2}
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix type="saturate" values="0" in="noise" result="mono" />
          </filter>
        </defs>

        {variant === 'abstract-text' ? (
          <>
            {/* Ambient drifting light fields */}
            <ellipse
              className="dc-abs-blob"
              cx="312"
              cy="64"
              rx="150"
              ry="120"
              fill={`url(#dc-clay-${uid})`}
            />
            <ellipse
              className="dc-abs-blob"
              cx="74"
              cy="258"
              rx="165"
              ry="130"
              fill={`url(#dc-ochre-${uid})`}
            />
            <ellipse
              className="dc-abs-blob"
              cx="236"
              cy="226"
              rx="132"
              ry="104"
              fill={`url(#dc-sage-${uid})`}
            />

            {/* Flowing editorial meridian curves */}
            <g fill="none">
              <path
                className="dc-abs-ribbon"
                d="M -30 232 C 62 178, 152 278, 248 214 C 316 168, 366 196, 434 152"
                stroke="var(--dc-studio-border-strong)"
                strokeWidth="1.05"
                strokeOpacity="0.52"
              />
              <path
                className="dc-abs-ribbon dc-abs-filament"
                d="M -30 232 C 62 178, 152 278, 248 214 C 316 168, 366 196, 434 152"
                stroke={`url(#dc-silk-${uid})`}
                strokeWidth="1.65"
                strokeDasharray="68 312"
                strokeLinecap="round"
              />
              <path
                className="dc-abs-ribbon"
                d="M -26 98 C 86 144, 174 52, 272 108 C 338 146, 382 102, 436 128"
                stroke="var(--dc-studio-border-strong)"
                strokeWidth="0.95"
                strokeOpacity="0.38"
              />
              <path
                className="dc-abs-ribbon dc-abs-filament"
                d="M -26 98 C 86 144, 174 52, 272 108 C 338 146, 382 102, 436 128"
                stroke={`url(#dc-silk-${uid})`}
                strokeWidth="1.45"
                strokeDasharray="52 328"
                strokeLinecap="round"
              />
              <path
                className="dc-abs-ribbon"
                d="M -18 286 C 98 256, 206 306, 424 238"
                stroke="var(--dc-studio-ochre)"
                strokeWidth="0.85"
                strokeOpacity="0.28"
              />
            </g>

            {/* Drifting warm dust motes */}
            <g>
              {MOTES.map((mote, index) => (
                <circle
                  key={index}
                  className="dc-abs-mote"
                  cx={mote.cx}
                  cy={mote.cy}
                  r={mote.r}
                  fill={index % 2 === 0 ? 'var(--dc-studio-clay)' : 'var(--dc-studio-ochre)'}
                  opacity={mote.o}
                />
              ))}
            </g>

            {/* Subtle studio registration marks */}
            <g stroke="var(--dc-studio-ink-faint)" strokeWidth="0.9" strokeOpacity="0.32" fill="none">
              <path d="M 16 24 L 16 16 L 24 16" />
              <path d="M 376 16 L 384 16 L 384 24" />
              <path d="M 16 296 L 16 304 L 24 304" />
              <path d="M 376 304 L 384 304 L 384 296" />
            </g>
          </>
        ) : pureStyle === 'sculpted-orbits' ? (
          <>
            {/* Pure Abstract Mode A: Sculpted Organic Orbits */}
            <g className="dc-pure-parallax-back">
              <ellipse
                className="dc-abs-blob"
                cx="104"
                cy="108"
                rx="148"
                ry="140"
                fill={`url(#dc-ochre-${uid})`}
              />
              <ellipse
                className="dc-abs-blob"
                cx="266"
                cy="252"
                rx="144"
                ry="136"
                fill={`url(#dc-clay-${uid})`}
              />
              <ellipse
                className="dc-abs-blob"
                cx="260"
                cy="98"
                rx="126"
                ry="120"
                fill={`url(#dc-sage-${uid})`}
              />
            </g>

            <g className="dc-pure-parallax-mid" fill="none">
              <ellipse
                className="dc-pure-ring"
                cx="180"
                cy="180"
                rx="132"
                ry="94"
                transform="rotate(-22 180 180)"
                stroke="var(--dc-studio-border-strong)"
                strokeWidth="1.05"
                strokeOpacity="0.55"
              />
              <ellipse
                className="dc-pure-ring"
                cx="180"
                cy="180"
                rx="102"
                ry="132"
                transform="rotate(28 180 180)"
                stroke="var(--dc-studio-clay)"
                strokeWidth="1.1"
                strokeOpacity="0.34"
                strokeDasharray="160 80"
              />
              <circle
                className="dc-pure-ring"
                cx="180"
                cy="180"
                r="68"
                stroke="var(--dc-studio-border-strong)"
                strokeWidth="0.95"
                strokeOpacity="0.45"
                strokeDasharray="6 10"
              />
            </g>

            <g className="dc-pure-parallax-front">
              <path
                className="dc-pure-orbit"
                d="M 142 96 C 194 74, 246 112, 238 164 C 230 216, 178 238, 128 214 C 82 192, 92 118, 142 96 Z"
                fill="var(--dc-studio-clay)"
                fillOpacity="0.22"
                stroke="var(--dc-studio-clay)"
                strokeOpacity="0.42"
                strokeWidth="1.1"
              />
              <path
                className="dc-pure-orbit"
                d="M 192 138 C 244 128, 280 172, 266 220 C 252 268, 198 282, 160 250 C 122 218, 142 148, 192 138 Z"
                fill="var(--dc-studio-ochre)"
                fillOpacity="0.26"
                stroke="var(--dc-studio-ochre)"
                strokeOpacity="0.5"
                strokeWidth="1"
              />
              <path
                className="dc-pure-orbit"
                d="M 122 162 C 166 146, 210 176, 202 222 C 194 268, 146 286, 108 258 C 72 230, 80 178, 122 162 Z"
                fill="var(--dc-studio-sage)"
                fillOpacity="0.22"
                stroke="var(--dc-studio-sage)"
                strokeOpacity="0.42"
                strokeWidth="1"
              />
              <circle
                className="dc-pure-core"
                cx="180"
                cy="180"
                r="14"
                fill="var(--dc-studio-clay)"
                fillOpacity="0.72"
              />
              {MOTES.slice(0, 5).map((mote, index) => (
                <circle
                  key={index}
                  className="dc-abs-mote"
                  cx={mote.cx * 0.88}
                  cy={mote.cy * 0.92}
                  r={mote.r}
                  fill="var(--dc-studio-clay)"
                  opacity={mote.o}
                />
              ))}
            </g>
          </>
        ) : (
          <>
            {/* Pure Abstract Mode B: Living Topographic Silk Contours */}
            <g className="dc-pure-parallax-back">
              <ellipse
                className="dc-abs-blob"
                cx="180"
                cy="180"
                rx="165"
                ry="165"
                fill={`url(#dc-ochre-${uid})`}
              />
              <ellipse
                className="dc-abs-blob"
                cx="228"
                cy="142"
                rx="128"
                ry="124"
                fill={`url(#dc-clay-${uid})`}
              />
              <ellipse
                className="dc-abs-blob"
                cx="132"
                cy="222"
                rx="124"
                ry="118"
                fill={`url(#dc-sage-${uid})`}
              />
            </g>

            <g className="dc-pure-parallax-mid" fill="none">
              {CONTOUR_PATHS.map((d, idx) => (
                <path
                  key={idx}
                  className="dc-pure-contour"
                  d={d}
                  stroke={idx % 2 === 0 ? 'var(--dc-studio-border-strong)' : 'var(--dc-studio-clay)'}
                  strokeWidth={idx >= 4 ? '1.35' : '1.05'}
                  strokeOpacity={0.22 + idx * 0.08}
                  strokeDasharray={idx % 2 === 1 ? '140 80' : undefined}
                  strokeLinecap="round"
                />
              ))}
            </g>

            <g className="dc-pure-parallax-front">
              <circle
                className="dc-pure-core"
                cx="180"
                cy="180"
                r="10"
                fill="var(--dc-studio-clay)"
                fillOpacity="0.82"
              />
              <circle
                className="dc-pure-core"
                cx="180"
                cy="180"
                r="22"
                fill="none"
                stroke="var(--dc-studio-clay)"
                strokeOpacity="0.32"
                strokeWidth="1.2"
              />
              {MOTES.slice(0, 4).map((mote, index) => (
                <circle
                  key={index}
                  className="dc-abs-mote"
                  cx={mote.cx * 0.85}
                  cy={mote.cy * 0.88}
                  r={mote.r}
                  fill="var(--dc-studio-ink-muted)"
                  opacity={mote.o}
                />
              ))}
            </g>
          </>
        )}

        {/* Tactile fine paper grain overlay */}
        <rect
          width="100%"
          height="100%"
          filter={`url(#dc-grain-${uid})`}
          opacity="0.04"
        />
      </svg>

      {variant === 'abstract-text' ? (
        <div className="dc-img-studio-inner relative z-10 flex h-full w-full flex-col justify-between">
          {/* Editorial top eyebrow */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-[1px] w-4 rounded-full"
                style={{ backgroundColor: 'var(--dc-studio-clay)' }}
                aria-hidden="true"
              />
              <span className="dc-img-studio-tag text-[10.5px] font-semibold uppercase tracking-[0.14em]">
                {activeQuote.tag}
              </span>
            </div>

            {requestedAspectRatio !== 'auto' && (
              <span className="dc-img-studio-pill inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-wide">
                {requestedAspectRatio}
              </span>
            )}
          </div>

          {/* Balanced serif inspiration */}
          <p ref={quoteContainerRef} className="dc-img-quote-text my-auto py-3">
            {quoteWords.map((word, idx) => (
              <React.Fragment key={`${quoteIndex}-${idx}`}>
                <span className="dc-img-quote-word inline-block will-change-transform">
                  {word}
                </span>
                {idx < quoteWords.length - 1 ? ' ' : ''}
              </React.Fragment>
            ))}
          </p>

          {/* Quiet status whisper */}
          <div className="flex items-center gap-2.5 pt-1">
            <StudioBloomMark bloomRef={bloomRef} size={15} />
            <span
              ref={statusRef}
              role="status"
              aria-live="polite"
              className="dc-img-status-text text-[12.5px] font-medium tracking-[-0.01em]"
            >
              {IMAGE_GENERATION_STATUS_TEXTS[statusIndex]}
            </span>
          </div>
        </div>
      ) : (
        /* Pure Abstract Mode: Zero inspirational prose, just living art + tiny studio bloom */
        <div className="relative z-10 flex h-full w-full items-end justify-between p-4">
          <div className="flex items-center gap-2">
            <StudioBloomMark bloomRef={bloomRef} size={14} />
            <span className="sr-only" role="status" aria-live="polite">
              Generating image...
            </span>
          </div>
          {requestedAspectRatio !== 'auto' && (
            <span className="dc-img-studio-pill inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-wide opacity-80">
              {requestedAspectRatio}
            </span>
          )}
        </div>
      )}

      {/* Razor-thin animated progress filament */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px] overflow-hidden"
        style={{ backgroundColor: 'var(--dc-studio-border)' }}
        aria-hidden="true"
      >
        <span
          ref={shimmerRef}
          className="block h-full w-[44%] rounded-full"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, var(--dc-studio-clay) 50%, var(--dc-studio-ochre) 82%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
}
