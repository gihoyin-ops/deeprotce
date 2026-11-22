'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface ModelTierEmblemSvgProps {
  tierIndex: number;
  isUltra: boolean;
  isHovered?: boolean;
  size?: number;
  className?: string;
}

const ARC_OFFSETS = [100, 72, 42, 18, 0] as const;
const STAR_SCALES = [0.84, 0.92, 0.98, 1.03, 1.08] as const;

export function ModelTierEmblemSvg({
  tierIndex,
  isUltra,
  isHovered = false,
  size = 16,
  className = '',
}: ModelTierEmblemSvgProps) {
  const rawId = useId();
  const gradId = `dc-emblem-prism-${rawId.replace(/:/g, '')}`;

  const svgRef = useRef<SVGSVGElement>(null);
  const orbitGroupRef = useRef<SVGGElement>(null);
  const arcTopRef = useRef<SVGPathElement>(null);
  const arcBottomRef = useRef<SVGPathElement>(null);
  const starRef = useRef<SVGPathElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const gradRef = useRef<SVGLinearGradientElement>(null);

  useEffect(() => {
    const orbitEl = orbitGroupRef.current;
    const arcTopEl = arcTopRef.current;
    const arcBottomEl = arcBottomRef.current;
    const starEl = starRef.current;
    const coreEl = coreRef.current;
    const gradEl = gradRef.current;
    if (!orbitEl || !arcTopEl || !arcBottomEl || !starEl || !coreEl) return;

    const clampedTier = Math.min(4, Math.max(0, tierIndex));
    const targetOffset = ARC_OFFSETS[clampedTier] ?? 72;
    const targetStarScale = STAR_SCALES[clampedTier] ?? 0.92;
    const arcOpacity = clampedTier === 0 ? 0 : isUltra ? 0.95 : 0.42 + clampedTier * 0.12;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set([arcTopEl, arcBottomEl], {
        strokeDashoffset: targetOffset,
        opacity: arcOpacity,
      });
      gsap.set(starEl, { scale: targetStarScale, transformOrigin: '10px 10px' });
      gsap.set(orbitEl, { rotation: 0, svgOrigin: '10 10' });
      gsap.set(coreEl, { scale: 1, opacity: isUltra ? 0.95 : 0.65, transformOrigin: '10px 10px' });
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to([arcTopEl, arcBottomEl], {
        strokeDashoffset: targetOffset,
        opacity: arcOpacity,
        duration: 0.46,
        ease: 'expo.out',
      });

      gsap.to(starEl, {
        scale: targetStarScale,
        transformOrigin: '10px 10px',
        duration: 0.42,
        ease: 'back.out(1.9)',
      });

      const spinProxy = { angle: 0 };
      let spinTween: gsap.core.Tween | null = null;
      let gradTween: gsap.core.Tween | null = null;
      let coreTween: gsap.core.Tween | null = null;

      if (isUltra) {
        spinTween = gsap.to(orbitEl, {
          rotation: '+=360',
          svgOrigin: '10 10',
          duration: 14,
          repeat: -1,
          ease: 'none',
        });

        if (gradEl) {
          gradTween = gsap.to(spinProxy, {
            angle: 360,
            duration: 6.5,
            repeat: -1,
            ease: 'none',
            onUpdate: () => {
              gradEl.setAttribute('gradientTransform', `rotate(${spinProxy.angle.toFixed(1)} 10 10)`);
            },
          });
        }

        coreTween = gsap.fromTo(
          coreEl,
          { scale: 0.95, opacity: 0.8, transformOrigin: '10px 10px' },
          {
            scale: 1.3,
            opacity: 1,
            transformOrigin: '10px 10px',
            duration: 1.9,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          }
        );
      } else {
        gsap.to(orbitEl, {
          rotation: 0,
          svgOrigin: '10 10',
          duration: 0.36,
          ease: 'power3.out',
        });
        gsap.to(coreEl, {
          scale: clampedTier >= 2 ? 1.08 : 0.9,
          opacity: clampedTier === 0 ? 0.35 : 0.72,
          transformOrigin: '10px 10px',
          duration: 0.3,
          ease: 'power2.out',
        });
      }

      return () => {
        spinTween?.kill();
        gradTween?.kill();
        coreTween?.kill();
        gsap.killTweensOf([orbitEl, arcTopEl, arcBottomEl, starEl, coreEl, spinProxy]);
      };
    });

    return () => {
      mm.revert();
    };
  }, [tierIndex, isUltra]);

  useEffect(() => {
    const svgEl = svgRef.current;
    const starEl = starRef.current;
    if (!svgEl || !starEl) return;
    if (
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    gsap.to(starEl, {
      rotation: isHovered ? 24 : 0,
      svgOrigin: '10 10',
      duration: isHovered ? 0.38 : 0.28,
      ease: isHovered ? 'back.out(2.2)' : 'power3.out',
    });

    gsap.to(svgEl, {
      scale: isHovered ? 1.09 : 1,
      duration: isHovered ? 0.32 : 0.24,
      ease: isHovered ? 'back.out(2.0)' : 'power3.out',
    });
  }, [isHovered]);

  const strokePaint = isUltra ? `url(#${gradId})` : 'currentColor';

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 overflow-visible ${className}`}
    >
      <defs>
        <linearGradient
          ref={gradRef}
          id={gradId}
          x1="2"
          y1="2"
          x2="18"
          y2="18"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="34%" stopColor="#818cf8" />
          <stop offset="68%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>

      <g ref={orbitGroupRef}>
        <path
          ref={arcTopRef}
          d="M 2.8 10 A 7.2 7.2 0 0 1 17.2 10"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset="100"
          stroke={strokePaint}
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          ref={arcBottomRef}
          d="M 17.2 10 A 7.2 7.2 0 0 1 2.8 10"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset="100"
          stroke={strokePaint}
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </g>

      <path
        ref={starRef}
        d="M10 3.7C10.55 6.95 13.05 9.45 16.3 10C13.05 10.55 10.55 13.05 10 16.3C9.45 13.05 6.95 10.55 3.7 10C6.95 9.45 9.45 6.95 10 3.7Z"
        stroke={strokePaint}
        strokeWidth="1.35"
        strokeLinejoin="round"
        fill={isUltra ? strokePaint : 'none'}
        fillOpacity={isUltra ? 0.16 : 0}
      />

      <circle
        ref={coreRef}
        cx="10"
        cy="10"
        r="1.35"
        fill={strokePaint}
      />
    </svg>
  );
}

interface UltraPrismBorderSvgProps {
  active: boolean;
  className?: string;
}

export function UltraPrismBorderSvg({ active, className = '' }: UltraPrismBorderSvgProps) {
  const rawId = useId();
  const gradId = `dc-prism-rim-${rawId.replace(/:/g, '')}`;

  const svgRef = useRef<SVGSVGElement>(null);
  const rectRef = useRef<SVGRectElement>(null);
  const gradRef = useRef<SVGLinearGradientElement>(null);
  const [bounds, setBounds] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const measure = () => {
      const rect = svgEl.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      setBounds((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };

    const frame = window.requestAnimationFrame(measure);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(svgEl);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const rectEl = rectRef.current;
    const gradEl = gradRef.current;
    if (!rectEl || bounds.w <= 6 || bounds.h <= 6) return;

    const innerW = bounds.w - 1.5;
    const innerH = bounds.h - 1.5;
    const straight = Math.max(0, innerW - innerH);
    const perimeter = Math.round((2 * straight + Math.PI * Math.max(1, innerH)) * 10) / 10;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(rectEl, {
        strokeDasharray: 'none',
        strokeDashoffset: 0,
        opacity: active ? 0.85 : 0,
      });
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const proxy = { angle: 0 };
      let rotTween: gsap.core.Tween | null = null;

      if (active) {
        gsap.set(rectEl, { strokeDasharray: perimeter });
        gsap.fromTo(
          rectEl,
          { strokeDashoffset: perimeter, opacity: 0 },
          {
            strokeDashoffset: 0,
            opacity: 0.9,
            duration: 0.72,
            ease: 'expo.out',
          }
        );

        if (gradEl) {
          const cx = bounds.w / 2;
          const cy = bounds.h / 2;
          rotTween = gsap.to(proxy, {
            angle: 360,
            duration: 7.5,
            repeat: -1,
            ease: 'none',
            onUpdate: () => {
              gradEl.setAttribute(
                'gradientTransform',
                `rotate(${proxy.angle.toFixed(1)} ${cx} ${cy})`
              );
            },
          });
        }
      } else {
        gsap.to(rectEl, {
          opacity: 0,
          duration: 0.22,
          ease: 'power2.out',
        });
      }

      return () => {
        rotTween?.kill();
        gsap.killTweensOf([rectEl, proxy]);
      };
    });

    return () => {
      mm.revert();
    };
  }, [active, bounds.w, bounds.h]);

  const innerW = Math.max(1, bounds.w - 1.5);
  const innerH = Math.max(1, bounds.h - 1.5);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full overflow-visible ${className}`}
    >
      <defs>
        <linearGradient
          ref={gradRef}
          id={gradId}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={Math.max(1, bounds.w)}
          y2={Math.max(1, bounds.h)}
        >
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="28%" stopColor="#818cf8" />
          <stop offset="56%" stopColor="#c084fc" />
          <stop offset="80%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {bounds.w > 6 && bounds.h > 6 && (
        <rect
          ref={rectRef}
          x={0.75}
          y={0.75}
          width={innerW}
          height={innerH}
          rx={innerH / 2}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={1.35}
          opacity={0}
        />
      )}
    </svg>
  );
}

