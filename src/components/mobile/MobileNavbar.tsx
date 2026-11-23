'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { MoreHorizontal, Search, SquarePen } from '@/components/ui/icons';
import { UltraPrismBorderSvg } from '@/components/ui/ModelSelectorVisuals';
import { useSelectedModelState } from '@/lib/ai/model-selection';
import { getChatGenerationState, subscribeChatGeneration } from '@/lib/ai/chat-generation';
import { prefersReducedMotion, triggerSubtleHaptic } from './gesture-utils';
import type { MobileRightDrawerTab } from './types';

interface MobileNavbarProps {
  hasActiveChat: boolean;
  activeChatId?: string;
  chatTitle?: string;
  unreadNotifications: number;
  isLeftDrawerOpen: boolean;
  isRightDrawerOpen: boolean;
  isModelSheetOpen: boolean;
  onOpenLeftDrawer: () => void;
  onOpenRightDrawer: (tab?: MobileRightDrawerTab) => void;
  onOpenModelSheet: () => void;
  onNewChat: () => void;
}

export default function MobileNavbar({
  hasActiveChat,
  activeChatId,
  chatTitle,
  unreadNotifications,
  isLeftDrawerOpen,
  isRightDrawerOpen,
  isModelSheetOpen,
  onOpenLeftDrawer,
  onOpenRightDrawer,
  onOpenModelSheet,
  onNewChat,
}: MobileNavbarProps) {
  const { selectedModel, currentTier, isUltra } = useSelectedModelState();
  const [isStreaming, setIsStreaming] = useState(false);

  const barTopRef = useRef<SVGLineElement>(null);
  const barBottomRef = useRef<SVGLineElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);
  const modelPillRef = useRef<HTMLButtonElement>(null);
  const pullStateRef = useRef<{
    startX: number;
    startY: number;
    dy: number;
    tracking: boolean;
    committed: boolean;
  } | null>(null);

  // Sync streaming hairline state for active chat
  useEffect(() => {
    if (!hasActiveChat || !activeChatId || activeChatId === 'new') {
      const frame = window.requestAnimationFrame(() => setIsStreaming(false));
      return () => window.cancelAnimationFrame(frame);
    }

    const frame = window.requestAnimationFrame(() => {
      const current = getChatGenerationState(activeChatId);
      setIsStreaming(current?.isStreaming === true);
    });

    const unsubscribe = subscribeChatGeneration(activeChatId, (snapshot) => {
      setIsStreaming(snapshot.isStreaming === true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [hasActiveChat, activeChatId]);

  // Animate 2-bar menu glyph cleanly with GSAP when drawer opens/closes
  useEffect(() => {
    const topEl = barTopRef.current;
    const bottomEl = barBottomRef.current;
    if (!topEl || !bottomEl) return;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion()) {
        gsap.set(topEl, { attr: { x2: isLeftDrawerOpen ? 16 : 20 }, y: isLeftDrawerOpen ? 3.5 : 0, rotate: isLeftDrawerOpen ? 36 : 0, transformOrigin: '50% 50%' });
        gsap.set(bottomEl, { attr: { x2: isLeftDrawerOpen ? 16 : 14 }, y: isLeftDrawerOpen ? -3.5 : 0, rotate: isLeftDrawerOpen ? -36 : 0, transformOrigin: '50% 50%' });
        return;
      }

      if (isLeftDrawerOpen) {
        gsap.to(topEl, {
          attr: { x2: 17 },
          y: 3.5,
          rotate: 42,
          transformOrigin: '50% 50%',
          duration: 0.28,
          ease: 'expo.out',
        });
        gsap.to(bottomEl, {
          attr: { x2: 17 },
          y: -3.5,
          rotate: -42,
          transformOrigin: '50% 50%',
          duration: 0.28,
          ease: 'expo.out',
        });
      } else {
        gsap.to(topEl, {
          attr: { x2: 20 },
          y: 0,
          rotate: 0,
          transformOrigin: '50% 50%',
          duration: 0.26,
          ease: 'power3.out',
        });
        gsap.to(bottomEl, {
          attr: { x2: 14 },
          y: 0,
          rotate: 0,
          transformOrigin: '50% 50%',
          duration: 0.26,
          ease: 'power3.out',
        });
      }
    });

    return () => ctx.revert();
  }, [isLeftDrawerOpen]);

  // Animate chevron rotation when model sheet opens/closes
  useEffect(() => {
    const chevronEl = chevronRef.current;
    if (!chevronEl) return;

    if (prefersReducedMotion()) {
      gsap.set(chevronEl, { rotate: isModelSheetOpen ? 180 : 0 });
      return;
    }

    gsap.to(chevronEl, {
      rotate: isModelSheetOpen ? 180 : 0,
      duration: 0.28,
      ease: 'power3.out',
    });
  }, [isModelSheetOpen]);

  const handleCapsuleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    pullStateRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      dy: 0,
      tracking: true,
      committed: false,
    };
  };

  const handleCapsuleTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    const state = pullStateRef.current;
    const pillEl = modelPillRef.current;
    if (!state || !state.tracking || !pillEl || e.touches.length !== 1) return;

    const t = e.touches[0];
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;

    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      state.tracking = false;
      gsap.set(pillEl, { y: 0 });
      return;
    }

    if (dy > 6 && dy > Math.abs(dx) * 1.4) {
      state.dy = dy;
      if (!prefersReducedMotion()) {
        const pullY = Math.min(dy * 0.25, 10);
        gsap.set(pillEl, { y: pullY });
      }
      if (dy > 28 && !state.committed) {
        state.committed = true;
        triggerSubtleHaptic(8);
      }
    }
  };

  const handleCapsuleTouchEnd = () => {
    const state = pullStateRef.current;
    pullStateRef.current = null;
    const pillEl = modelPillRef.current;

    if (pillEl) {
      gsap.to(pillEl, {
        y: 0,
        duration: prefersReducedMotion() ? 0.01 : 0.3,
        ease: 'back.out(2)',
        clearProps: 'transform',
      });
    }

    if (state?.committed) {
      onOpenModelSheet();
    }
  };

  const showChatSubtitle = Boolean(
    hasActiveChat && chatTitle && chatTitle.trim().length > 0 && chatTitle !== 'New Chat'
  );

  return (
    <header className="dc-mob-navbar pointer-events-none absolute top-0 left-0 right-0 z-20 sm:hidden">
      <div className="pointer-events-auto flex min-h-[56px] items-center justify-between gap-1 px-2">
        {/* Left: Menu Trigger (44x44 touch target) */}
        <div className="flex w-[88px] shrink-0 items-center justify-start">
          <button
            type="button"
            onClick={() => {
              triggerSubtleHaptic(6);
              onOpenLeftDrawer();
            }}
            aria-label="Open navigation menu"
            aria-expanded={isLeftDrawerOpen}
            aria-controls="mobile-sidebar-drawer"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--dc-text-strong)] transition-transform duration-150 active:scale-90 hover:bg-[var(--dc-fill)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--deepchat-accent)]"
          >
            <svg
              width="20"
              height="14"
              viewBox="0 0 22 14"
              fill="none"
              aria-hidden="true"
              className="overflow-visible"
            >
              <line
                ref={barTopRef}
                x1="2"
                y1="3.5"
                x2="20"
                y2="3.5"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
              />
              <line
                ref={barBottomRef}
                x1="2"
                y1="10.5"
                x2="14"
                y2="10.5"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Center: Unified Model Selector Capsule (stays in Navbar) */}
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <button
            ref={modelPillRef}
            type="button"
            onClick={() => {
              triggerSubtleHaptic(6);
              onOpenModelSheet();
            }}
            onTouchStart={handleCapsuleTouchStart}
            onTouchMove={handleCapsuleTouchMove}
            onTouchEnd={handleCapsuleTouchEnd}
            onTouchCancel={handleCapsuleTouchEnd}
            aria-haspopup="dialog"
            aria-expanded={isModelSheetOpen}
            aria-label={`Model: ${selectedModel.name}, ${currentTier.key}. Tap or pull down to change`}
            className={`relative flex min-h-[44px] max-w-full items-center justify-center rounded-full px-1 py-0.5 transition-transform duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--deepchat-accent)]`}
          >
            <span
              className={`relative flex min-h-[36px] max-w-[210px] flex-col items-center justify-center rounded-full px-3.5 transition-colors ${
                isUltra
                  ? 'dc-ms-trigger-ultra py-1'
                  : 'border border-[var(--dc-border)] bg-[var(--dc-surface-subtle)] py-1 hover:bg-[var(--dc-fill)]'
              }`}
            >
              <UltraPrismBorderSvg active={isUltra} />

              <span className="relative z-10 flex max-w-full items-center gap-1.5">
                <span className="truncate text-[13.5px] font-semibold tracking-tight text-[var(--dc-text-strong)]">
                  {selectedModel.name}
                </span>
                <span
                  className="h-1 w-1 shrink-0 rounded-full bg-[var(--dc-text-muted)] opacity-50"
                  aria-hidden="true"
                />
                <span
                  className={`shrink-0 text-[12px] leading-none ${
                    isUltra
                      ? 'dc-ms-ultra-text font-semibold'
                      : 'font-medium text-[var(--dc-text-muted)]'
                  }`}
                >
                  {currentTier.key}
                </span>
                <svg
                  ref={chevronRef}
                  className="ml-0.5 h-3 w-3 shrink-0 text-[var(--dc-text-muted)]"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 4.25 6 7.75l3.5-3.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>

              {showChatSubtitle && (
                <span className="relative z-10 mt-0.5 max-w-[168px] truncate text-[10.5px] font-medium leading-none text-[var(--dc-text-muted)]">
                  {chatTitle}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Right: Quick Action Zone (44x44 touch targets) */}
        <div className="flex w-[88px] shrink-0 items-center justify-end gap-0.5">
          {hasActiveChat && (
            <button
              type="button"
              onClick={() => {
                triggerSubtleHaptic(6);
                onNewChat();
              }}
              aria-label="New chat"
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--dc-text-strong)] transition-transform duration-150 active:scale-90 hover:bg-[var(--dc-fill)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--deepchat-accent)]"
            >
              <SquarePen className="h-[18px] w-[18px]" strokeWidth={2.1} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              triggerSubtleHaptic(6);
              onOpenRightDrawer(hasActiveChat ? 'chat' : 'search');
            }}
            aria-label={hasActiveChat ? 'Open chat utility hub' : 'Open search and inbox'}
            aria-expanded={isRightDrawerOpen}
            aria-controls="mobile-right-drawer"
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-[var(--dc-text-strong)] transition-transform duration-150 active:scale-90 hover:bg-[var(--dc-fill)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--deepchat-accent)]"
          >
            {hasActiveChat ? (
              <MoreHorizontal className="h-[20px] w-[20px]" strokeWidth={2.1} />
            ) : (
              <Search className="h-[18.5px] w-[18.5px]" strokeWidth={2.1} />
            )}
            {unreadNotifications > 0 && (
              <span
                className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[var(--deepchat-accent)] ring-2 ring-[var(--dc-canvas)]"
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </div>

      {isStreaming && (
        <div className="dc-mob-stream-bar" aria-hidden="true" />
      )}
    </header>
  );
}
