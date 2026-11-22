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

  useEffect(() => {
    const headingEl = headingRef.current;
    const contentEl = contentRef.current;
    if (!ready || !headingEl || !contentEl) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: reduce)', () => {
      const glyphs = contentEl.querySelectorAll<HTMLElement>('.dc-dot-glyph');
      const beads = contentEl.querySelectorAll<HTMLElement>('.dc-dot-bead');
      const tail = contentEl.querySelector<HTMLElement>('.dc-dot-tail');

      gsap.set(beads, { opacity: 0, scale: 0 });
      gsap.set(glyphs, { opacity: 1, y: 0, scale: 1 });
      if (tail) gsap.set(tail, { opacity: 0.85, scale: 1, x: 0 });
      contentEl.classList.remove('dc-dot-pending');

      gsap.fromTo(
        contentEl,
        { opacity: 0 },
        { opacity: 1, duration: 0.25, ease: 'power2.out' }
      );
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const glyphs = contentEl.querySelectorAll<HTMLElement>('.dc-dot-glyph');
      const beads = contentEl.querySelectorAll<HTMLElement>('.dc-dot-bead');
      const tail = contentEl.querySelector<HTMLElement>('.dc-dot-tail');

      if (glyphs.length === 0) {
        contentEl.classList.remove('dc-dot-pending');
        return;
      }

      const step = Math.min(0.025, 0.64 / Math.max(glyphs.length, 1));

      gsap.set(glyphs, {
        opacity: 0,
        y: 10,
        scale: 0.78,
        transformOrigin: '50% 65%',
      });
      gsap.set(beads, {
        opacity: 0,
        scale: 0,
        x: -6,
        y: 2,
        transformOrigin: '50% 50%',
      });
      if (tail) {
        gsap.set(tail, {
          opacity: 0,
          scale: 0,
          x: -6,
          transformOrigin: '50% 50%',
        });
      }

      contentEl.classList.remove('dc-dot-pending');

      const tl = gsap.timeline({ defaults: { force3D: true } });

      tl.to(
        beads,
        {
          opacity: 1,
          scale: 1.18,
          x: 0,
          y: 0,
          duration: 0.22,
          ease: 'back.out(2.4)',
          stagger: { each: step, from: 'start' },
        },
        0
      )
        .to(
          beads,
          {
            opacity: 0,
            scale: 0.15,
            x: 3,
            y: -7,
            duration: 0.22,
            ease: 'power2.in',
            stagger: { each: step, from: 'start' },
          },
          0.15
        )
        .to(
          glyphs,
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.44,
            ease: 'expo.out',
            stagger: { each: step, from: 'start' },
            clearProps: 'transform',
          },
          0.14
        );

      if (tail) {
        const tailAt = 0.18 + glyphs.length * step;
        tl.to(
          tail,
          {
            opacity: 1,
            scale: 1,
            x: 0,
            duration: 0.34,
            ease: 'back.out(2.5)',
          },
          tailAt
        ).to(
          tail,
          {
            scale: 1.24,
            opacity: 0.55,
            duration: 1.9,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          },
          tailAt + 0.36
        );
      }

      return () => {
        tl.kill();
      };
    });

    return () => {
      contentEl.classList.add('dc-dot-pending');
      mm.revert();
    };
  }, [text, ready]);

  const words = text.trim().split(/\s+/).filter(Boolean);

  const sizeClasses =
    size === 'compact'
      ? 'max-w-[40rem] text-[24px] font-medium leading-[1.2] tracking-[-0.02em] sm:text-[32px]'
      : 'max-w-[44rem] text-[28px] font-medium leading-[1.18] tracking-[-0.025em] sm:text-[38px]';

  const renderedWords = (
    <span key={text} ref={contentRef} className="dc-dot-pending inline">
      {words.map((word, wordIndex) => {
        const isLastWord = wordIndex === words.length - 1;
        const chars = Array.from(word);

        return (
          <React.Fragment key={`${wordIndex}-${word}`}>
            <span className="inline-flex flex-nowrap items-baseline whitespace-nowrap">
              {chars.map((char, charIndex) => (
                <span key={`${charIndex}-${char}`} className="dc-dot-cell">
                  <span className="dc-dot-bead" aria-hidden="true" />
                  <span className="dc-dot-glyph" aria-hidden="true">
                    {char}
                  </span>
                </span>
              ))}
              {isLastWord && <span className="dc-dot-tail" aria-hidden="true" />}
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
          className="inline cursor-pointer rounded-xl bg-transparent text-inherit focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--deepchat-accent,#4f46e5)]"
        >
          {renderedWords}
        </button>
      ) : (
        renderedWords
      )}
    </HeadingTag>
  );
}
