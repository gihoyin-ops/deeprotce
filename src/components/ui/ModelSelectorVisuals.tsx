'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';

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
