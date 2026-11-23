'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { gsap } from 'gsap';

export type KineticDotMode = 'manual' | 'idle' | 'thinking' | 'streaming';
export type KineticDotSize = 'sm' | 'md' | 'lg';

export interface KineticDotProps {
  mode?: KineticDotMode;
  size?: KineticDotSize;
  inline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

const SIZE_CLASSES: Record<KineticDotSize, string> = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

const KineticDot = forwardRef<HTMLSpanElement, KineticDotProps>(function KineticDot(
  {
    mode = 'idle',
    size = 'md',
    inline = false,
    className = '',
    style,
    ariaLabel,
  },
  forwardedRef
) {
  const internalRef = useRef<HTMLSpanElement>(null);

  useImperativeHandle(forwardedRef, () => internalRef.current as HTMLSpanElement, []);

  useEffect(() => {
    const el = internalRef.current;
    if (!el || mode === 'manual') return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(el, { scale: 1, opacity: 1, x: 0, y: 0 });
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (mode === 'idle') {
        const tween = gsap.to(el, {
          scale: 1.16,
          opacity: 0.84,
          duration: 2.2,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
        return () => tween.kill();
      }

      if (mode === 'thinking') {
        const tl = gsap.timeline({ repeat: -1, defaults: { force3D: true } });
        tl.to(el, {
          scale: 1.28,
          scaleX: 1.34,
          scaleY: 1.2,
          x: 1.5,
          y: -1,
          opacity: 0.95,
          duration: 0.55,
          ease: 'sine.inOut',
        })
          .to(el, {
            scale: 0.92,
            scaleX: 0.9,
            scaleY: 0.98,
            x: -1,
            y: 1,
            opacity: 0.72,
            duration: 0.55,
            ease: 'sine.inOut',
          })
          .to(el, {
            scale: 1,
            scaleX: 1,
            scaleY: 1,
            x: 0,
            y: 0,
            opacity: 1,
            duration: 0.45,
            ease: 'sine.out',
          });
        return () => tl.kill();
      }

      if (mode === 'streaming') {
        const tween = gsap.to(el, {
          scale: 1.18,
          opacity: 0.88,
          duration: 0.7,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
        return () => tween.kill();
      }

      return undefined;
    });

    return () => {
      mm.revert();
    };
  }, [mode]);

  const classes = [
    'dc-kinetic-blue-dot',
    SIZE_CLASSES[size],
    inline ? 'dc-kinetic-blue-dot--inline' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      ref={internalRef}
      className={classes}
      style={style}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      role={ariaLabel ? 'status' : undefined}
    />
  );
});

export default KineticDot;
