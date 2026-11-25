'use client';

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';

interface AnimatedIconProps {
  hovered?: boolean;
  className?: string;
}

export function AnimatedNewChatSvg({
  hovered = false,
  className = 'h-[17px] w-[17px]'
}: AnimatedIconProps) {
  const penRef = useRef<SVGGElement | null>(null);
  const boxRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (penRef.current) {
      gsap.to(penRef.current, {
        x: hovered ? 1.4 : 0,
        y: hovered ? -1.4 : 0,
        rotation: hovered ? -8 : 0,
        transformOrigin: '16px 8px',
        duration: 0.42,
        ease: 'elastic.out(1, 0.6)'
      });
    }
    if (boxRef.current) {
      gsap.to(boxRef.current, {
        scale: hovered ? 0.96 : 1,
        transformOrigin: '11px 13px',
        duration: 0.35,
        ease: 'power3.out'
      });
    }
  }, [hovered]);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path
        ref={boxRef}
        d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
      />
      <g ref={penRef}>
        <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
      </g>
    </svg>
  );
}

export function AnimatedLibrarySvg({
  hovered = false,
  className = 'h-[17px] w-[17px]'
}: AnimatedIconProps) {
  const bar1Ref = useRef<SVGLineElement | null>(null);
  const bar2Ref = useRef<SVGLineElement | null>(null);
  const tiltBarRef = useRef<SVGLineElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (bar1Ref.current) {
      gsap.to(bar1Ref.current, {
        y: hovered ? -1.5 : 0,
        duration: 0.38,
        ease: 'elastic.out(1, 0.65)'
      });
    }
    if (bar2Ref.current) {
      gsap.to(bar2Ref.current, {
        y: hovered ? 1.2 : 0,
        duration: 0.38,
        ease: 'elastic.out(1, 0.65)'
      });
    }
    if (tiltBarRef.current) {
      gsap.to(tiltBarRef.current, {
        rotation: hovered ? -10 : 0,
        x: hovered ? 0.8 : 0,
        transformOrigin: '16px 20px',
        duration: 0.45,
        ease: 'elastic.out(1.05, 0.6)'
      });
    }
  }, [hovered]);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line ref={bar1Ref} x1="4" y1="6" x2="4" y2="20" />
      <line ref={bar2Ref} x1="8" y1="4" x2="8" y2="20" />
      <line x1="12" y1="8" x2="12" y2="20" />
      <line ref={tiltBarRef} x1="16" y1="6" x2="20" y2="20" />
    </svg>
  );
}

export function AnimatedImagesSvg({
  hovered = false,
  className = 'h-[17px] w-[17px]'
}: AnimatedIconProps) {
  const sunRef = useRef<SVGCircleElement | null>(null);
  const mountainRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (sunRef.current) {
      gsap.to(sunRef.current, {
        attr: { cx: hovered ? 10.5 : 9, cy: hovered ? 8 : 9 },
        scale: hovered ? 1.15 : 1,
        transformOrigin: 'center',
        duration: 0.44,
        ease: 'elastic.out(1, 0.6)'
      });
    }
    if (mountainRef.current) {
      gsap.to(mountainRef.current, {
        y: hovered ? -1.2 : 0,
        duration: 0.36,
        ease: 'power3.out'
      });
    }
  }, [hovered]);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="3" ry="3" />
      <circle ref={sunRef} cx="9" cy="9" r="1.8" />
      <path ref={mountainRef} d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

export function AnimatedSearchSvg({
  hovered = false,
  className = 'h-[18px] w-[18px]'
}: AnimatedIconProps) {
  const groupRef = useRef<SVGGElement | null>(null);
  const handleRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (groupRef.current) {
      gsap.to(groupRef.current, {
        rotation: hovered ? -12 : 0,
        scale: hovered ? 1.08 : 1,
        transformOrigin: '11px 11px',
        duration: 0.42,
        ease: 'elastic.out(1, 0.6)'
      });
    }
    if (handleRef.current) {
      gsap.to(handleRef.current, {
        x: hovered ? 0.8 : 0,
        y: hovered ? 0.8 : 0,
        duration: 0.32,
        ease: 'power3.out'
      });
    }
  }, [hovered]);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <g ref={groupRef}>
        <circle cx="11" cy="11" r="8" />
        <path ref={handleRef} d="m21 21-4.3-4.3" />
      </g>
    </svg>
  );
}
