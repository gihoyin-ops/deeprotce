'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
import {
  Archive,
  ChevronDown,
  Folder,
  Image as ImageIcon,
  Library,
  MoreHorizontal,
  Pin,
  Search,
  Settings,
  SquarePen,
  Trash2,
  X,
} from '@/components/ui/icons';
import {
  archiveChat,
  deleteChat,
  getChats,
  getUserProfile,
  togglePinChat,
} from '@/app/actions';
import { deepchatQueryKeys } from '@/lib/query-keys';
import { DEFAULT_GUEST_AVATAR } from '@/lib/avatar';
import { getCachedUserProfileSync } from '@/lib/storage/client-storage';
import { safeAvatarSource } from '@/lib/utils';
import { useGuestStatus } from '@/lib/auth/guest';
import { loadComposerToolState, saveComposerToolState } from '@/lib/agent/composer-tool-state';
import type { SettingsTab } from '@/components/SettingsModal';
import {
  prefersReducedMotion,
  shouldIgnoreHorizontalSwipe,
  triggerSubtleHaptic,
} from './gesture-utils';
import type { MobileDrawerHandle } from './types';

interface ChatItem {
  id: string;
  title: string;
  pinned?: boolean;
}

interface UserProfileData {
  name: string;
  avatar: string;
  plan?: string;
}

interface MobileSidebarDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mainContentRef: React.RefObject<HTMLDivElement | null>;
  onNewChat: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
}

const INITIAL_RECENT_LIMIT = 15;
const RECENT_PAGE_SIZE = 15;

