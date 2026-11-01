'use client';

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface GsapMorphSvgProps {
  children: React.ReactElement;
  className?: string;
  /** Custom morph rotation angle on desktop hover in degrees, default 12 */
  rotate?: number;
  /** Scale on hover, default 1.15 */
  scale?: number;
  /** Whether to apply magnetic fluid cursor tracking on desktop */
  magnetic?: boolean;
}

/**
 * High-performance GSAP wrapper for SVG icons.
 * On desktop PC (hover: hover and pointer: fine), applies smooth spring micro-animations,
 * path morphing/stroke animations, and magnetic fluid reactions on hover.
 */
export default function GsapMorphSvg({
  children,
  className = '',
  rotate = 12,
  scale = 1.15,
  magnetic = true
}: GsapMorphSvgProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const isDesktopRef = useRef(false);

  useEffect(() => {
    // Detect PC (desktop with hover capability)
    isDesktopRef.current = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const el = containerRef.current;
    if (!el) return;

    // Fast setters for 60fps performance
    const xTo = gsap.quickTo(el, 'x', { duration: 0.25, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.25, ease: 'power3.out' });

    const handleMouseEnter = () => {
      if (!isDesktopRef.current) return;
      const svg = el.querySelector('svg');
      if (!svg) return;

      // Kill any in-flight tweens
      gsap.killTweensOf([el, svg]);

      // Elastic spring scale and rotation on SVG
      gsap.to(svg, {
        scale,
        rotate,
        transformOrigin: '50% 50%',
        duration: 0.38,
        ease: 'back.out(2.2)',
        filter: 'drop-shadow(0 2px 6px rgba(99, 102, 241, 0.35))'
      });

      // Animate SVG child paths (stroke/dash/morph wave)
      const paths = svg.querySelectorAll('path, circle, rect, polygon');
      if (paths.length > 0) {
        gsap.to(paths, {
          strokeWidth: '+=0.4',
          duration: 0.25,
          stagger: 0.04,
          ease: 'power2.out'
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDesktopRef.current || !magnetic) return;
      const rect = el.getBoundingClientRect();
      const relX = (e.clientX - rect.left - rect.width / 2) * 0.25;
      const relY = (e.clientY - rect.top - rect.height / 2) * 0.25;
      xTo(relX);
      yTo(relY);
    };

    const handleMouseLeave = () => {
      if (!isDesktopRef.current) return;
      const svg = el.querySelector('svg');
      if (!svg) return;

      gsap.killTweensOf([el, svg]);

      gsap.to(svg, {
        scale: 1,
        rotate: 0,
        filter: 'none',
        duration: 0.26,
        ease: 'power3.out'
      });

      const paths = svg.querySelectorAll('path, circle, rect, polygon');
      if (paths.length > 0) {
        gsap.to(paths, {
          strokeWidth: '',
          duration: 0.22,
          ease: 'power2.inOut'
        });
      }

      if (magnetic) {
        xTo(0);
        yTo(0);
      }
    };

    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
      gsap.killTweensOf([el]);
      const svg = el.querySelector('svg');
      if (svg) gsap.killTweensOf(svg);
    };
  }, [rotate, scale, magnetic]);

  return (
    <span
      ref={containerRef}
      className={`inline-flex items-center justify-center will-change-transform ${className}`}
      style={{ display: 'inline-flex' }}
    >
      {children}
    </span>
  );
}
