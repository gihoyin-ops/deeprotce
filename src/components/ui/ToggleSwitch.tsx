'use client';

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

type ToggleSwitchSize = 'sm' | 'md' | 'mobile';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: ToggleSwitchSize;
  ariaLabel?: string;
  className?: string;
}

const sizeClasses: Record<ToggleSwitchSize, { track: string; thumb: string; targetX: number }> = {
  sm: {
    track: 'h-6 w-11 p-0.5',
    thumb: 'h-5 w-5',
    targetX: 20
  },
  md: {
    track: 'h-7 w-12 p-0.5',
    thumb: 'h-6 w-6',
    targetX: 20
  },
  mobile: {
    track: 'h-[31px] w-[51px] p-[2px]',
    thumb: 'h-[27px] w-[27px]',
    targetX: 20
  }
};

export default function ToggleSwitch({ checked, onChange, disabled = false, size = 'md', ariaLabel, className = '' }: ToggleSwitchProps) {
  const sizes = sizeClasses[size];
  const thumbRef = useRef<HTMLSpanElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!thumbRef.current) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      gsap.set(thumbRef.current, { x: checked ? sizes.targetX : 0 });
      return;
    }

    gsap.killTweensOf(thumbRef.current);
    gsap.fromTo(
      thumbRef.current,
      { scaleX: 1.25, scaleY: 0.88 },
      {
        x: checked ? sizes.targetX : 0,
        scaleX: 1,
        scaleY: 1,
        duration: 0.28,
        ease: 'back.out(1.8)'
      }
    );
  }, [checked, sizes.targetX]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`${sizes.track} ${className} inline-flex shrink-0 items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${checked ? 'bg-indigo-600 shadow-sm shadow-indigo-600/30' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
      <span ref={thumbRef} className={`${sizes.thumb} block rounded-full bg-white shadow-sm will-change-transform`} />
    </button>
  );
}
