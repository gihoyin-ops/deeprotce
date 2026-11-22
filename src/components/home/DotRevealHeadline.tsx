'use client';

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface DotRevealHeadlineProps {
  text: string;
  ready?: boolean;
  size?: 'hero' | 'compact';
  className?: string;
  onCycleHeadline?: () => void;
}

export default function DotRevealHeadline({
  text,
  ready = true,
  size = 'hero',
  className = '',
  onCycleHeadline,
}: DotRevealHeadlineProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const contentEl = contentRef.current;
    const dotEl = dotRef.current;
    if (!ready || !contentEl || !dotEl) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: reduce)', () => {
      const chars = contentEl.querySelectorAll<HTMLElement>('.dc-headline-char');

      gsap.set(chars, { opacity: 1, y: 0, scale: 1 });
      gsap.set(dotEl, { x: 0, y: 0, scale: 1, opacity: 1 });
      contentEl.classList.remove('dc-headline-pending');

      gsap.fromTo(
        contentEl,
        { opacity: 0 },
        { opacity: 1, duration: 0.24, ease: 'power2.out' }
      );
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const chars = contentEl.querySelectorAll<HTMLElement>('.dc-headline-char');

      if (chars.length === 0) {
        gsap.set(dotEl, { x: 0, y: 0, scale: 1, opacity: 1 });
        contentEl.classList.remove('dc-headline-pending');
        return;
      }

      const firstRect = chars[0].getBoundingClientRect();
      const dotRect = dotEl.getBoundingClientRect();

      const dotCenterX = dotRect.left + dotRect.width * 0.5;
      const dotCenterY = dotRect.top + dotRect.height * 0.5;
      const targetStartX = firstRect.left - 12 - dotCenterX;
      const targetStartY = firstRect.top + firstRect.height * 0.52 - dotCenterY;

      const startX = Number.isFinite(targetStartX) ? targetStartX : -240;
      const startY = Number.isFinite(targetStartY) ? targetStartY : -10;

      const sweepDuration = 0.92;
      const charStagger = (sweepDuration * 0.84) / Math.max(chars.length, 1);

      gsap.set(chars, {
        opacity: 0,
        y: 7,
        scale: 0.92,
        transformOrigin: '50% 70%',
      });

      gsap.set(dotEl, {
        x: startX,
        y: startY,
        scale: 0,
        opacity: 0,
        transformOrigin: '50% 50%',
      });

      contentEl.classList.remove('dc-headline-pending');

      const tl = gsap.timeline({ defaults: { force3D: true } });

      tl.to(
        dotEl,
        {
          scale: 3.85,
          opacity: 1,
          duration: 0.24,
          ease: 'back.out(2.0)',
        },
        0
      )
        .to(
          dotEl,
          {
            x: 0,
            y: 0,
            scale: 1,
            duration: sweepDuration,
            ease: 'power3.inOut',
          },
          0.16
        )
        .to(
          chars,
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.36,
            ease: 'expo.out',
            stagger: { each: charStagger, from: 'start' },
            clearProps: 'transform',
          },
          0.24
        )
        .to(
          dotEl,
          {
            scale: 1.2,
            duration: 0.14,
            ease: 'power2.out',
          },
          0.16 + sweepDuration
        )
        .to(
          dotEl,
          {
            scale: 1,
            duration: 0.22,
            ease: 'back.out(2.4)',
          },
          0.3 + sweepDuration
        )
        .to(
          dotEl,
          {
            scale: 1.16,
            opacity: 0.82,
            duration: 2.2,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          },
          0.54 + sweepDuration
        );

      return () => {
        tl.kill();
      };
    });

    return () => {
      contentEl.classList.add('dc-headline-pending');
      mm.revert();
    };
  }, [text, ready]);

  const words = text.trim().split(/\s+/).filter(Boolean);

  const sizeClasses =
    size === 'compact'
      ? 'max-w-[40rem] text-[24px] font-medium leading-[1.2] tracking-[-0.02em] sm:text-[32px]'
      : 'max-w-[44rem] text-[28px] font-medium leading-[1.18] tracking-[-0.025em] sm:text-[38px]';

  const renderedWords = (
    <span key={text} ref={contentRef} className="dc-headline-pending inline">
      {words.map((word, wordIndex) => {
        const isLastWord = wordIndex === words.length - 1;
        const chars = Array.from(word);

        return (
          <React.Fragment key={`${wordIndex}-${word}`}>
            <span className="inline-flex flex-nowrap items-baseline whitespace-nowrap">
              {chars.map((char, charIndex) => (
                <span
                  key={`${charIndex}-${char}`}
                  className="dc-headline-char"
                  aria-hidden="true"
                >
                  {char}
                </span>
              ))}
              {isLastWord && (
                <span
                  ref={dotRef}
                  className="dc-kinetic-blue-dot"
                  aria-hidden="true"
                />
              )}
            </span>
            {!isLastWord && (
              <span className="inline-block w-[0.27em]" aria-hidden="true">
                &nbsp;
              </span>
            )}
          </React.Fragment>
        );
      })}
    </span>
  );

  const HeadingTag = size === 'compact' ? 'h2' : 'h1';

  return (
    <HeadingTag
      ref={headingRef}
      aria-label={text}
      className={`text-center text-[var(--dc-text-strong)] transition-opacity duration-150 ${ready ? 'opacity-100' : 'opacity-0'} ${sizeClasses} ${className}`}
    >
      {onCycleHeadline ? (
        <button
          type="button"
          onClick={onCycleHeadline}
          className="inline cursor-pointer rounded-xl bg-transparent text-inherit focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
        >
          {renderedWords}
        </button>
      ) : (
        renderedWords
      )}
    </HeadingTag>
  );
}
