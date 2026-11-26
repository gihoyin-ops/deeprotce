'use client';

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface GsapMorphSvgProps {
  children: React.ReactElement;
  className?: string;
  /** Hover rotation angle on desktop in degrees, defaults to 12 */
  rotate?: number;
  /** Hover scale factor, defaults to 1.15 */
  scale?: number;
  /** Pull the icon toward the cursor on desktop hover */
  magnetic?: boolean;
}

/**
 * GSAP hover wrapper for SVG icons.
 * On real desktop pointers (hover: hover and pointer: fine), runs spring scale/rotate,
 * stroke tweaks, and magnetic cursor tracking.
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
    // Check if we're actually on a desktop with hover/fine pointer
    isDesktopRef.current = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const el = containerRef.current;
    if (!el) return;

    // quickTo setters so cursor tracking doesn't lag like shit
    const xTo = gsap.quickTo(el, 'x', { duration: 0.25, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.25, ease: 'power3.out' });

    const handleMouseEnter = () => {
      if (!isDesktopRef.current) return;
      const svg = el.querySelector('svg');
      if (!svg) return;

      // Nuke any running tweens first
      gsap.killTweensOf([el, svg]);

      // Bouncy spring scale and rotation on the SVG
      gsap.to(svg, {
        scale,
        rotate,
        transformOrigin: '50% 50%',
        duration: 0.38,
        ease: 'back.out(2.2)',
        filter: 'drop-shadow(0 2px 6px rgba(99, 102, 241, 0.35))'
      });

      // Thicken the child paths slightly on hover
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
