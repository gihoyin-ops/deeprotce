'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { gsap } from 'gsap';
import { ArrowRight, ImageIcon, Sparkles, X } from '@/components/ui/icons';
import { consumeProductAnnouncementImpression } from './storage';
import {
  type ProductAnnouncementActionType,
  type ProductAnnouncementData,
  type ProductAnnouncementGalleryItem,
} from './types';

interface ProductAnnouncementCardProps {
  announcement: ProductAnnouncementData;
  onAction: (action: ProductAnnouncementActionType) => void;
  onOpenStateChange?: (state: { checked: boolean; open: boolean }) => void;
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
  onOpenStateChange,
}: ProductAnnouncementCardProps) {
  const titleId = useId();
  const [visible, setVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const isClosingRef = useRef(false);
  const onOpenStateChangeRef = useRef(onOpenStateChange);

  useEffect(() => {
    onOpenStateChangeRef.current = onOpenStateChange;
  }, [onOpenStateChange]);

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
        onOpenStateChangeRef.current?.({ checked: true, open: true });
      } else {
        onOpenStateChangeRef.current?.({ checked: true, open: false });
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [announcement.id, announcement.storageVersion, announcement.maxViews]);

  const handleClose = useCallback((afterClose?: () => void) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);

    const backdropEl = backdropRef.current;
    const cardEl = cardRef.current;

    if (!backdropEl || !cardEl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(false);
      onOpenStateChangeRef.current?.({ checked: true, open: false });
      afterClose?.();
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        setVisible(false);
        onOpenStateChangeRef.current?.({ checked: true, open: false });
        afterClose?.();
      },
    });

    tl.to(
      cardEl,
      {
        opacity: 0,
        y: 12,
        scale: 0.95,
        duration: 0.22,
        ease: 'power2.in',
      },
      0
    ).to(
      backdropEl,
      {
        opacity: 0,
        duration: 0.24,
        ease: 'power2.in',
      },
      0
    );
  }, []);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, handleClose]);

  useEffect(() => {
    if (!visible) return;
    const backdropEl = backdropRef.current;
    const cardEl = cardRef.current;
    const galleryEl = galleryRef.current;
    if (!backdropEl || !cardEl) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(backdropEl, { opacity: 1 });
      gsap.set(cardEl, { opacity: 1, y: 0, scale: 1 });
      if (galleryEl) {
        const tiles = galleryEl.querySelectorAll<HTMLElement>('.dc-product-gallery-tile');
        gsap.set(tiles, { opacity: 1, y: 0, scale: 1 });
      }
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        backdropEl,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: 'power2.out' }
      );

      gsap.fromTo(
        cardEl,
        { opacity: 0, y: 20, scale: 0.94 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.52,
          ease: 'expo.out',
          clearProps: 'transform',
        }
      );

      if (galleryEl) {
        const tiles = galleryEl.querySelectorAll<HTMLElement>('.dc-product-gallery-tile');
        if (tiles.length > 0) {
          gsap.fromTo(
            tiles,
            { opacity: 0, scale: 0.9, y: 8 },
            {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: 0.42,
              delay: 0.08,
              stagger: { each: 0.03, from: 'center' },
              ease: 'expo.out',
              clearProps: 'transform',
            }
          );
        }
      }
    });

    return () => {
      mm.revert();
    };
  }, [visible]);

  if (!visible || typeof document === 'undefined') return null;

  const columns = groupGalleryColumns(announcement.gallery);

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      <div
        ref={backdropRef}
        className="dc-product-modal-backdrop fixed inset-0"
        onClick={() => handleClose()}
        aria-hidden="true"
      />

      <section
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="dc-product-announce-card relative z-10 my-auto w-full max-w-[42rem]"
      >
        <button
          type="button"
          onClick={() => handleClose()}
          disabled={isClosing}
          aria-label="Close announcement"
          className="dc-product-announce-close"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.3} />
        </button>

        <div className="dc-product-gallery-stage pointer-events-none select-none p-2.5 sm:p-3.5">
          <div
            ref={galleryRef}
            className="grid h-[196px] grid-cols-5 gap-1.5 sm:h-[276px] sm:gap-2.5"
          >
            {columns.map(([topItem, bottomItem], colIndex) => {
              const [topWeight, bottomWeight] = COLUMN_WEIGHTS[colIndex % COLUMN_WEIGHTS.length];
              const rows: Array<{ item: ProductAnnouncementGalleryItem; weight: number }> = [
                { item: topItem, weight: topWeight },
              ];
              if (bottomItem) {
                rows.push({ item: bottomItem, weight: bottomWeight });
              }

              return (
                <div
                  key={`col-${topItem.id}`}
                  className="flex h-full min-w-0 flex-col gap-1.5 sm:gap-2.5"
                >
                  {rows.map(({ item, weight }) => {
                    const hasFailed = failedImages[item.id] === true;
                    return (
                      <div
                        key={item.id}
                        className="dc-product-gallery-tile relative w-full min-h-0 overflow-hidden"
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
                            sizes="(max-width: 640px) 20vw, 150px"
                            className="object-cover"
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
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-4 px-5 pb-5 pt-4 sm:flex-row sm:items-end sm:justify-between sm:gap-5 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="dc-product-announce-badge">
                <span className="dc-product-badge-dot" aria-hidden="true" />
                {announcement.badge}
              </span>
              <span className="text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                {announcement.eyebrow}
              </span>
            </div>

            <h2
              id={titleId}
              className="text-[18px] font-semibold leading-snug tracking-[-0.02em] text-[var(--dc-text-strong)] sm:text-[21px]"
            >
              {announcement.title}
            </h2>

            <p className="mt-1 max-w-[34rem] text-[13px] leading-relaxed text-[var(--dc-text-muted)] sm:text-[13.5px]">
              {announcement.description}
            </p>
          </div>

          <div className="flex shrink-0 items-center justify-end">
            <button
              type="button"
              disabled={isClosing}
              onClick={() => handleClose(() => onAction(announcement.actionType))}
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
    </div>,
    document.body
  );
}
