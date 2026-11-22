'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ArrowRight, BrainCircuit, Globe, ImageIcon, X } from '@/components/ui/icons';
import {
  consumeHomeAnnouncementImpression,
  dismissHomeAnnouncement,
  HOME_ANNOUNCEMENTS,
  type AnnouncementActionType,
  type AnnouncementIconKey,
} from '@/lib/home/home-announcement';

interface HomeAnnouncementCardProps {
  onAction: (action: AnnouncementActionType) => void;
}

function renderAnnouncementIcon(icon: AnnouncementIconKey) {
  switch (icon) {
    case 'globe':
      return <Globe className="h-[18px] w-[18px]" strokeWidth={1.9} />;
    case 'image':
      return <ImageIcon className="h-[18px] w-[18px]" strokeWidth={1.9} />;
    case 'brain':
      return <BrainCircuit className="h-[18px] w-[18px]" strokeWidth={1.9} />;
  }
}

export default function HomeAnnouncementCard({ onAction }: HomeAnnouncementCardProps) {
  const [visible, setVisible] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const outerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const iconTileRef = useRef<HTMLDivElement>(null);
  const slideContentRef = useRef<HTMLDivElement>(null);
  const pendingEnterDirRef = useRef<number>(0);
  const isTransitioningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      const result = consumeHomeAnnouncementImpression();
      if (result.visible) {
        setSlideIndex(result.initialSlide);
        setVisible(true);
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const outerEl = outerRef.current;
    const cardEl = cardRef.current;
    const iconEl = iconTileRef.current;
    if (!outerEl || !cardEl) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const staggerItems = cardEl.querySelectorAll<HTMLElement>('.dc-ann-stagger');

      gsap.fromTo(
        outerEl,
        { opacity: 0, y: -12, scale: 0.985 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.56,
          ease: 'expo.out',
          delay: 0.06,
          clearProps: 'transform',
        }
      );

      if (staggerItems.length > 0) {
        gsap.fromTo(
          staggerItems,
          { opacity: 0, y: 6 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.045,
            ease: 'power3.out',
            delay: 0.12,
            clearProps: 'transform',
          }
        );
      }
    });

    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(outerEl, { opacity: 1, y: 0, scale: 1 });
    });

    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!isFinePointer) {
      return () => mm.revert();
    }

    const spot = { x: 0, y: 0 };
    const xTo = gsap.quickTo(spot, 'x', {
      duration: 0.28,
      ease: 'power3.out',
      onUpdate: () => cardEl.style.setProperty('--spot-x', `${spot.x.toFixed(1)}px`),
    });
    const yTo = gsap.quickTo(spot, 'y', {
      duration: 0.28,
      ease: 'power3.out',
      onUpdate: () => cardEl.style.setProperty('--spot-y', `${spot.y.toFixed(1)}px`),
    });

    const handleEnter = (event: MouseEvent) => {
      const rect = cardEl.getBoundingClientRect();
      const relX = event.clientX - rect.left;
      const relY = event.clientY - rect.top;
      spot.x = relX;
      spot.y = relY;
      cardEl.style.setProperty('--spot-x', `${relX.toFixed(1)}px`);
      cardEl.style.setProperty('--spot-y', `${relY.toFixed(1)}px`);
      cardEl.style.setProperty('--spot-opacity', '1');

      if (iconEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.to(iconEl, {
          scale: 1.08,
          rotate: -6,
          duration: 0.34,
          ease: 'back.out(2.2)',
        });
      }
    };

    const handleMove = (event: MouseEvent) => {
      const rect = cardEl.getBoundingClientRect();
      xTo(event.clientX - rect.left);
      yTo(event.clientY - rect.top);
    };

    const handleLeave = () => {
      cardEl.style.setProperty('--spot-opacity', '0');
      if (iconEl) {
        gsap.to(iconEl, {
          scale: 1,
          rotate: 0,
          duration: 0.26,
          ease: 'power3.out',
        });
      }
    };

    cardEl.addEventListener('mouseenter', handleEnter);
    cardEl.addEventListener('mousemove', handleMove);
    cardEl.addEventListener('mouseleave', handleLeave);

    return () => {
      cardEl.removeEventListener('mouseenter', handleEnter);
      cardEl.removeEventListener('mousemove', handleMove);
      cardEl.removeEventListener('mouseleave', handleLeave);
      gsap.killTweensOf(spot);
      mm.revert();
    };
  }, [visible]);

  useEffect(() => {
    const dir = pendingEnterDirRef.current;
    const contentEl = slideContentRef.current;
    if (dir === 0 || !contentEl) return;

    pendingEnterDirRef.current = 0;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      isTransitioningRef.current = false;
      return;
    }

    const tween = gsap.fromTo(
      contentEl,
      { x: dir * 14, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.3,
        ease: 'expo.out',
        clearProps: 'transform,opacity',
        onComplete: () => {
          isTransitioningRef.current = false;
        },
      }
    );

    return () => {
      tween.kill();
      isTransitioningRef.current = false;
    };
  }, [slideIndex]);

  const handleSelectSlide = (nextIndex: number) => {
    if (nextIndex === slideIndex || isClosing || isTransitioningRef.current) return;

    const dir = nextIndex > slideIndex ? 1 : -1;
    const contentEl = slideContentRef.current;

    if (!contentEl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSlideIndex(nextIndex);
      return;
    }

    isTransitioningRef.current = true;
    gsap.to(contentEl, {
      x: -dir * 12,
      opacity: 0,
      duration: 0.16,
      ease: 'power2.in',
      onComplete: () => {
        pendingEnterDirRef.current = dir;
        setSlideIndex(nextIndex);
      },
    });
  };

  const handleDismiss = () => {
    if (isClosing) return;
    setIsClosing(true);
    dismissHomeAnnouncement();

    const outerEl = outerRef.current;
    const cardEl = cardRef.current;

    if (!outerEl || !cardEl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(false);
      return;
    }

    const measuredHeight = outerEl.offsetHeight;
    gsap.set(outerEl, { height: measuredHeight, overflow: 'hidden' });

    const tl = gsap.timeline({
      onComplete: () => setVisible(false),
    });

    tl.to(cardEl, {
      opacity: 0,
      y: -8,
      scale: 0.97,
      duration: 0.22,
      ease: 'power2.in',
    }).to(
      outerEl,
      {
        height: 0,
        marginBottom: 0,
        opacity: 0,
        duration: 0.28,
        ease: 'power3.inOut',
      },
      '-=0.06'
    );
  };

  if (!visible) return null;

  const current = HOME_ANNOUNCEMENTS[slideIndex] ?? HOME_ANNOUNCEMENTS[0];

  return (
    <div ref={outerRef} className="mb-5 w-full sm:mb-6">
      <section
        ref={cardRef}
        aria-label="What is new in DeepChat"
        className="dc-home-announcement px-4 py-3.5 sm:px-5 sm:py-4"
      >
        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div ref={slideContentRef} className="flex min-w-0 flex-1 items-start gap-3.5 sm:items-center">
            <div ref={iconTileRef} className="dc-home-announcement-icon dc-ann-stagger">
              {renderAnnouncementIcon(current.icon)}
            </div>
            <div className="dc-ann-stagger min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="dc-home-announcement-badge">
                  <span
                    className="dc-home-accent-dot h-1.5 w-1.5 rounded-full"
                    aria-hidden="true"
                  />
                  {current.badge}
                </span>
                <span className="text-[11px] font-medium text-[var(--dc-text-muted)]">
                  {current.tag}
                </span>
              </div>
              <h2 className="text-[13.5px] font-semibold leading-snug text-[var(--dc-text-strong)] sm:text-[14px]">
                {current.title}
              </h2>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-[var(--dc-text-muted)] sm:text-[12.5px]">
                {current.description}
              </p>
            </div>
          </div>

          <div className="dc-ann-stagger flex shrink-0 items-center justify-between gap-2 sm:justify-end">
            <div className="flex items-center gap-1 pr-1" role="tablist" aria-label="Announcement highlights">
              {HOME_ANNOUNCEMENTS.map((item, idx) => {
                const isActive = idx === slideIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Highlight ${idx + 1}: ${item.tag}`}
                    onClick={() => handleSelectSlide(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isActive
                        ? 'dc-home-accent-dot w-4'
                        : 'w-1.5 bg-[var(--dc-border-strong)] hover:bg-[var(--dc-text-muted)]'
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onAction(current.actionType)}
                className="group/cta dc-home-announcement-cta"
              >
                <span>{current.actionLabel}</span>
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform duration-200 group-hover/cta:translate-x-0.5"
                  strokeWidth={2.2}
                />
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                disabled={isClosing}
                className="dc-home-icon-ghost"
                aria-label="Dismiss announcement"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