const MobileSidebarDrawer = forwardRef<MobileDrawerHandle, MobileSidebarDrawerProps>(
  function MobileSidebarDrawer(
    { isOpen, onOpenChange, mainContentRef, onNewChat, onOpenSettings },
    ref
  ) {
    const router = useRouter();
    const pathname = usePathname();
    const queryClient = useQueryClient();
    const { isGuest } = useGuestStatus();

    const { data: chats = [] } = useQuery({
      queryKey: deepchatQueryKeys.chats,
      queryFn: async () => getChats() as Promise<ChatItem[]>,
    });

    const {
      data: profile = {
        name: 'Guest',
        avatar: DEFAULT_GUEST_AVATAR,
        plan: '',
      },
    } = useQuery({
      queryKey: deepchatQueryKeys.profile,
      queryFn: async () => getUserProfile() as Promise<UserProfileData>,
      initialData: () => getCachedUserProfileSync() ?? undefined,
    });

    const [filterQuery, setFilterQuery] = useState('');
    const [recentLimit, setRecentLimit] = useState(INITIAL_RECENT_LIMIT);
    const [isPinnedOpen, setIsPinnedOpen] = useState(true);
    const [isProjectsOpen, setIsProjectsOpen] = useState(true);
    const [isRecentOpen, setIsRecentOpen] = useState(true);
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [isVisibleLayer, setIsVisibleLayer] = useState(isOpen);

    const rootRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLElement>(null);
    const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
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

    const getPanelWidth = useCallback(() => {
      if (panelRef.current && panelRef.current.offsetWidth > 0) {
        return panelRef.current.offsetWidth;
      }
      if (typeof window !== 'undefined') {
        return Math.min(window.innerWidth * 0.84, 340);
      }
      return 320;
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
        gsap.set(panelEl, { x: -(1 - p) * width });
        gsap.set(backdropEl, { opacity: p * 0.48 });

        if (mainEl && !prefersReducedMotion()) {
          gsap.set(mainEl, {
            x: p * 20,
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
            x: 20,
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
      setExpandedRowId(null);
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
            x: -width,
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
      if (panelEl) gsap.set(panelEl, { x: -getPanelWidth() });
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

    // Sync prop -> imperative transition when changed externally
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

    // Escape key closes drawer
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

    const normalizedQuery = filterQuery.trim().toLowerCase();

    const filteredPinned = useMemo(() => {
      const list = chats.filter((c) => c.pinned);
      if (!normalizedQuery) return list;
      return list.filter((c) => c.title.toLowerCase().includes(normalizedQuery));
    }, [chats, normalizedQuery]);

    const filteredRecent = useMemo(() => {
      const list = chats.filter((c) => !c.pinned);
      if (!normalizedQuery) return list;
      return list.filter((c) => c.title.toLowerCase().includes(normalizedQuery));
    }, [chats, normalizedQuery]);

    const visibleRecent = useMemo(
      () => filteredRecent.slice(0, recentLimit),
      [filteredRecent, recentLimit]
    );
    const hasMoreRecent = visibleRecent.length < filteredRecent.length;

    // Progressive IntersectionObserver pagination as user scrolls down history
    useEffect(() => {
      const sentinel = loadMoreSentinelRef.current;
      if (!sentinel || !hasMoreRecent || !isOpen) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setRecentLimit((prev) => prev + RECENT_PAGE_SIZE);
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(sentinel);
      return () => observer.disconnect();
    }, [hasMoreRecent, isOpen, visibleRecent.length]);

    const handleAction = async (action: 'pin' | 'archive' | 'delete', id: string) => {
      try {
        triggerSubtleHaptic(8);
        setExpandedRowId(null);
        if (action === 'pin') {
          await togglePinChat(id);
          toast.success('Chat pin updated');
        } else if (action === 'archive') {
          await archiveChat(id);
          toast.success('Chat archived');
          if (pathname === `/chat/${id}`) router.push('/');
        } else {
          await deleteChat(id);
          toast.success('Chat deleted');
          if (pathname === `/chat/${id}`) router.push('/');
        }
        window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { chatId: id } }));
        void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.chats });
      } catch {
        toast.error(`Failed to ${action} chat`);
      }
    };

    const handleOpenImages = () => {
      const current = loadComposerToolState();
      saveComposerToolState({
        ...current,
        webSearchEnabled: false,
        imageGenerationEnabled: true,
      });
      window.dispatchEvent(new Event('deepchat:activate-image-tool'));
      snapClose();
      if (pathname !== '/') router.push('/');
    };

    const handleOpenLibrary = () => {
      snapClose();
      window.dispatchEvent(new Event('openFileLibrary'));
    };

    // 1:1 swipe left anywhere inside the open drawer or backdrop to dismiss
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
        if (Math.abs(dx) > Math.abs(dy) * 1.35 && dx < 0) {
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

      const progress = Math.min(1, Math.max(0, 1 + dx / state.panelWidth));
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
      const progress = Math.min(1, Math.max(0, 1 + dx / state.panelWidth));
      if (progress < 0.7 || state.velocityX < -0.4) {
        triggerSubtleHaptic(6);
        snapClose();
      } else {
        snapOpen();
      }
    };

    return (
      <div
        ref={rootRef}
        id="mobile-sidebar-drawer"
        role="dialog"
        aria-modal={isOpen ? 'true' : undefined}
        aria-label="Navigation drawer"
        aria-hidden={!isVisibleLayer}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`fixed inset-0 z-50 sm:hidden ${
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
          className="dc-mob-drawer relative z-10 flex h-[100svh] w-[min(84vw,340px)] flex-col border-r border-[var(--dc-sidebar-border)] shadow-2xl will-change-transform"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-3 pt-[max(0.85rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => {
                snapClose();
                router.push('/');
              }}
              className="flex min-h-[44px] items-center rounded-xl pr-2 text-left"
            >
              <span className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--dc-text-strong)]">
                DeepChat
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerSubtleHaptic(8);
                snapClose();
                onNewChat();
              }}
              className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-[var(--dc-invert)] px-3.5 text-[13px] font-semibold text-[var(--dc-text-on-invert)] shadow-sm transition-transform active:scale-95"
            >
              <SquarePen className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span>New</span>
            </button>
          </div>

          {/* Search Filter */}
          <div className="shrink-0 px-4 pb-3">
            <div className="relative flex min-h-[42px] items-center rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface-subtle)] px-3">
              <Search className="h-4 w-4 shrink-0 text-[var(--dc-text-muted)]" strokeWidth={2.1} />
              <input
                type="search"
                value={filterQuery}
                onChange={(e) => {
                  setFilterQuery(e.target.value);
                  setRecentLimit(INITIAL_RECENT_LIMIT);
                }}
                placeholder="Filter chats..."
                aria-label="Filter chats"
                className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[14px] font-medium text-[var(--dc-text-strong)] outline-none placeholder:text-[var(--dc-text-placeholder)]"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery('')}
                  aria-label="Clear filter"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--dc-text-muted)] hover:bg-[var(--dc-fill)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Compact Quick Actions Strip */}
          <div className="shrink-0 px-4 pb-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleOpenImages}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-subtle)] px-2 text-[12.5px] font-semibold text-[var(--dc-text-strong)] transition-transform active:scale-95 hover:bg-[var(--dc-fill)]"
              >
                <ImageIcon className="h-4 w-4 shrink-0 text-indigo-500" strokeWidth={2} />
                <span className="truncate leading-normal">Images</span>
              </button>
              <button
                type="button"
                onClick={handleOpenLibrary}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-subtle)] px-2 text-[12.5px] font-semibold text-[var(--dc-text-strong)] transition-transform active:scale-95 hover:bg-[var(--dc-fill)]"
              >
                <Library className="h-4 w-4 shrink-0 text-sky-500" strokeWidth={2} />
                <span className="truncate leading-normal">Library</span>
              </button>
            </div>
          </div>

          {/* Scrollable History Lists */}
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
            {/* Pinned Section */}
            {filteredPinned.length > 0 && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setIsPinnedOpen((prev) => !prev)}
                  className="flex min-h-[36px] w-full items-center justify-between px-2 text-left text-[12px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]"
                >
                  <span>Pinned</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      isPinnedOpen ? '' : '-rotate-90'
                    }`}
                  />
                </button>

                {isPinnedOpen && (
                  <div className="mt-1 space-y-1">
                    {filteredPinned.map((chat) => (
                      <DrawerChatRow
                        key={chat.id}
                        chat={chat}
                        active={pathname === `/chat/${chat.id}`}
                        expanded={expandedRowId === chat.id}
                        onToggleExpand={() =>
                          setExpandedRowId((cur) => (cur === chat.id ? null : chat.id))
                        }
                        onSelect={() => {
                          snapClose();
                          router.push(`/chat/${chat.id}`);
                        }}
                        onAction={handleAction}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Projects Section */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setIsProjectsOpen((prev) => !prev)}
                className="flex min-h-[36px] w-full items-center justify-between px-2 text-left text-[12px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]"
              >
                <span>Projects</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    isProjectsOpen ? '' : '-rotate-90'
                  }`}
                />
              </button>

              {isProjectsOpen && (
                <div className="mt-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => toast('Projects are coming soon.')}
                    className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13.5px] font-medium text-[var(--dc-text-body)] transition-colors hover:bg-[var(--dc-fill)] hover:text-[var(--dc-text-strong)]"
                  >
                    <Folder className="h-4 w-4 shrink-0 text-[var(--dc-text-muted)]" strokeWidth={2} />
                    <span className="truncate leading-normal">New project</span>
                  </button>
                </div>
              )}
            </div>

            {/* Recents Section */}
            <div>
              <button
                type="button"
                onClick={() => setIsRecentOpen((prev) => !prev)}
                className="flex min-h-[36px] w-full items-center justify-between px-2 text-left text-[12px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]"
              >
                <span>Recents</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    isRecentOpen ? '' : '-rotate-90'
                  }`}
                />
              </button>

              {isRecentOpen && (
                <div className="mt-1 space-y-1">
                  {visibleRecent.map((chat, idx) => (
                    <DrawerChatRow
                      key={chat.id}
                      chat={chat}
                      deferred={idx > 10}
                      active={pathname === `/chat/${chat.id}`}
                      expanded={expandedRowId === chat.id}
                      onToggleExpand={() =>
                        setExpandedRowId((cur) => (cur === chat.id ? null : chat.id))
                      }
                      onSelect={() => {
                        snapClose();
                        router.push(`/chat/${chat.id}`);
                      }}
                      onAction={handleAction}
                    />
                  ))}

                  {filteredRecent.length === 0 && (
                    <p className="px-2 py-3 text-[13px] font-medium text-[var(--dc-text-faint)]">
                      {normalizedQuery ? 'No matching chats' : 'No recent chats'}
                    </p>
                  )}

                  {hasMoreRecent && (
                    <div
                      ref={loadMoreSentinelRef}
                      className="py-2 text-center text-[11.5px] font-medium text-[var(--dc-text-muted)]"
                    >
                      Loading more...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Profile & Settings Footer */}
          <div className="shrink-0 border-t border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  snapClose();
                  if (isGuest) {
                    router.push('/login');
                  } else {
                    onOpenSettings('account');
                  }
                }}
                className="flex min-h-[48px] min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-2 py-1.5 text-left transition-colors active:scale-[0.99] hover:bg-[var(--dc-fill)]"
              >
                {!isGuest && (
                  <Image
                    src={safeAvatarSource(profile.avatar)}
                    alt={profile.name || 'User'}
                    width={36}
                    height={36}
                    unoptimized
                    className="h-9 w-9 shrink-0 rounded-full border border-[var(--dc-border)] object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold leading-tight text-[var(--dc-text-strong)]">
                    {isGuest ? 'Guest' : profile.name || 'Guest'}
                  </p>
                  {!isGuest && (
                    <p className="mt-0.5 truncate text-[11.5px] font-medium leading-tight text-[var(--dc-text-muted)]">
                      {profile.plan || 'Personal'}
                    </p>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  snapClose();
                  onOpenSettings('general');
                }}
                aria-label="Open settings"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-subtle)] text-[var(--dc-text-strong)] transition-transform active:scale-90 hover:bg-[var(--dc-fill)]"
              >
                <Settings className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            </div>
          </div>
        </aside>
      </div>
    );
  }
);

export default MobileSidebarDrawer;

interface DrawerChatRowProps {
  chat: ChatItem;
  active: boolean;
  expanded: boolean;
  deferred?: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onAction: (action: 'pin' | 'archive' | 'delete', id: string) => void;
}

function DrawerChatRow({
  chat,
  active,
  expanded,
  deferred = false,
  onToggleExpand,
  onSelect,
  onAction,
}: DrawerChatRowProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stripEl = stripRef.current;
    if (!expanded || !stripEl || prefersReducedMotion()) return;
    gsap.fromTo(
      stripEl,
      { opacity: 0, y: -4 },
      { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out', clearProps: 'transform' }
    );
  }, [expanded]);

  return (
    <div className={deferred ? 'dc-mob-row-deferred' : undefined}>
      <div
        className={`flex min-h-[46px] items-center gap-1 rounded-2xl pl-3 pr-1 transition-colors ${
          active
            ? 'bg-[var(--dc-fill)] text-[var(--dc-text-strong)]'
            : 'text-[var(--dc-text)] hover:bg-[var(--dc-surface-subtle)]'
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left"
        >
          {chat.pinned && (
            <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--deepchat-accent)]" strokeWidth={2.2} />
          )}
          <span
            className={`truncate text-[14px] ${
              active ? 'font-semibold' : 'font-medium'
            }`}
          >
            {chat.title || 'New Chat'}
          </span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          aria-label={`Actions for ${chat.title || 'chat'}`}
          aria-expanded={expanded}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-fill-hover)] hover:text-[var(--dc-text-strong)]"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={2.1} />
        </button>
      </div>

      {expanded && (
        <div
          ref={stripRef}
          className="mt-1 mb-1.5 grid grid-cols-3 gap-1.5 px-1"
        >
          <button
            type="button"
            onClick={() => onAction('pin', chat.id)}
            className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface-subtle)] text-[12px] font-semibold text-[var(--dc-text-strong)] active:scale-95"
          >
            <Pin className="h-3.5 w-3.5" />
            <span>{chat.pinned ? 'Unpin' : 'Pin'}</span>
          </button>
          <button
            type="button"
            onClick={() => onAction('archive', chat.id)}
            className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface-subtle)] text-[12px] font-semibold text-[var(--dc-text-strong)] active:scale-95"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Archive</span>
          </button>
          <button
            type="button"
            onClick={() => onAction('delete', chat.id)}
            className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-[12px] font-semibold text-red-600 active:scale-95 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
