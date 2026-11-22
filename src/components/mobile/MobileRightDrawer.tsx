'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { gsap } from 'gsap';
import {
  Bell,
  Check,
  Download,
  Edit3,
  MessageSquare,
  Pin,
  Search,
  Share2,
  Trash2,
  X,
} from '@/components/ui/icons';
import { getChat, getChats } from '@/app/actions';
import { deepchatQueryKeys } from '@/lib/query-keys';
import type { StoredNotification } from '@/lib/settings/notification-settings';
import {
  prefersReducedMotion,
  shouldIgnoreHorizontalSwipe,
  triggerSubtleHaptic,
} from './gesture-utils';
import type { MobileDrawerHandle, MobileRightDrawerTab } from './types';

interface SearchableChatMessage {
  id?: string;
  role?: string;
  content?: string;
}

interface SearchableChat {
  id?: string;
  title?: string;
  pinned?: boolean;
  createdAt?: string;
  messages?: SearchableChatMessage[];
}

interface OutlineItem {
  id: string;
  index: number;
  preview: string;
}

interface MobileRightDrawerProps {
  isOpen: boolean;
  activeTab: MobileRightDrawerTab;
  onTabChange: (tab: MobileRightDrawerTab) => void;
  onOpenChange: (open: boolean) => void;
  mainContentRef: React.RefObject<HTMLDivElement | null>;
  hasActiveChat: boolean;
  activeChatId?: string;
  chatTitle: string;
  isPinned?: boolean;
  onRenameChat: (nextTitle: string) => Promise<boolean>;
  onTogglePinChat: () => Promise<void>;
  onShareChat: () => void;
  onDownloadChat: () => void;
  onDeleteChat: () => void;
  notifications: StoredNotification[];
  unreadNotifications: number;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onClearNotifications: () => void;
}

