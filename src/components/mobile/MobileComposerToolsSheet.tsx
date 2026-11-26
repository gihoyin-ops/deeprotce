'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import {
  BookOpen,
  Globe,
  Image as ImageIcon,
  Paperclip,
  RectangleHorizontal,
  RectangleVertical,
  Scan,
  Square,
  X,
} from '@/components/ui/icons';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import { type ImageAspectRatio } from '@/lib/images/image-aspect-ratio';
import { useGuestStatus } from '@/lib/auth/guest';
import { prefersReducedMotion, triggerSubtleHaptic } from './gesture-utils';

interface ComposerFile {
  name: string;
  ext: string;
  previewUrl?: string;
  dataUrl?: string;
  content?: string;
  size?: number;
}

interface ComposerRecentFile extends ComposerFile {
  chatId: string;
  chatTitle: string;
  addedAt: string;
}

interface MobileComposerToolsSheetProps {
  isOpen: boolean;
  isUploading?: boolean;
  webSearchEnabled?: boolean;
  imageGenerationEnabled?: boolean;
  imageAspectRatio: ImageAspectRatio;
  recentFiles: ComposerRecentFile[];
  onUpload: () => void;
  onAttachRecentFile: (file: ComposerFile) => void;
  onToggleWebSearch?: (enabled: boolean) => void;
  onToggleImageGeneration?: (enabled: boolean) => void;
  onImageAspectRatioChange?: (aspectRatio: ImageAspectRatio) => void;
  onClose: () => void;
  getFileIcon: (ext: string, className: string) => React.ReactNode;
  getDisplayName: (name: string) => string;
}

const ASPECT_OPTIONS: Array<{
  value: ImageAspectRatio;
  label: string;
  hint?: string;
  icon: React.ReactNode;
}> = [
  { value: 'auto', label: 'Auto', icon: <Scan className="h-4 w-4" /> },
  { value: '1:1', label: 'Square', hint: '1:1', icon: <Square className="h-4 w-4" /> },
  { value: '3:4', label: 'Portrait', hint: '3:4', icon: <RectangleVertical className="h-4 w-4" /> },
  { value: '9:16', label: 'Story', hint: '9:16', icon: <RectangleVertical className="h-4 w-4" /> },
  { value: '4:3', label: 'Landscape', hint: '4:3', icon: <RectangleHorizontal className="h-4 w-4" /> },
  { value: '16:9', label: 'Wide', hint: '16:9', icon: <RectangleHorizontal className="h-4 w-4" /> },
];

