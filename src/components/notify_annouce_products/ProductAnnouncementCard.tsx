'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { gsap } from 'gsap';
import { ArrowRight, ImageIcon, Sparkles, X } from '@/components/ui/icons';
import {
  consumeProductAnnouncementImpression,
  dismissProductAnnouncement,
} from './storage';
import {
  type ProductAnnouncementActionType,
  type ProductAnnouncementData,
  type ProductAnnouncementGalleryItem,
  type ProductAnnouncementPromptSelection,
} from './types';

interface ProductAnnouncementCardProps {
  announcement: ProductAnnouncementData;
  onAction: (action: ProductAnnouncementActionType) => void;
  onSelectSamplePrompt?: (selection: ProductAnnouncementPromptSelection) => void;
}

const COLUMN_WEIGHTS: [number, number][] = [
  [56, 44],
  [42, 58],
  [58, 42],
  [44, 56],
  [54, 46],
];

function groupGalleryColumns(items: ProductAnnouncementGalleryItem[]) {
  const columns: [ProductAnnouncementGalleryItem, ProductAnnouncementGalleryItem | undefined][] = [];
  for (let i = 0; i < items.length && columns.length < 5; i += 2) {
    columns.push([items[i], items[i + 1]]);
  }
  return columns;
}

export default function ProductAnnouncementCard({
  announcement,
  onAction,
  onSelectSamplePrompt,
}: ProductAnnouncementCardProps) {
  const [visible, setVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const outerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      const shouldShow = consumeProductAnnouncementImpression(
        announcement.id,
        announcement.storageVersion,
        announcement.maxViews
      );
      if (shouldShow) {
        setVisible(true);
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [announcement.id, announcement.storageVersion, announcement.maxViews]);

  useEffect(() => {
    if (!visible) return;
    const outerEl = outerRef.current;
    const cardEl = cardRef.current;
    const galleryEl = galleryRef.current;
    if (!outerEl || !cardEl) return;

    const mm = gsap.matchMedia();
    const ambientTweens: gsap.core.Tween[] = [];

    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(outerEl, { opacity: 1, y: 0, scale: 1 });
      if (galleryEl) {
        const tiles = galleryEl.querySelectorAll<HTMLElement>('.dc-product-gallery-tile');
        gsap.set(tiles, { opacity: 1, y: 0, scale: 1 });
      }
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        outerEl,
        { opacity: 0, y: -16, scale: 0.985 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.62,
          delay: 0.05,
          ease: 'expo.out',
          clearProps: 'transform',
        }
      );

      if (galleryEl) {
        const tiles = galleryEl.querySelectorAll<HTMLElement>('.dc-product-gallery-tile');
        if (tiles.length > 0) {
          gsap.fromTo(
            tiles,
            { opacity: 0, scale: 0.88, y: 12 },
            {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: 0.52,
              delay: 0.12,
              stagger: { each: 0.038, from: 'center' },
              ease: 'expo.out',
              clearProps: 'transform',
            }
          );
        }

        const evenCols = galleryEl.querySelectorAll<HTMLElement>('.dc-gallery-col-even');
        const oddCols = galleryEl.querySelectorAll<HTMLElement>('.dc-gallery-col-odd');

        if (evenCols.length > 0) {
          ambientTweens.push(
            gsap.fromTo(
              evenCols,
              { y: -2.5 },
              {
                y: 2.5,
                duration: 5.5,
                ease: 'sine.inOut',
                repeat: -1,
                yoyo: true,
              }
            )
          );
        }
        if (oddCols.length > 0) {
          ambientTweens.push(
            gsap.fromTo(
              oddCols,
              { y: 2.5 },
              {
                y: -2.5,
                duration: 5.5,
                ease: 'sine.inOut',
                repeat: -1,
                yoyo: true,
              }
            )
          );
        }
      }
    });

    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!isFinePointer) {
      return () => {
        ambientTweens.forEach((tween) => tween.kill());
        mm.revert();
      };
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

    const handleCardEnter = (event: MouseEvent) => {
      const rect = cardEl.getBoundingClientRect();
      const relX = event.clientX - rect.left;
      const relY = event.clientY - rect.top;
      spot.x = relX;
      spot.y = relY;
      cardEl.style.setProperty('--spot-x', `${relX.toFixed(1)}px`);
      cardEl.style.setProperty('--spot-y', `${relY.toFixed(1)}px`);
      cardEl.style.setProperty('--spot-opacity', '1');
    };

    const handleCardMove = (event: MouseEvent) => {
      const rect = cardEl.getBoundingClientRect();
      xTo(event.clientX - rect.left);
      yTo(event.clientY - rect.top);
    };

    const handleCardLeave = () => {
      cardEl.style.setProperty('--spot-opacity', '0');
    };

    cardEl.addEventListener('mouseenter', handleCardEnter);
    cardEl.addEventListener('mousemove', handleCardMove);
    cardEl.addEventListener('mouseleave', handleCardLeave);

    const tileCleanups: (() => void)[] = [];
    if (galleryEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const tiles = Array.from(galleryEl.querySelectorAll<HTMLElement>('.dc-product-gallery-tile'));
      const evenCols = galleryEl.querySelectorAll<HTMLElement>('.dc-gallery-col-even');
      const oddCols = galleryEl.querySelectorAll<HTMLElement>('.dc-gallery-col-odd');

      const handleGalleryEnter = () => {
        ambientTweens.forEach((tween) => tween.pause());
        gsap.to([...Array.from(evenCols), ...Array.from(oddCols)], {
          y: 0,
          duration: 0.32,
          ease: 'power2.out',
        });
      };

      const handleGalleryLeave = () => {
        gsap.to(tiles, {
          scale: 1,
          y: 0,
          opacity: 1,
          zIndex: 1,
          duration: 0.28,
          ease: 'power3.out',
        });
        ambientTweens.forEach((tween) => tween.resume());
      };

      galleryEl.addEventListener('mouseenter', handleGalleryEnter);
      galleryEl.addEventListener('mouseleave', handleGalleryLeave);
      tileCleanups.push(() => {
        galleryEl.removeEventListener('mouseenter', handleGalleryEnter);
        galleryEl.removeEventListener('mouseleave', handleGalleryLeave);
      });

      tiles.forEach((tile) => {
        const onTileEnter = () => {
          const siblings = tiles.filter((item) => item !== tile);
          gsap.to(tile, {
            scale: 1.055,
            y: -3,
            opacity: 1,
            zIndex: 20,
            duration: 0.28,
            ease: 'back.out(1.8)',
          });
          if (siblings.length > 0) {
            gsap.to(siblings, {
              opacity: 0.7,
              scale: 0.985,
              zIndex: 1,
              duration: 0.24,
              ease: 'power2.out',
            });
          }
        };

        tile.addEventListener('mouseenter', onTileEnter);
        tileCleanups.push(() => {
          tile.removeEventListener('mouseenter', onTileEnter);
        });
      });
    }

    return () => {
      cardEl.removeEventListener('mouseenter', handleCardEnter);
      cardEl.removeEventListener('mousemove', handleCardMove);
      cardEl.removeEventListener('mouseleave', handleCardLeave);
      tileCleanups.forEach((cleanup) => cleanup());
      ambientTweens.forEach((tween) => tween.kill());
      gsap.killTweensOf(spot);
      mm.revert();
    };
  }, [visible]);

  const handleDismiss = () => {
    if (isClosing) return;
    setIsClosing(true);
    dismissProductAnnouncement(
      announcement.id,
      announcement.storageVersion,
      announcement.maxViews
    );

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
      y: -10,
      scale: 0.97,
      duration: 0.24,
      ease: 'power2.in',
    }).to(
      outerEl,
      {
        height: 0,
        marginBottom: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'power3.inOut',
      },
      '-=0.06'
    );
  };

  const handleTileSelect = (
    event: React.MouseEvent<HTMLButtonElement>,
    item: ProductAnnouncementGalleryItem
  ) => {
    const tileEl = event.currentTarget;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(
        tileEl,
        { scale: 0.95 },
        {
          scale: 1.02,
          duration: 0.24,
          ease: 'back.out(2.2)',
          clearProps: 'scale',
        }
      );
    }

    onSelectSamplePrompt?.({
      prompt: item.prompt,
      enableImageGeneration: announcement.actionType === 'enable-image',
      enableWebSearch: announcement.actionType === 'enable-web-search',
    });
  };

  if (!visible) return null;

  const columns = groupGalleryColumns(announcement.gallery);

  return (
    <div ref={outerRef} className="mb-6 w-full sm:mb-7">
      <section
        ref={cardRef}
        aria-label={announcement.title}
        className="dc-product-announce-card"
      >
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isClosing}
          aria-label="Dismiss announcement"
          className="dc-product-announce-close"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.3} />
        </button>

        <div className="dc-product-gallery-stage p-2.5 sm:p-3.5">
          <div
            ref={galleryRef}
            className="grid h-[176px] grid-cols-5 gap-1.5 sm:h-[246px] sm:gap-2.5"
          >
            {columns.map(([topItem, bottomItem], colIndex) => {
              const [topWeight, bottomWeight] = COLUMN_WEIGHTS[colIndex % COLUMN_WEIGHTS.length];
              const colClass = colIndex % 2 === 0 ? 'dc-gallery-col-even' : 'dc-gallery-col-odd';
              const rows: Array<{ item: ProductAnnouncementGalleryItem; weight: number }> = [
                { item: topItem, weight: topWeight },
              ];
              if (bottomItem) {
                rows.push({ item: bottomItem, weight: bottomWeight });
              }

              return (
                <div
                  key={`col-${topItem.id}`}
                  className={`flex h-full min-w-0 flex-col gap-1.5 sm:gap-2.5 ${colClass}`}
                >
                  {rows.map(({ item, weight }) => {
                    const hasFailed = failedImages[item.id] === true;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={(event) => handleTileSelect(event, item)}
                        title={`Try prompt: ${item.label}`}
                        aria-label={`Try prompt for ${item.label}`}
                        className="dc-product-gallery-tile group/tile relative w-full min-h-0 overflow-hidden text-left"
                        style={{
                          flex: `${weight} 1 0%`,
                          backgroundImage: item.fallbackGradient,
                        }}
                      >
                        {!hasFailed ? (
                          <Image
                            src={item.src}
                            alt={item.alt}
                            fill
                            unoptimized
                            sizes="(max-width: 640px) 20vw, 160px"
                            className="object-cover transition-transform duration-500 ease-out group-hover/tile:scale-105"
                            onError={() =>
                              setFailedImages((prev) =>
                                prev[item.id] ? prev : { ...prev, [item.id]: true }
                              )
                            }
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center opacity-50">
                            <ImageIcon className="h-5 w-5 text-slate-700" strokeWidth={1.7} />
                          </span>
                        )}

                        <span className="dc-product-tile-scrim" aria-hidden="true" />
                        <span className="dc-product-gallery-caption hidden sm:inline-flex">
                          <span className="truncate">{item.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-3.5 px-4 pb-4 pt-3.5 sm:flex-row sm:items-end sm:justify-between sm:gap-5 sm:px-6 sm:pb-5 sm:pt-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="dc-product-announce-badge">
                <span className="dc-product-badge-dot" aria-hidden="true" />
                {announcement.badge}
              </span>
              <span className="text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                {announcement.eyebrow}
              </span>
              <span className="dc-product-announce-chip">
                {announcement.gallery.length} previews
              </span>
            </div>

            <h2 className="text-[17px] font-semibold leading-snug tracking-[-0.02em] text-[var(--dc-text-strong)] sm:text-[20px]">
              {announcement.title}
            </h2>

            <p className="mt-1 max-w-[36rem] text-[12.5px] leading-relaxed text-[var(--dc-text-muted)] sm:text-[13.5px]">
              {announcement.description}
            </p>

            {announcement.highlights.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {announcement.highlights.map((highlight) => (
                  <span key={highlight} className="dc-product-announce-chip">
                    {highlight}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end">
            <button
              type="button"
              onClick={() => onAction(announcement.actionType)}
              className="group/cta dc-product-announce-cta"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2.1} />
              <span>{announcement.ctaLabel}</span>
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover/cta:translate-x-0.5"
                strokeWidth={2.2}
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