const MobileRightDrawer = forwardRef<MobileDrawerHandle, MobileRightDrawerProps>(
  function MobileRightDrawer(
    {
      isOpen,
      activeTab,
      onTabChange,
      onOpenChange,
      mainContentRef,
      hasActiveChat,
      activeChatId,
      chatTitle,
      isPinned = false,
      onRenameChat,
      onTogglePinChat,
      onShareChat,
      onDownloadChat,
      onDeleteChat,
      notifications,
      unreadNotifications,
      onMarkNotificationRead,
      onMarkAllNotificationsRead,
      onClearNotifications,
    },
    ref
  ) {
    const router = useRouter();
    const { data: allChats = [] } = useQuery({
      queryKey: deepchatQueryKeys.chats,
      queryFn: async () => getChats() as Promise<SearchableChat[]>,
      enabled: isOpen,
    });

    const [isVisibleLayer, setIsVisibleLayer] = useState(isOpen);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [draftTitle, setDraftTitle] = useState(chatTitle);
    const [deleteConfirmArmed, setDeleteConfirmArmed] = useState(false);
    const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([]);

    const rootRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLElement>(null);
    const tabGroupRef = useRef<HTMLDivElement>(null);
    const tabIndicatorRef = useRef<HTMLDivElement>(null);
    const tabContentRef = useRef<HTMLDivElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    const openStateRef = useRef(false);
    const isDraggingRef = useRef(false);
    const internalSwipeRef = useRef<{
      startX: number;
      startY: number;
      lastX: number;
      lastTime: number;
      velocityX: number;
      axis: 'none' | 'x' | 'y';
      panelWidth: number;
    } | null>(null);

    const tabs = useMemo<Array<{ id: MobileRightDrawerTab; label: string }>>(() => {
      if (hasActiveChat) {
        return [
          { id: 'chat', label: 'This Chat' },
          { id: 'search', label: 'Search' },
          { id: 'inbox', label: 'Inbox' },
        ];
      }
      return [
        { id: 'search', label: 'Search' },
        { id: 'inbox', label: 'Inbox' },
      ];
    }, [hasActiveChat]);

    const resolvedTab: MobileRightDrawerTab =
      !hasActiveChat && activeTab === 'chat' ? 'search' : activeTab;

    const getPanelWidth = useCallback(() => {
      if (panelRef.current && panelRef.current.offsetWidth > 0) {
        return panelRef.current.offsetWidth;
      }
      if (typeof window !== 'undefined') {
        return Math.min(window.innerWidth * 0.86, 356);
      }
      return 340;
    }, []);

    const setMainInert = useCallback(
      (inert: boolean) => {
        const el = mainContentRef.current as (HTMLDivElement & { inert?: boolean }) | null;
        if (!el) return;
        try {
          el.inert = inert;
        } catch {
          // ignore unsupported inert
        }
      },
      [mainContentRef]
    );

    const applyProgress = useCallback(
      (rawProgress: number) => {
        const p = Math.min(1, Math.max(0, rawProgress));
        const panelEl = panelRef.current;
        const backdropEl = backdropRef.current;
        const mainEl = mainContentRef.current;
        const width = getPanelWidth();

        if (!panelEl || !backdropEl) return;

        if (rootRef.current) {
          rootRef.current.style.pointerEvents = p > 0.01 ? 'auto' : 'none';
          rootRef.current.setAttribute('aria-hidden', p > 0.01 ? 'false' : 'true');
        }

        gsap.killTweensOf([panelEl, backdropEl, mainEl].filter(Boolean));
        gsap.set(panelEl, { x: (1 - p) * width });
        gsap.set(backdropEl, { opacity: p * 0.48 });

        if (mainEl && !prefersReducedMotion()) {
          gsap.set(mainEl, {
            x: -p * 18,
            scale: 1 - p * 0.025,
            borderRadius: p * 20,
            transformOrigin: 'center center',
          });
        }
      },
      [getPanelWidth, mainContentRef]
    );

    const snapOpen = useCallback(() => {
      const panelEl = panelRef.current;
      const backdropEl = backdropRef.current;
      const mainEl = mainContentRef.current;
      const reduce = prefersReducedMotion();

      openStateRef.current = true;
      setIsVisibleLayer(true);
      setMainInert(true);

      if (rootRef.current) {
        rootRef.current.style.pointerEvents = 'auto';
        rootRef.current.setAttribute('aria-hidden', 'false');
      }

      if (panelEl && backdropEl) {
        gsap.killTweensOf([panelEl, backdropEl, mainEl].filter(Boolean));
        gsap.to(panelEl, {
          x: 0,
          duration: reduce ? 0.01 : 0.34,
          ease: 'expo.out',
        });
        gsap.to(backdropEl, {
          opacity: 0.48,
          duration: reduce ? 0.01 : 0.28,
          ease: 'power2.out',
        });
        if (mainEl && !reduce) {
          gsap.to(mainEl, {
            x: -18,
            scale: 0.975,
            borderRadius: 20,
            duration: 0.34,
            ease: 'expo.out',
          });
        }
      }

      if (!isOpen) {
        onOpenChange(true);
      }
    }, [isOpen, mainContentRef, onOpenChange, setMainInert]);

    const snapClose = useCallback(() => {
      const panelEl = panelRef.current;
      const backdropEl = backdropRef.current;
      const mainEl = mainContentRef.current;
      const width = getPanelWidth();
      const reduce = prefersReducedMotion();

      openStateRef.current = false;
      setDeleteConfirmArmed(false);
      setIsRenaming(false);
      setMainInert(false);

      if (panelEl && backdropEl) {
        gsap.killTweensOf([panelEl, backdropEl, mainEl].filter(Boolean));
        const tl = gsap.timeline({
          onComplete: () => {
            setIsVisibleLayer(false);
            if (rootRef.current) {
              rootRef.current.style.pointerEvents = 'none';
              rootRef.current.setAttribute('aria-hidden', 'true');
            }
            if (mainEl) {
              gsap.set(mainEl, { clearProps: 'transform,borderRadius' });
            }
          },
        });

        tl.to(
          panelEl,
          {
            x: width,
            duration: reduce ? 0.01 : 0.25,
            ease: 'power3.in',
          },
          0
        ).to(
          backdropEl,
          {
            opacity: 0,
            duration: reduce ? 0.01 : 0.22,
            ease: 'power2.in',
          },
          0
        );

        if (mainEl) {
          tl.to(
            mainEl,
            {
              x: 0,
              scale: 1,
              borderRadius: 0,
              duration: reduce ? 0.01 : 0.25,
              ease: 'power3.inOut',
            },
            0
          );
        }
      } else {
        setIsVisibleLayer(false);
      }

      if (isOpen) {
        onOpenChange(false);
      }
    }, [getPanelWidth, isOpen, mainContentRef, onOpenChange, setMainInert]);

    useImperativeHandle(
      ref,
      () => ({
        setDragProgress: (progress: number) => {
          isDraggingRef.current = true;
          if (!isVisibleLayer) setIsVisibleLayer(true);
          applyProgress(progress);
        },
        snapOpen: () => {
          isDraggingRef.current = false;
          snapOpen();
        },
        snapClose: () => {
          isDraggingRef.current = false;
          snapClose();
        },
        isOpen: () => openStateRef.current,
      }),
      [applyProgress, isVisibleLayer, snapClose, snapOpen]
    );

    // Initialize offscreen transform on mount only; clean up mainContentRef only on unmount
    useEffect(() => {
      const panelEl = panelRef.current;
      const backdropEl = backdropRef.current;
      const mainEl = mainContentRef.current;
      if (panelEl) gsap.set(panelEl, { x: getPanelWidth() });
      if (backdropEl) gsap.set(backdropEl, { opacity: 0 });
      return () => {
        setMainInert(false);
        if (mainEl) {
          gsap.killTweensOf(mainEl);
          gsap.set(mainEl, { clearProps: 'transform,borderRadius' });
        }
      };
      // mount-only initialization and unmount cleanup
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync prop -> imperative transition
    useEffect(() => {
      if (isDraggingRef.current) return;
      if (isOpen && !openStateRef.current) {
        const frame = window.requestAnimationFrame(() => snapOpen());
        return () => window.cancelAnimationFrame(frame);
      }
      if (!isOpen && openStateRef.current) {
        const frame = window.requestAnimationFrame(() => snapClose());
        return () => window.cancelAnimationFrame(frame);
      }
    }, [isOpen, snapClose, snapOpen]);

    // Escape closes drawer
    useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          snapClose();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, snapClose]);

    // Sync draft title when chatTitle changes or rename starts
    useEffect(() => {
      if (!isRenaming) {
        const frame = window.requestAnimationFrame(() => setDraftTitle(chatTitle));
        return () => window.cancelAnimationFrame(frame);
      }
      renameInputRef.current?.focus();
    }, [chatTitle, isRenaming]);

    // Load active chat outline when drawer opens on 'chat' tab
    useEffect(() => {
      if (!isOpen || !hasActiveChat || !activeChatId || activeChatId === 'new') {
        const frame = window.requestAnimationFrame(() => setOutlineItems([]));
        return () => window.cancelAnimationFrame(frame);
      }

      let cancelled = false;
      void getChat(activeChatId).then((chat) => {
        if (cancelled) return;
        const storedMessages = ((chat as SearchableChat | null)?.messages || []).filter(
          (m) => m.role === 'user' && (m.content || '').trim().length > 0
        );
        if (storedMessages.length > 0) {
          setOutlineItems(
            storedMessages.map((m, idx) => ({
              id: m.id || String(idx),
              index: idx + 1,
              preview: (m.content || '').trim(),
            }))
          );
          return;
        }

        const domNodes = Array.from(document.querySelectorAll<HTMLElement>('.message-user'));
        setOutlineItems(
          domNodes.map((node, idx) => ({
            id: node.id.replace('msg-', ''),
            index: idx + 1,
            preview: (node.textContent || '').trim() || `Prompt ${idx + 1}`,
          }))
        );
      });

      return () => {
        cancelled = true;
      };
    }, [isOpen, hasActiveChat, activeChatId]);

    // Animate segmented pill indicator + subtle content entrance on tab switch
    useLayoutEffect(() => {
      const groupEl = tabGroupRef.current;
      const indicatorEl = tabIndicatorRef.current;
      if (!groupEl || !indicatorEl) return;

      const activeBtn = groupEl.querySelector<HTMLElement>(
        `[data-tab-id="${resolvedTab}"]`
      );
      if (!activeBtn) return;

      const reduce = prefersReducedMotion();
      gsap.to(indicatorEl, {
        x: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
        duration: reduce ? 0.01 : 0.28,
        ease: 'expo.out',
      });

      if (tabContentRef.current && !reduce) {
        gsap.fromTo(
          tabContentRef.current,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'transform' }
        );
      }
    }, [resolvedTab, isOpen, tabs.length]);

    const searchResults = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      const source = allChats.filter((c) => Boolean(c.id));
      if (!q) {
        return source.slice(0, 12).map((chat) => ({
          id: chat.id as string,
          title: chat.title || 'New Chat',
          snippet:
            chat.messages?.find((m) => (m.content || '').trim().length > 0)?.content?.trim() ||
            'Open conversation',
          createdAt: chat.createdAt,
        }));
      }

      const matched: Array<{
        id: string;
        title: string;
        snippet: string;
        createdAt?: string;
      }> = [];

      for (const chat of source) {
        const title = chat.title || 'New Chat';
        const titleHit = title.toLowerCase().includes(q);
        const msgHit = chat.messages?.find((m) =>
          (m.content || '').toLowerCase().includes(q)
        );
        if (!titleHit && !msgHit) continue;

        let snippet = 'Matched in title';
        if (msgHit?.content) {
          const raw = msgHit.content.trim();
          const idx = raw.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 28);
          snippet = (start > 0 ? '…' : '') + raw.slice(start, start + 96);
        }
        matched.push({
          id: chat.id as string,
          title,
          snippet,
          createdAt: chat.createdAt,
        });
      }

      return matched.slice(0, 20);
    }, [allChats, searchQuery]);

    const submitRename = async () => {
      const trimmed = draftTitle.trim();
      if (!trimmed) {
        setIsRenaming(false);
        setDraftTitle(chatTitle);
        return;
      }
      const ok = await onRenameChat(trimmed);
      if (ok) {
        triggerSubtleHaptic(8);
        setIsRenaming(false);
      }
    };

    // 1:1 swipe right anywhere inside the open right drawer or backdrop to dismiss
    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      if (!openStateRef.current || e.touches.length !== 1) return;
      if (shouldIgnoreHorizontalSwipe(e.target)) return;
      const t = e.touches[0];
      internalSwipeRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        lastX: t.clientX,
        lastTime: performance.now(),
        velocityX: 0,
        axis: 'none',
        panelWidth: getPanelWidth(),
      };
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
      const state = internalSwipeRef.current;
      if (!state || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - state.startX;
      const dy = t.clientY - state.startY;

      if (state.axis === 'none') {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dx) > Math.abs(dy) * 1.35 && dx > 0) {
          state.axis = 'x';
          isDraggingRef.current = true;
        } else {
          state.axis = 'y';
          return;
        }
      }

      if (state.axis !== 'x') return;

      const now = performance.now();
      const dt = Math.max(1, now - state.lastTime);
      state.velocityX = (t.clientX - state.lastX) / dt;
      state.lastX = t.clientX;
      state.lastTime = now;

      const progress = Math.min(1, Math.max(0, 1 - dx / state.panelWidth));
      applyProgress(progress);
    };

    const handleTouchEnd = () => {
      const state = internalSwipeRef.current;
      internalSwipeRef.current = null;
      if (!state || state.axis !== 'x') {
        isDraggingRef.current = false;
        return;
      }

      isDraggingRef.current = false;
      const dx = state.lastX - state.startX;
      const progress = Math.min(1, Math.max(0, 1 - dx / state.panelWidth));
      if (progress < 0.7 || state.velocityX > 0.4) {
        triggerSubtleHaptic(6);
        snapClose();
      } else {
        snapOpen();
      }
    };

    return (
      <div
        ref={rootRef}
        id="mobile-right-drawer"
        role="dialog"
        aria-modal={isOpen ? 'true' : undefined}
        aria-label="Utility hub"
        aria-hidden={!isVisibleLayer}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`fixed inset-0 z-50 flex justify-end sm:hidden ${
          isVisibleLayer ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div
          ref={backdropRef}
          onClick={() => snapClose()}
          className="dc-mob-scrim fixed inset-0 bg-slate-950/70 backdrop-blur-[2px]"
          aria-hidden="true"
        />

        <aside
          ref={panelRef}
          className="dc-mob-drawer relative z-10 flex h-[100svh] w-[min(86vw,356px)] flex-col border-l border-[var(--dc-border)] shadow-2xl will-change-transform"
        >
          {/* Segmented Pill Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--dc-border-subtle)] px-3.5 pb-3 pt-[max(0.85rem,env(safe-area-inset-top))]">
            <div
              ref={tabGroupRef}
              role="tablist"
              aria-label="Utility sections"
              className="relative flex min-w-0 flex-1 items-center rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-subtle)] p-1"
            >
              <div
                ref={tabIndicatorRef}
                aria-hidden="true"
                className="pointer-events-none absolute bottom-1 left-0 top-1 rounded-full bg-[var(--dc-surface)] shadow-sm ring-1 ring-[var(--dc-border)]"
              />
              {tabs.map((tab) => {
                const isSelected = resolvedTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    data-tab-id={tab.id}
                    aria-selected={isSelected}
                    onClick={() => {
                      triggerSubtleHaptic(5);
                      onTabChange(tab.id);
                    }}
                    className={`relative z-10 flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-full px-2 text-[12.5px] font-semibold transition-colors ${
                      isSelected
                        ? 'text-[var(--dc-text-strong)]'
                        : 'text-[var(--dc-text-muted)]'
                    }`}
                  >
                    <span className="truncate">{tab.label}</span>
                    {tab.id === 'inbox' && unreadNotifications > 0 && (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--deepchat-accent)] px-1 text-[10px] font-bold text-white">
                        {unreadNotifications}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => snapClose()}
              aria-label="Close utility hub"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--dc-text-strong)] transition-transform active:scale-90 hover:bg-[var(--dc-fill)]"
            >
              <X className="h-4.5 w-4.5" strokeWidth={2.2} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div
            ref={tabContentRef}
            className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
          >
            {resolvedTab === 'chat' && hasActiveChat && (
              <div className="space-y-5">
                {/* Inline Rename Card */}
                <div className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface-subtle)] p-3.5">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]">
                    Conversation
                  </p>
                  {isRenaming ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void submitRename();
                          if (e.key === 'Escape') {
                            setIsRenaming(false);
                            setDraftTitle(chatTitle);
                          }
                        }}
                        className="min-h-[40px] min-w-0 flex-1 rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 text-[14px] font-semibold text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
                      />
                      <button
                        type="button"
                        onClick={() => void submitRename()}
                        aria-label="Save chat title"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dc-invert)] text-[var(--dc-text-on-invert)] active:scale-95"
                      >
                        <Check className="h-4 w-4" strokeWidth={2.4} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsRenaming(true)}
                      className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl px-1 text-left transition-colors hover:bg-[var(--dc-fill)]"
                    >
                      <span className="truncate text-[15px] font-semibold text-[var(--dc-text-strong)]">
                        {chatTitle || 'New Chat'}
                      </span>
                      <Edit3 className="h-4 w-4 shrink-0 text-[var(--dc-text-muted)]" />
                    </button>
                  )}
                </div>

                {/* 2x2 Quick Action Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      snapClose();
                      onShareChat();
                    }}
                    className="flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface-subtle)] px-3.5 text-left text-[13.5px] font-semibold text-[var(--dc-text-strong)] transition-transform active:scale-95 hover:bg-[var(--dc-fill)]"
                  >
                    <Share2 className="h-4 w-4 shrink-0 text-indigo-500" />
                    <span>Share Link</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      snapClose();
                      onDownloadChat();
                    }}
                    className="flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface-subtle)] px-3.5 text-left text-[13.5px] font-semibold text-[var(--dc-text-strong)] transition-transform active:scale-95 hover:bg-[var(--dc-fill)]"
                  >
                    <Download className="h-4 w-4 shrink-0 text-sky-500" />
                    <span>Export JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerSubtleHaptic(8);
                      void onTogglePinChat();
                    }}
                    className="flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface-subtle)] px-3.5 text-left text-[13.5px] font-semibold text-[var(--dc-text-strong)] transition-transform active:scale-95 hover:bg-[var(--dc-fill)]"
                  >
                    <Pin
                      className={`h-4 w-4 shrink-0 ${
                        isPinned ? 'text-[var(--deepchat-accent)]' : 'text-[var(--dc-text-muted)]'
                      }`}
                    />
                    <span>{isPinned ? 'Unpin Chat' : 'Pin Chat'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!deleteConfirmArmed) {
                        triggerSubtleHaptic(10);
                        setDeleteConfirmArmed(true);
                        return;
                      }
                      snapClose();
                      onDeleteChat();
                    }}
                    className={`flex min-h-[52px] items-center gap-2.5 rounded-2xl border px-3.5 text-left text-[13.5px] font-semibold transition-all active:scale-95 ${
                      deleteConfirmArmed
                        ? 'border-red-500 bg-red-600 text-white'
                        : 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400'
                    }`}
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span>{deleteConfirmArmed ? 'Tap to delete' : 'Delete Chat'}</span>
                  </button>
                </div>

                {/* Conversation Outline / Jump List */}
                <div>
                  <div className="mb-2 flex items-center justify-between px-0.5">
                    <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]">
                      Prompt Outline
                    </span>
                    <span className="text-[11.5px] font-medium text-[var(--dc-text-muted)]">
                      {outlineItems.length} {outlineItems.length === 1 ? 'turn' : 'turns'}
                    </span>
                  </div>

                  {outlineItems.length > 0 ? (
                    <div className="space-y-2">
                      {outlineItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            triggerSubtleHaptic(6);
                            snapClose();
                            window.setTimeout(() => {
                              window.dispatchEvent(
                                new CustomEvent('deepchat:jump-to-message', {
                                  detail: { messageId: item.id },
                                })
                              );
                            }, 160);
                          }}
                          className="flex min-h-[46px] w-full items-start gap-2.5 rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-subtle)] p-3 text-left transition-colors active:scale-[0.99] hover:bg-[var(--dc-fill)]"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--dc-fill)] text-[11px] font-bold text-[var(--dc-text-muted)]">
                            {item.index}
                          </span>
                          <span className="line-clamp-2 min-w-0 flex-1 text-[13px] font-medium leading-snug text-[var(--dc-text-strong)]">
                            {item.preview}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[var(--dc-border)] px-4 py-6 text-center">
                      <MessageSquare className="mx-auto mb-2 h-6 w-6 text-[var(--dc-text-faint)]" />
                      <p className="text-[12.5px] font-medium text-[var(--dc-text-muted)]">
                        Prompts in this chat will appear here for quick jumping.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {resolvedTab === 'search' && (
              <div className="space-y-4">
                <div className="relative flex min-h-[44px] items-center rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface-subtle)] px-3">
                  <Search className="h-4 w-4 shrink-0 text-[var(--dc-text-muted)]" strokeWidth={2.1} />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search chats & messages..."
                    aria-label="Search chats and messages"
                    className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[14px] font-medium text-[var(--dc-text-strong)] outline-none placeholder:text-[var(--dc-text-placeholder)]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--dc-text-muted)] hover:bg-[var(--dc-fill)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          snapClose();
                          router.push(`/chat/${item.id}`);
                        }}
                        className="block w-full rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-subtle)] p-3.5 text-left transition-colors active:scale-[0.99] hover:bg-[var(--dc-fill)]"
                      >
                        <p className="truncate text-[14px] font-semibold text-[var(--dc-text-strong)]">
                          {item.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[var(--dc-text-muted)]">
                          {item.snippet}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <Search className="mx-auto mb-2.5 h-7 w-7 text-[var(--dc-text-faint)]" />
                    <p className="text-[13.5px] font-semibold text-[var(--dc-text-strong)]">
                      No matches found
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--dc-text-muted)]">
                      Try another keyword from a chat title or message.
                    </p>
                  </div>
                )}
              </div>
            )}

            {resolvedTab === 'inbox' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[12px] font-semibold text-[var(--dc-text-muted)]">
                    {unreadNotifications > 0 ? `${unreadNotifications} unread` : 'All caught up'}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onMarkAllNotificationsRead}
                      disabled={unreadNotifications === 0}
                      className="min-h-[32px] text-[12px] font-semibold text-[var(--deepchat-accent)] disabled:opacity-40"
                    >
                      Mark read
                    </button>
                    <button
                      type="button"
                      onClick={onClearNotifications}
                      disabled={notifications.length === 0}
                      className="min-h-[32px] text-[12px] font-semibold text-[var(--dc-text-muted)] disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {notifications.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--dc-border)] px-4 py-10 text-center">
                    <Bell className="mx-auto mb-2.5 h-7 w-7 text-[var(--dc-text-faint)]" />
                    <p className="text-[13.5px] font-semibold text-[var(--dc-text-strong)]">
                      No notifications
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--dc-text-muted)]">
                      Background updates and alerts appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => {
                          onMarkNotificationRead(notification.id);
                          snapClose();
                        }}
                        className="flex w-full items-start gap-3 rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-subtle)] p-3.5 text-left transition-colors active:scale-[0.99] hover:bg-[var(--dc-fill)]"
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            notification.unread
                              ? notification.severity === 'error'
                                ? 'bg-red-500'
                                : notification.severity === 'warning'
                                  ? 'bg-amber-500'
                                  : 'bg-[var(--deepchat-accent)]'
                              : 'bg-[var(--dc-border-strong)]'
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13.5px] font-semibold text-[var(--dc-text-strong)]">
                              {notification.title}
                            </span>
                            <span className="shrink-0 text-[11px] font-medium text-[var(--dc-text-muted)]">
                              {notification.time}
                            </span>
                          </span>
                          <span className="mt-1 block text-[12px] leading-relaxed text-[var(--dc-text-muted)]">
                            {notification.description}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    );
  }
);

export default MobileRightDrawer;