export default function MobileComposerToolsSheet({
  isOpen,
  isUploading = false,
  webSearchEnabled = false,
  imageGenerationEnabled = false,
  imageAspectRatio,
  recentFiles,
  onUpload,
  onAttachRecentFile,
  onToggleWebSearch,
  onToggleImageGeneration,
  onImageAspectRatioChange,
  onClose,
  getFileIcon,
  getDisplayName,
}: MobileComposerToolsSheetProps) {
  const { isGuest } = useGuestStatus();
  const [closingPending, setClosingPending] = useState(false);

  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ratioRowRef = useRef<HTMLDivElement>(null);
  const isAnimatingOutRef = useRef(false);
  const dragRef = useRef<{
    startY: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    dragging: boolean;
  } | null>(null);

  const animateAndClose = useCallback(
    (fromY = 0) => {
      if (isAnimatingOutRef.current) return;
      isAnimatingOutRef.current = true;
      setClosingPending(true);

      const sheetEl = sheetRef.current;
      const backdropEl = backdropRef.current;

      if (prefersReducedMotion() || !sheetEl || !backdropEl) {
        isAnimatingOutRef.current = false;
        setClosingPending(false);
        onClose();
        return;
      }

      gsap.killTweensOf([sheetEl, backdropEl]);
      gsap.set(sheetEl, { y: fromY });

      const tl = gsap.timeline({
        onComplete: () => {
          isAnimatingOutRef.current = false;
          setClosingPending(false);
          onClose();
        },
      });

      tl.to(
        sheetEl,
        { y: '100%', duration: 0.24, ease: 'power3.in' },
        0
      ).to(
        backdropEl,
        { opacity: 0, duration: 0.22, ease: 'power2.in' },
        0
      );
    },
    [onClose]
  );

  // Pop the sheet up and stagger the cards in so it doesn't look like ass
  useEffect(() => {
    if (!isOpen) {
      isAnimatingOutRef.current = false;
      return;
    }

    const backdropEl = backdropRef.current;
    const sheetEl = sheetRef.current;
    const contentEl = contentRef.current;
    if (!backdropEl || !sheetEl) return;

    const ctx = gsap.context(() => {
      const reduce = prefersReducedMotion();
      gsap.fromTo(
        backdropEl,
        { opacity: 0 },
        { opacity: 1, duration: reduce ? 0.01 : 0.24, ease: 'power2.out' }
      );
      gsap.fromTo(
        sheetEl,
        { y: reduce ? 0 : '100%' },
        {
          y: 0,
          duration: reduce ? 0.01 : 0.36,
          ease: 'expo.out',
          clearProps: 'transform',
        }
      );

      if (!reduce && contentEl) {
        const cards = contentEl.querySelectorAll<HTMLElement>('.dc-mob-tool-card');
        if (cards.length > 0) {
          gsap.fromTo(
            cards,
            { opacity: 0, y: 10 },
            {
              opacity: 1,
              y: 0,
              duration: 0.26,
              delay: 0.06,
              stagger: 0.035,
              ease: 'expo.out',
              clearProps: 'transform',
            }
          );
        }
      }
    });

    return () => ctx.revert();
  }, [isOpen]);

  // Fade the aspect ratio row in when Image Generation gets flipped on
  useEffect(() => {
    const rowEl = ratioRowRef.current;
    if (!isOpen || !imageGenerationEnabled || !rowEl || prefersReducedMotion()) return;
    gsap.fromTo(
      rowEl,
      { opacity: 0, y: -4 },
      { opacity: 1, y: 0, duration: 0.24, ease: 'expo.out', clearProps: 'transform' }
    );
  }, [imageGenerationEnabled, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        animateAndClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [animateAndClose, isOpen]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1 || isAnimatingOutRef.current) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const now = performance.now();
    dragRef.current = {
      startY: e.touches[0].clientY,
      lastY: e.touches[0].clientY,
      lastTime: now,
      velocityY: 0,
      dragging: true,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const sheetEl = sheetRef.current;
    const backdropEl = backdropRef.current;
    if (!drag || !drag.dragging || !sheetEl || !backdropEl || e.touches.length !== 1) return;

    const currentY = e.touches[0].clientY;
    const now = performance.now();
    const dt = Math.max(1, now - drag.lastTime);
    drag.velocityY = (currentY - drag.lastY) / dt;
    drag.lastY = currentY;
    drag.lastTime = now;

    const dy = Math.max(0, currentY - drag.startY);
    const height = Math.max(sheetEl.offsetHeight, 280);
    gsap.set(sheetEl, { y: dy });
    gsap.set(backdropEl, { opacity: Math.max(0, 1 - dy / height) });
  };

  const handleTouchEnd = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    const sheetEl = sheetRef.current;
    const backdropEl = backdropRef.current;
    if (!drag || !drag.dragging || !sheetEl || !backdropEl) return;

    const dy = Math.max(0, drag.lastY - drag.startY);
    if (dy > 85 || drag.velocityY > 0.5) {
      triggerSubtleHaptic(6);
      animateAndClose(dy);
      return;
    }

    const reduce = prefersReducedMotion();
    gsap.to(sheetEl, {
      y: 0,
      duration: reduce ? 0.01 : 0.32,
      ease: 'expo.out',
      clearProps: 'transform',
    });
    gsap.to(backdropEl, {
      opacity: 1,
      duration: reduce ? 0.01 : 0.22,
      ease: 'power2.out',
    });
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex flex-col justify-end sm:hidden"
      data-mobile-overlay="true"
    >
      <div
        ref={backdropRef}
        onClick={() => animateAndClose()}
        className="dc-ms-backdrop dc-mob-scrim fixed inset-0"
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Composer tools"
        className="dc-tools-sheet relative z-10 max-h-[84svh] w-full select-none px-4 pb-[max(1.15rem,env(safe-area-inset-bottom))] pt-2.5"
      >
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="touch-none pb-3"
        >
          <div className="dc-ms-sheet-handle mx-auto mb-3 h-1 w-10 rounded-full opacity-75" />
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-[var(--dc-text-strong)]">
                Add & Tools
              </h2>
              <p className="mt-0.5 text-[12px] font-medium text-[var(--dc-text-muted)]">
                Attach context or enable capabilities
              </p>
            </div>
            <button
              type="button"
              onClick={() => animateAndClose()}
              aria-label="Close tools"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--dc-fill)] text-[var(--dc-text-strong)] transition-transform active:scale-90 hover:bg-[var(--dc-fill-hover)]"
            >
              <X className="h-4.5 w-4.5" strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <div
          ref={contentRef}
          className="custom-scrollbar max-h-[60svh] space-y-3 overflow-y-auto overscroll-contain pb-1"
        >
          {/* Upload button card */}
          <button
            type="button"
            disabled={isUploading || closingPending}
            onClick={() => {
              triggerSubtleHaptic(8);
              animateAndClose();
              window.setTimeout(onUpload, 100);
            }}
            className="dc-mob-tool-card dc-tools-glass-card flex min-h-[56px] w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-left transition-transform active:scale-[0.985] disabled:opacity-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--deepchat-accent-soft)] text-[var(--deepchat-accent)]">
              <Paperclip className="h-5 w-5" strokeWidth={2.1} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold text-[var(--dc-text-strong)]">
                Add photos &amp; files
              </span>
              <span className="mt-0.5 block text-[12px] font-medium text-[var(--dc-text-muted)]">
                Documents, images, or code from device
              </span>
            </span>
          </button>

          {/* Capability toggle switches grouped together */}
          <div className="dc-mob-tool-card dc-tools-glass-card overflow-hidden rounded-2xl divide-y divide-[var(--dc-border-subtle)]">
            <div className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400">
                  <Globe className="h-4.5 w-4.5" strokeWidth={2.1} />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[var(--dc-text-strong)]">
                    Web Search
                  </p>
                  <p className="text-[11.5px] font-medium text-[var(--dc-text-muted)]">
                    Ground answers with live sources
                  </p>
                </div>
              </div>
              <ToggleSwitch
                size="mobile"
                ariaLabel="Toggle web search"
                checked={webSearchEnabled}
                onChange={(checked) => {
                  triggerSubtleHaptic(8);
                  onToggleWebSearch?.(checked);
                }}
              />
            </div>

            {!isGuest && (
              <div className="px-4 py-2.5">
                <div className="flex min-h-[44px] items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
                      <ImageIcon className="h-4.5 w-4.5" strokeWidth={2.1} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[var(--dc-text-strong)]">
                        Create Image
                      </p>
                      <p className="text-[11.5px] font-medium text-[var(--dc-text-muted)]">
                        Generate artwork with custom ratio
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch
                    size="mobile"
                    ariaLabel="Toggle image generation"
                    checked={imageGenerationEnabled}
                    onChange={(checked) => {
                      triggerSubtleHaptic(8);
                      onToggleImageGeneration?.(checked);
                    }}
                  />
                </div>

                {imageGenerationEnabled && (
                  <div
                    ref={ratioRowRef}
                    data-gesture-ignore="true"
                    className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1"
                  >
                    {ASPECT_OPTIONS.map((option) => {
                      const active = imageAspectRatio === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={(e) => {
                            triggerSubtleHaptic(6);
                            if (!prefersReducedMotion()) {
                              gsap.fromTo(
                                e.currentTarget,
                                { scale: 0.94 },
                                { scale: 1, duration: 0.24, ease: 'back.out(2.2)', clearProps: 'transform' }
                              );
                            }
                            onImageAspectRatioChange?.(option.value);
                          }}
                          className={`inline-flex min-h-[38px] shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors ${
                            active
                              ? 'border-[var(--deepchat-accent)] bg-[var(--deepchat-accent-soft)] text-[var(--deepchat-accent)]'
                              : 'border-[var(--dc-border)] bg-[rgb(255_255_255/0.6)] text-[var(--dc-text-strong)] dark:bg-[rgb(255_255_255/0.05)]'
                          }`}
                        >
                          {option.icon}
                          <span>{option.hint || option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent files and library shortcut */}
          <div className="dc-mob-tool-card dc-tools-glass-card rounded-2xl p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]">
                Recent Files
              </span>
              <button
                type="button"
                onClick={() => {
                  animateAndClose();
                  window.dispatchEvent(new Event('openFileLibrary'));
                }}
                className="inline-flex min-h-[32px] items-center gap-1.5 text-[12px] font-semibold text-[var(--deepchat-accent)]"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Library</span>
              </button>
            </div>

            {recentFiles.length > 0 ? (
              <div className="space-y-1.5">
                {recentFiles.slice(0, 5).map((file) => (
                  <button
                    key={`${file.chatId}-${file.name}-${file.ext}`}
                    type="button"
                    onClick={() => {
                      triggerSubtleHaptic(8);
                      onAttachRecentFile({
                        name: file.name,
                        ext: file.ext,
                        previewUrl: file.previewUrl,
                        dataUrl: file.dataUrl,
                        content: file.content,
                        size: file.size,
                      });
                      animateAndClose();
                    }}
                    className="flex min-h-[46px] w-full items-center gap-3 rounded-xl bg-[rgb(255_255_255/0.62)] px-3 py-2 text-left ring-1 ring-[var(--dc-border-subtle)] transition-transform active:scale-[0.985] dark:bg-[rgb(255_255_255/0.05)]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--dc-fill)] text-[var(--dc-text-strong)]">
                      {getFileIcon(file.ext, 'h-4 w-4')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--dc-text-strong)]">
                        {getDisplayName(file.name)}
                      </span>
                      <span className="block truncate text-[11px] font-medium text-[var(--dc-text-muted)]">
                        {file.chatTitle || 'Recent chat'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-3 text-center text-[12.5px] font-medium text-[var(--dc-text-muted)]">
                No recent files yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
