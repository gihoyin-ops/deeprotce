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

interface CharSample {
  el: HTMLElement;
  centerX: number;
  left: number;
  right: number;
  revealed: boolean;
}

interface VisualLine {
  anchorTop: number;
  left: number;
  right: number;
  centerY: number;
  items: CharSample[];
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

      gsap.set(chars, { opacity: 1, x: 0, y: 0, scale: 1 });
      gsap.set(dotEl, { x: 0, y: 0, scale: 1, opacity: 1 });
      contentEl.classList.remove('dc-headline-pending');

      gsap.fromTo(
        contentEl,
        { opacity: 0 },
        { opacity: 1, duration: 0.24, ease: 'power2.out' }
      );
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const chars = Array.from(contentEl.querySelectorAll<HTMLElement>('.dc-headline-char'));

      if (chars.length === 0) {
        gsap.set(dotEl, { x: 0, y: 0, scale: 1, opacity: 1 });
        contentEl.classList.remove('dc-headline-pending');
        return;
      }

      const dotRect = dotEl.getBoundingClientRect();
      const dotRestCenterX = dotRect.left + dotRect.width * 0.5;
      const dotRestCenterY = dotRect.top + dotRect.height * 0.5;
      const baseRadius = Math.max(dotRect.width * 0.5, 4);

      const measured = chars.map((el) => ({
        el,
        rect: el.getBoundingClientRect(),
      }));

      const firstHeight = Math.max(measured[0].rect.height, 20);
      const lineTolerance = firstHeight * 0.55;
      const lines: VisualLine[] = [];

      for (let i = 0; i < measured.length; i += 1) {
        const { el, rect } = measured[i];
        const sample: CharSample = {
          el,
          centerX: rect.left + rect.width * 0.5,
          left: rect.left,
          right: rect.right,
          revealed: false,
        };
        const centerY = rect.top + rect.height * 0.52;
        const currentLine = lines[lines.length - 1];

        if (!currentLine || Math.abs(currentLine.anchorTop - rect.top) > lineTolerance) {
          lines.push({
            anchorTop: rect.top,
            left: rect.left,
            right: rect.right,
            centerY,
            items: [sample],
          });
        } else {
          currentLine.items.push(sample);
          currentLine.left = Math.min(currentLine.left, rect.left);
          currentLine.right = Math.max(currentLine.right, rect.right);
          const count = currentLine.items.length;
          currentLine.centerY =
            (currentLine.centerY * (count - 1) + centerY) / count;
        }
      }

      const startScale = 3.85;
      const endScale = 1;
      const firstLine = lines[0];
      const startX = Number.isFinite(firstLine.left - dotRestCenterX)
        ? firstLine.left - 18 - dotRestCenterX
        : -240;
      const startY = Number.isFinite(firstLine.centerY - dotRestCenterY)
        ? firstLine.centerY - dotRestCenterY
        : -10;

      gsap.set(chars, {
        opacity: 0,
        x: -5,
        y: 3,
        scale: 0.94,
        transformOrigin: '50% 65%',
      });

      const dotState = {
        x: startX,
        y: startY,
        scale: 0,
        opacity: 0,
      };

      const applyDot = () => {
        gsap.set(dotEl, {
          x: dotState.x,
          y: dotState.y,
          scale: dotState.scale,
          opacity: dotState.opacity,
          transformOrigin: '50% 50%',
        });
      };

      applyDot();
      contentEl.classList.remove('dc-headline-pending');

      const charTweens: gsap.core.Tween[] = [];

      const revealChar = (item: CharSample) => {
        if (item.revealed) return;
        item.revealed = true;
        charTweens.push(
          gsap.to(item.el, {
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: 0.24,
            ease: 'power3.out',
            clearProps: 'transform',
          })
        );
      };

      const revealBehindDot = (lineIndex: number) => {
        const line = lines[lineIndex];
        if (!line) return;
        const liveCenterX = dotRestCenterX + dotState.x;
        const liveRadius = baseRadius * dotState.scale;
        const frontierX = liveCenterX - liveRadius * 0.45;

        for (let i = 0; i < line.items.length; i += 1) {
          const item = line.items[i];
          if (!item.revealed && frontierX >= item.centerX) {
            revealChar(item);
          }
        }
      };

      const revealLineRemaining = (lineIndex: number) => {
        const line = lines[lineIndex];
        if (!line) return;
        for (let i = 0; i < line.items.length; i += 1) {
          if (!line.items[i].revealed) {
            revealChar(line.items[i]);
          }
        }
      };

      const totalSweepDuration = lines.length > 1 ? 1.12 : 0.94;
      const totalChars = Math.max(chars.length, 1);

      const tl = gsap.timeline({ defaults: { force3D: true } });

      tl.to(dotState, {
        scale: startScale,
        opacity: 1,
        duration: 0.24,
        ease: 'back.out(2.0)',
        onUpdate: applyDot,
      });

      let accumulatedChars = 0;
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
        const line = lines[lineIdx];
        const isFirstLine = lineIdx === 0;
        const isLastLine = lineIdx === lines.length - 1;

        if (!isFirstLine) {
          const nextStartX = line.left - 16 - dotRestCenterX;
          const nextStartY = line.centerY - dotRestCenterY;
          tl.to(dotState, {
            x: nextStartX,
            y: nextStartY,
            duration: 0.13,
            ease: 'power2.inOut',
            onUpdate: applyDot,
          });
        }

        accumulatedChars += line.items.length;
        const progressEnd = accumulatedChars / totalChars;
        const targetScale = startScale + (endScale - startScale) * progressEnd;
        const lineDuration = Math.max(
          0.26,
          totalSweepDuration * (line.items.length / totalChars)
        );

        const targetEndX = isLastLine ? 0 : line.right + 14 - dotRestCenterX;
        const targetEndY = isLastLine ? 0 : line.centerY - dotRestCenterY;

        tl.to(dotState, {
          x: targetEndX,
          y: targetEndY,
          scale: targetScale,
          duration: lineDuration,
          ease: 'power2.inOut',
          onUpdate: () => {
            applyDot();
            revealBehindDot(lineIdx);
          },
          onComplete: () => {
            revealLineRemaining(lineIdx);
          },
        });
      }

      tl.to(dotState, {
        scale: 1.18,
        duration: 0.12,
        ease: 'power2.out',
        onUpdate: applyDot,
      })
        .to(dotState, {
          scale: 1,
          duration: 0.22,
          ease: 'back.out(2.4)',
          onUpdate: applyDot,
        })
        .to(dotEl, {
          scale: 1.16,
          opacity: 0.84,
          duration: 2.2,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });

      return () => {
        tl.kill();
        charTweens.forEach((tween) => tween.kill());
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