interface AnimatedCheckSvgProps {
  isUltra?: boolean;
  size?: number;
}

export function AnimatedCheckSvg({ isUltra = false, size = 18 }: AnimatedCheckSvgProps) {
  const rawId = useId();
  const gradId = `dc-check-prism-${rawId.replace(/:/g, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    const pathEl = pathRef.current;
    if (!svgEl || !pathEl) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(svgEl, { scale: 1, opacity: 1 });
      gsap.set(pathEl, { strokeDashoffset: 0 });
      return;
    }

    const tl = gsap.timeline();
    tl.fromTo(
      svgEl,
      { scale: 0.65, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.28, ease: 'back.out(2.3)' },
      0
    ).fromTo(
      pathEl,
      { strokeDashoffset: 20 },
      { strokeDashoffset: 0, duration: 0.3, ease: 'power3.out' },
      0.06
    );

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 shrink-0"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="18" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#db2777" />
        </linearGradient>
      </defs>
      <circle
        cx="9"
        cy="9"
        r="8.5"
        fill={isUltra ? `url(#${gradId})` : '#0371DD'}
      />
      <path
        ref={pathRef}
        d="M5.4 9.2L7.8 11.6L12.7 6.5"
        pathLength={20}
        strokeDasharray="20"
        strokeDashoffset="20"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface SliderWaveSvgProps {
  active: boolean;
  isUltra: boolean;
}

export function SliderWaveSvg({ active, isUltra }: SliderWaveSvgProps) {
  const waveGroupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const waveEl = waveGroupRef.current;
    if (!waveEl) return;

    if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(waveEl, { x: 0 });
      return;
    }

    const tween = gsap.fromTo(
      waveEl,
      { x: 0 },
      {
        x: -120,
        duration: isUltra ? 2.6 : 4.2,
        repeat: -1,
        ease: 'none',
      }
    );

    return () => {
      tween.kill();
    };
  }, [active, isUltra]);

  if (!active) return null;

  return (
    <svg
      viewBox="0 0 120 30"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
    >
      <g ref={waveGroupRef} opacity={isUltra ? 0.34 : 0.18}>
        <path
          d="M 0 16 Q 30 9, 60 16 T 120 16 T 180 16 T 240 16 L 240 30 L 0 30 Z"
          fill="#ffffff"
          fillOpacity={0.25}
        />
        <path
          d="M 0 16 Q 30 9, 60 16 T 120 16 T 180 16 T 240 16"
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.55}
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}
