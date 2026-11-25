'use client';

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';

interface PasswordToggleButtonProps {
  visible: boolean;
  onToggle: () => void;
}

export default function PasswordToggleButton({
  visible,
  onToggle,
}: PasswordToggleButtonProps) {
  const iconRef = useRef<SVGSVGElement | null>(null);
  const slashRef = useRef<SVGLineElement | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (prefersReducedMotion()) return;

    if (iconRef.current) {
      gsap.fromTo(
        iconRef.current,
        { scale: 0.78, rotate: visible ? -10 : 10 },
        { scale: 1, rotate: 0, duration: 0.28, ease: 'back.out(2.4)' }
      );
    }

    if (slashRef.current) {
      gsap.fromTo(
        slashRef.current,
        { strokeDashoffset: visible ? 26 : 0, opacity: visible ? 0 : 1 },
        {
          strokeDashoffset: visible ? 0 : 26,
          opacity: visible ? 1 : 0,
          duration: 0.22,
          ease: 'power2.out',
        }
      );
    }
  }, [visible]);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible}
      className="absolute top-1/2 right-2.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
    >
      <svg
        ref={iconRef}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
        <line
          ref={slashRef}
          x1="3"
          y1="3"
          x2="21"
          y2="21"
          strokeDasharray="26"
          strokeDashoffset={visible ? 0 : 26}
          style={{ opacity: visible ? 1 : 0 }}
        />
      </svg>
    </button>
  );
}
