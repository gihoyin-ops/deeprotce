'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bot, Search, Bell, Edit3, Folder, Download, Share2, MoreVertical,
  Settings,
  Trash2, FileText, User
} from '@/components/ui/icons';
import Sidebar from './Sidebar';
import MobileNavbar from './mobile/MobileNavbar';
import { useIsMobileViewport } from './mobile/useIsMobileViewport';
import {
  hasBlockingModalOpen,
  shouldIgnoreHorizontalSwipe,
  triggerSubtleHaptic
} from './mobile/gesture-utils';
import type { MobileDrawerHandle, MobileRightDrawerTab } from './mobile/types';
import { isShortcutEvent, ShortcutCombo, useShortcutLabels } from './shortcuts';
import type { SettingsTab } from './SettingsModal';
import toast, { Toaster } from 'react-hot-toast';
import { getChat, getSharedChat, deleteChat, shareChat, getUserProfile, updateChatTitle, togglePinChat } from '@/app/actions';
import { deepchatQueryKeys } from '@/lib/query-keys';
import { DEFAULT_GUEST_AVATAR } from '@/lib/avatar';
import { openAuthModal } from '@/lib/auth/auth-url';
import DesktopGlobalSearchModal from './ui/DesktopGlobalSearchModal';
import {
  addNotificationToInbox,
  clearNotificationInbox,
  loadNotificationInbox,
  markAllNotificationsRead as markInboxNotificationsRead,
  markNotificationRead as markInboxNotificationRead,
  subscribeNotificationInbox,
  type DeepChatNotificationDetail,
  type StoredNotification
} from '@/lib/settings/notification-settings';
import {
  applyGeneralSettings,
  loadGeneralSettings,
  subscribeGeneralSettings
} from '@/lib/settings/general-settings';
import {
  applyAppearanceSettings,
  loadAppearanceSettings,
  subscribeAppearanceSettings
} from '@/lib/settings/appearance-settings';
import { safeAvatarSource } from '@/lib/utils';
import { useGuestStatus } from '@/lib/auth/guest';

const SettingsModal = dynamic(() => import('./SettingsModal'), {
  ssr: false,
  loading: () => null
});

const MobileSidebarDrawer = dynamic(() => import('./mobile/MobileSidebarDrawer'), {
  ssr: false
});

const MobileRightDrawer = dynamic(() => import('./mobile/MobileRightDrawer'), {
  ssr: false
});

const MobileModelSheet = dynamic(() => import('./mobile/MobileModelSheet'), {
  ssr: false
});

interface ChatData {
  title?: string;
  isShared?: boolean;
  pinned?: boolean;
}

interface ChatUpdatedDetail {
  chatId?: string;
  title?: string;
}

interface UserProfile {
  name: string;
  avatar: string;
  plan?: string;
}

// Read-only localStorage helper, won't blow up during SSR
const loadStoredBoolean = (key: string, fallback: boolean) => {
  try {
    if (typeof window === 'undefined') return fallback;
    const saved = localStorage.getItem(key);
    return saved !== null ? saved === 'true' : fallback;
  } catch {
    return fallback;
  }
};

const detailFromEvent = (event: CustomEvent<DeepChatNotificationDetail>) => event.detail;
const settingsTabs: SettingsTab[] = ['account', 'usage', 'general', 'appearance', 'notifications', 'voice', 'personality', 'keyboard', 'archived', 'storage', 'data'];
const isSettingsTab = (value: unknown): value is SettingsTab => typeof value === 'string' && settingsTabs.includes(value as SettingsTab);

const THEME_TOAST_OPTIONS = {
  style: {
    background: 'var(--dc-panel)',
    color: 'var(--dc-text-strong)',
    border: '1px solid var(--dc-border)',
    borderRadius: '9999px',
    padding: '10px 16px',
    fontSize: '13.5px',
    fontWeight: 500,
    boxShadow: '0 12px 32px -8px rgba(0, 0, 0, 0.22)',
  },
  success: {
    iconTheme: { primary: '#10b981', secondary: 'var(--dc-panel)' },
  },
  error: {
    iconTheme: { primary: '#ef4444', secondary: 'var(--dc-panel)' },
  },
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isGuest } = useGuestStatus();
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasActiveChat = pathname.startsWith('/chat');
  const isSharedChat = pathname.startsWith('/chat/s/');
  const isChatPage = pathname === '/' || pathname.startsWith('/chat') || pathname.startsWith('/settings');
  const activeChatId = hasActiveChat && !isSharedChat ? pathname.split('/').pop() : undefined;
  const shortcuts = useShortcutLabels();
  const isMobileViewport = useIsMobileViewport();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationRefs = useRef<Array<HTMLDivElement | null>>([]);
  const profileMenuRefs = useRef<Array<HTMLDivElement | null>>([]);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const leftDrawerRef = useRef<MobileDrawerHandle>(null);
  const rightDrawerRef = useRef<MobileDrawerHandle>(null);
  const mobileGestureRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    velocityX: number;
    isEdgeLeft: boolean;
    isEdgeRight: boolean;
    axis: 'none' | 'x' | 'y';
    target: 'left' | 'right' | null;
    panelWidth: number;
    hapticFired: boolean;
  } | null>(null);

  const initialSidebarOpen = pathname.startsWith('/chat');
  const [isSidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  // Hydrate saved state after mount so SSR doesn't shit itself with a mismatch
  const sidebarPreferenceLoadedRef = useRef(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [rightDrawerTab, setRightDrawerTab] = useState<MobileRightDrawerTab>('search');
  const [mobileDrawersPrimed, setMobileDrawersPrimed] = useState(false);
  const [isModelSheetOpen, setModelSheetOpen] = useState(false);
  const [hasOpenedModelSheet, setHasOpenedModelSheet] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDesktopSearchOpen, setIsDesktopSearchOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('general');
  const [isNotificationOpen, setNotificationOpen] = useState(false);
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ name: 'Guest', avatar: DEFAULT_GUEST_AVATAR, plan: '' });
  const [notifications, setNotifications] = useState<StoredNotification[]>(() => loadNotificationInbox());

  const setSidebarState = useCallback((val: boolean) => {
    setSidebarOpen(val);
    try {
      localStorage.setItem('isSidebarOpen', val.toString());
    } catch {
      // Eat storage errors if localStorage is locked down or full
    }
  }, []);

  useEffect(() => {
    if (sidebarPreferenceLoadedRef.current) return;
    sidebarPreferenceLoadedRef.current = true;
    setSidebarOpen(loadStoredBoolean('isSidebarOpen', pathname.startsWith('/chat')));
    // Run this crap on initial mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateChat = useCallback(() => {
    localStorage.removeItem('deepchat-draft-new');
    window.dispatchEvent(new Event('deepchat:new-home-prompt'));
    router.push('/');
    setMobileMenuOpen(false);
    setRightDrawerOpen(false);
  }, [router]);

  const openMobileLeftDrawer = useCallback(() => {
    setMobileDrawersPrimed(true);
    setRightDrawerOpen(false);
    setMobileMenuOpen(true);
  }, []);

  const openMobileRightDrawer = useCallback(
    (tab?: MobileRightDrawerTab) => {
      setMobileDrawersPrimed(true);
      setMobileMenuOpen(false);
      setRightDrawerTab(tab || (hasActiveChat ? 'chat' : 'search'));
      setRightDrawerOpen(true);
    },
    [hasActiveChat]
  );

  const openMobileModelSheet = useCallback(() => {
    setHasOpenedModelSheet(true);
    setModelSheetOpen(true);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setIsDesktopSearchOpen(true);
  }, []);

  const handleOpenActions = useCallback(() => {
    toast('Action menu is available from the composer tools.');
  }, []);

  const loadProfile = useCallback(() => {
    getUserProfile().then((savedProfile) => {
      setProfile(savedProfile as UserProfile);
    });
  }, []);

  const openSettings = useCallback((tab: SettingsTab = 'general') => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  }, []);

  useEffect(() => {
    if (pathname === '/settings' || pathname.startsWith('/settings/')) {
      const rawTab = pathname.replace(/^\/settings\/?/, '').split('/')[0];
      const resolvedTab: SettingsTab = isSettingsTab(rawTab) ? rawTab : 'general';
      const frame = window.requestAnimationFrame(() => {
        setSettingsInitialTab(resolvedTab);
        setIsSettingsOpen(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [pathname]);

  useEffect(() => {
    const handleOpenSettings = (event: Event) => {
      const tab = event instanceof CustomEvent && isSettingsTab(event.detail?.tab) ? event.detail.tab : 'general';
      openSettings(tab);
    };
    window.addEventListener('openSettings', handleOpenSettings);
    return () => window.removeEventListener('openSettings', handleOpenSettings);
  }, [openSettings]);

  useEffect(() => {
    const handleOpenFileLibrary = () => {
      router.push('/library');
    };
    window.addEventListener('openFileLibrary', handleOpenFileLibrary);
    return () => window.removeEventListener('openFileLibrary', handleOpenFileLibrary);
  }, [router]);

  useEffect(() => {
    applyGeneralSettings(loadGeneralSettings());
    applyAppearanceSettings(loadAppearanceSettings());
    const unsubGeneral = subscribeGeneralSettings(applyGeneralSettings);
    const unsubAppearance = subscribeAppearanceSettings(applyAppearanceSettings);
    const handleSystemAppearanceChange = () => applyAppearanceSettings(loadAppearanceSettings());
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');
    darkQuery.addEventListener('change', handleSystemAppearanceChange);
    contrastQuery.addEventListener('change', handleSystemAppearanceChange);
    return () => {
      unsubGeneral();
      unsubAppearance();
      darkQuery.removeEventListener('change', handleSystemAppearanceChange);
      contrastQuery.removeEventListener('change', handleSystemAppearanceChange);
    };
  }, []);

  useEffect(() => {
    const playNotificationSound = () => {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
      window.setTimeout(() => void context.close(), 260);
    };

    window.addEventListener('deepchat:notification-sound', playNotificationSound);
    return () => window.removeEventListener('deepchat:notification-sound', playNotificationSound);
  }, []);

  useEffect(() => {
    const handleDeepChatNotification = (event: Event) => {
      const detail = event instanceof CustomEvent ? detailFromEvent(event) : null;
      if (!detail?.title || !detail.description) return;

      if (detail.delivery.inApp) {
        setNotifications(addNotificationToInbox(detail));
      }
      if (detail.delivery.sound) {
        window.dispatchEvent(new CustomEvent('deepchat:notification-sound', { detail }));
      }
    };

    window.addEventListener('deepchat:notification', handleDeepChatNotification);
    const unsubscribeInbox = subscribeNotificationInbox(setNotifications);
    return () => {
      window.removeEventListener('deepchat:notification', handleDeepChatNotification);
      unsubscribeInbox();
    };
  }, []);

  useEffect(() => {
    loadProfile();
    window.addEventListener('profileUpdated', loadProfile);
    return () => window.removeEventListener('profileUpdated', loadProfile);
  }, [loadProfile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideNotification = notificationRefs.current.some(node => node?.contains(target));
      const insideProfile = profileMenuRefs.current.some(node => node?.contains(target));

      if (!insideNotification) {
        setNotificationOpen(false);
      }
      if (!insideProfile) {
        setProfileMenuOpen(false);
      }
    };

    if (isNotificationOpen || isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationOpen, isProfileMenuOpen]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (isShortcutEvent(event, 'search')) {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (isShortcutEvent(event, 'newChat')) {
        event.preventDefault();
        void handleCreateChat();
      } else if (isShortcutEvent(event, 'openSettings')) {
        event.preventDefault();
        openSettings('general');
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [handleCreateChat, openSettings]);

  // Pre-warm mobile drawer chunks during idle time so the first swipe isn't laggy as shit
  useEffect(() => {
    if (!isMobileViewport || mobileDrawersPrimed) return;
    let cancelled = false;
    const warm = () => {
      if (!cancelled) setMobileDrawersPrimed(true);
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(warm, { timeout: 900 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }
    const timer = window.setTimeout(warm, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isMobileViewport, mobileDrawersPrimed]);

  // Hook up openModelSelector / closeModelSelector events on mobile screens only
  useEffect(() => {
    const handleOpenModelSelector = () => {
      if (!window.matchMedia('(max-width: 639px)').matches) return;
      openMobileModelSheet();
    };
    const handleCloseModelSelector = () => {
      if (!window.matchMedia('(max-width: 639px)').matches) return;
      setModelSheetOpen(false);
    };
    window.addEventListener('openModelSelector', handleOpenModelSelector);
    window.addEventListener('closeModelSelector', handleCloseModelSelector);
    return () => {
      window.removeEventListener('openModelSelector', handleOpenModelSelector);
      window.removeEventListener('closeModelSelector', handleCloseModelSelector);
    };
  }, [openMobileModelSheet]);

  // 1:1 finger-tracked horizontal swipe gesture handler for mobile (< 640px only)
  useEffect(() => {
    if (!isMobileViewport) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (window.innerWidth >= 640 || event.touches.length !== 1) return;
      if (
        isMobileMenuOpen ||
        isRightDrawerOpen ||
        isModelSheetOpen ||
        isSettingsOpen ||
        hasBlockingModalOpen() ||
        shouldIgnoreHorizontalSwipe(event.target)
      ) {
        mobileGestureRef.current = null;
        return;
      }

      const touch = event.touches[0];
      mobileGestureRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastTime: performance.now(),
        velocityX: 0,
        isEdgeLeft: touch.clientX <= 44,
        isEdgeRight: !isSharedChat && touch.clientX >= window.innerWidth - 44,
        axis: 'none',
        target: null,
        panelWidth: 320,
        hapticFired: false,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const drag = mobileGestureRef.current;
      if (!drag || window.innerWidth >= 640 || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const dx = touch.clientX - drag.startX;
      const dy = touch.clientY - drag.startY;

      if (drag.axis === 'none') {
        const minHorizontal =
          (dx > 0 && drag.isEdgeLeft) || (dx < 0 && drag.isEdgeRight) ? 10 : 14;

        if (Math.abs(dy) >= 10 && Math.abs(dy) >= Math.abs(dx)) {
          drag.axis = 'y';
          mobileGestureRef.current = null;
          return;
        }

        if (Math.abs(dx) >= minHorizontal && Math.abs(dx) > Math.abs(dy) * 1.35) {
          if (dx < 0 && !isChatPage) {
            mobileGestureRef.current = null;
            return;
          }
          drag.axis = 'x';
          drag.target = dx > 0 ? 'left' : 'right';
          drag.panelWidth =
            drag.target === 'left'
              ? Math.min(window.innerWidth * 0.84, 340)
              : Math.min(window.innerWidth * 0.86, 356);
          setMobileDrawersPrimed(true);
          if (drag.target === 'right') {
            setRightDrawerTab(hasActiveChat ? 'chat' : 'search');
          }
        } else {
          return;
        }
      }

      if (drag.axis !== 'x' || !drag.target) return;

      const now = performance.now();
      const dt = Math.max(1, now - drag.lastTime);
      drag.velocityX = (touch.clientX - drag.lastX) / dt;
      drag.lastX = touch.clientX;
      drag.lastTime = now;

      if (drag.target === 'left') {
        const progress = Math.min(1, Math.max(0, dx / drag.panelWidth));
        leftDrawerRef.current?.setDragProgress(progress);
        if (progress >= 0.32 && !drag.hapticFired) {
          drag.hapticFired = true;
          triggerSubtleHaptic(8);
        }
      } else {
        const progress = Math.min(1, Math.max(0, -dx / drag.panelWidth));
        rightDrawerRef.current?.setDragProgress(progress);
        if (progress >= 0.32 && !drag.hapticFired) {
          drag.hapticFired = true;
          triggerSubtleHaptic(8);
        }
      }
    };

    const handleTouchEnd = () => {
      const drag = mobileGestureRef.current;
      mobileGestureRef.current = null;
      if (!drag || drag.axis !== 'x' || !drag.target) return;

      const dx = drag.lastX - drag.startX;
      if (drag.target === 'left') {
        const progress = Math.min(1, Math.max(0, dx / drag.panelWidth));
        if (progress >= 0.32 || drag.velocityX >= 0.42) {
          leftDrawerRef.current?.snapOpen();
          setMobileMenuOpen(true);
        } else {
          leftDrawerRef.current?.snapClose();
          setMobileMenuOpen(false);
        }
      } else {
        const progress = Math.min(1, Math.max(0, -dx / drag.panelWidth));
        if (progress >= 0.32 || drag.velocityX <= -0.42) {
          rightDrawerRef.current?.snapOpen();
          setRightDrawerOpen(true);
        } else {
          rightDrawerRef.current?.snapClose();
          setRightDrawerOpen(false);
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [
    hasActiveChat,
    isChatPage,
    isMobileMenuOpen,
    isMobileViewport,
    isModelSheetOpen,
    isRightDrawerOpen,
    isSettingsOpen,
  ]);

  const [chatTitle, setChatTitle] = useState('');
  const [folderName, setFolderName] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [isActiveChatPinned, setIsActiveChatPinned] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const loadChat = (e?: Event) => {
      if (hasActiveChat) {
        const parts = pathname.split('/');
        const id = parts[parts.length - 1];
        const detail = e instanceof CustomEvent ? e.detail as ChatUpdatedDetail : undefined;

        if (detail?.chatId === id && detail?.title) {
          setChatTitle(detail.title);
          return;
        }

        if (isSharedChat && id) {
          getSharedChat(id).then(c => {
            if (c) {
              const chat = c as ChatData;
              setChatTitle(chat.title || 'Shared Chat');
              setIsShared(true);
              setIsActiveChatPinned(false);
            }
          });
        } else if (id && id !== 'new') {
          getChat(id).then(c => {
            if (c) {
              const chat = c as ChatData;
              setChatTitle(chat.title || 'New Chat');
              setIsShared(chat.isShared === true);
              setIsActiveChatPinned(chat.pinned === true);
            }
          });
        } else {
          setChatTitle('New Chat');
          setFolderName('');
          setIsShared(false);
          setIsActiveChatPinned(false);
        }
      }
    };
    loadChat();
    window.addEventListener('chatUpdated', loadChat);
    return () => window.removeEventListener('chatUpdated', loadChat);
  }, [pathname, hasActiveChat]);

  const handleRenameChat = useCallback(
    async (nextTitle: string): Promise<boolean> => {
      if (!activeChatId || activeChatId === 'new') return false;
      const updated = await updateChatTitle(activeChatId, nextTitle);
      if (!updated) {
        toast.error('Failed to rename chat');
        return false;
      }
      setChatTitle(nextTitle);
      window.dispatchEvent(
        new CustomEvent('chatUpdated', { detail: { chatId: activeChatId, title: nextTitle } })
      );
      void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.chats });
      toast.success('Chat renamed');
      return true;
    },
    [activeChatId, queryClient]
  );

  const handleTogglePinActiveChat = useCallback(async () => {
    if (!activeChatId || activeChatId === 'new') return;
    const updated = await togglePinChat(activeChatId);
    if (updated) {
      const nextPinned = Boolean((updated as ChatData).pinned);
      setIsActiveChatPinned(nextPinned);
      window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { chatId: activeChatId } }));
      void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.chats });
      toast.success(nextPinned ? 'Chat pinned' : 'Chat unpinned');
    } else {
      toast.error('Failed to update pin');
    }
  }, [activeChatId, queryClient]);

  const handleShareChat = async () => {
    setIsMenuOpen(false);
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];
    if (id && id !== 'new') {
      const shareId = await shareChat(id);
      if (shareId) {
        setIsShared(true);
        const url = `${window.location.origin}/chat/s/${shareId}`;
        navigator.clipboard.writeText(url);
        toast.success(
          <div>
            Chat shared! Link copied.<br />
            <a href={url} target="_blank" rel="noreferrer" className="text-indigo-400 underline mt-1 inline-block text-sm">Open Shared Chat</a>
          </div>,
          { duration: 5000 }
        );
      } else {
        toast.error('Failed to share chat.');
      }
    }
  };

  const handleDownloadChat = async () => {
    setIsMenuOpen(false);
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];
    if (id && id !== 'new') {
      const chatData = await getChat(id);
      if (chatData) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chatData, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `chat-${id}.json`);
        dlAnchorElem.click();
        toast.success('Chat downloaded successfully!');
      }
    }
  };

  const handleDeleteChat = async () => {
    setIsMenuOpen(false);
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];
    if (id && id !== 'new') {
      const success = await deleteChat(id);
      if (success) {
        toast.success('Chat deleted');
        router.push('/');
      } else {
        toast.error('Failed to delete chat');
      }
    }
  };

  const unreadNotifications = notifications.filter(notification => notification.unread).length;

  const openProfileSettings = () => {
    setProfileMenuOpen(false);
    openSettings('account');
  };

  const openGeneralSettings = () => {
    setProfileMenuOpen(false);
    openSettings('general');
  };

  const markNotificationRead = (id: string) => {
    const notification = notifications.find(item => item.id === id);
    const next = markInboxNotificationRead(id);
    setNotifications(next);
    if (notification?.href) {
      setNotificationOpen(false);
      router.push(notification.href);
    } else if (notification?.chatId) {
      setNotificationOpen(false);
      router.push(`/chat/${notification.chatId}`);
    }
  };

  const markAllNotificationsRead = () => {
    setNotifications(markInboxNotificationsRead());
  };

  const clearNotifications = () => {
    setNotifications(clearNotificationInbox());
  };

  const renderNotifications = () => (
    <div className="fixed left-4 right-4 top-16 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/30 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[340px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <p className="text-sm font-extrabold text-slate-800">Notifications</p>
          <p className="text-xs font-medium text-slate-400">{unreadNotifications > 0 ? `${unreadNotifications} unread` : 'All caught up'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={markAllNotificationsRead} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:text-slate-300" disabled={unreadNotifications === 0}>
            Mark all read
          </button>
          <button onClick={clearNotifications} className="text-xs font-bold text-slate-400 hover:text-red-500 disabled:text-slate-300" disabled={notifications.length === 0}>
            Clear
          </button>
        </div>
      </div>
      <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-2">
        {notifications.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Bell className="mx-auto mb-3 h-8 w-8 text-slate-200" />
            <p className="text-sm font-bold text-slate-700">No notifications</p>
            <p className="mt-1 text-xs font-medium text-slate-400">Background events will appear here.</p>
          </div>
        ) : notifications.map(notification => (
          <button
            key={notification.id}
            onClick={() => markNotificationRead(notification.id)}
            className="w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-50"
          >
            <div className="flex gap-3">
              <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.unread ? notification.severity === 'error' ? 'bg-red-500' : notification.severity === 'warning' ? 'bg-amber-500' : 'bg-indigo-500' : 'bg-slate-200'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-bold text-slate-800">{notification.title}</p>
                  <span className="shrink-0 text-[11px] font-semibold text-slate-400">{notification.time}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{notification.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderProfileMenu = () => (
    <div className="fixed left-4 right-4 top-16 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/30 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-72">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
        <Image src={safeAvatarSource(profile.avatar)} alt="User" width={44} height={44} unoptimized className="h-11 w-11 rounded-full border border-slate-200 bg-slate-100 object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-slate-800">{profile.name || 'Guest'}</p>
          <p className="truncate text-xs font-medium text-slate-400">{profile.plan || 'No Plan'}</p>
        </div>
      </div>
      <div className="p-2">
        {!isGuest && (
          <button onClick={openProfileSettings} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
            <User className="h-4 w-4 text-slate-400" />
            Edit Profile
          </button>
        )}
        <button onClick={openGeneralSettings} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
          <Settings className="h-4 w-4 text-slate-400" />
          Settings
        </button>
        <button onClick={() => { setProfileMenuOpen(false); toast('Docs are coming soon.'); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
          <FileText className="h-4 w-4 text-slate-400" />
          Docs
        </button>
        {isGuest && (
          <button onClick={() => { setProfileMenuOpen(false); openAuthModal(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
            <User className="h-4 w-4 text-slate-400" />
            Log in
          </button>
        )}
      </div>
    </div>
  );

  const isStandalonePage =
    pathname === '/naughty' ||
    pathname === '/pricing' ||
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/verify' ||
    pathname === '/get-started' ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/');

  if (isStandalonePage) {
    // Standalone guard page: kept outside the main app shell on purpose
    // so it looks like a real full screen instead of some jammed-in error bubble
    return (
      <div
        className="h-dvh w-full overflow-y-auto custom-scrollbar font-sans"
        style={{ background: 'var(--background)' }}
      >
        {children}
        <Toaster
          position="top-center"
          containerStyle={{ zIndex: 99999 }}
          toastOptions={THEME_TOAST_OPTIONS}
        />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--dc-canvas)] font-sans sm:flex-row">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setSidebarState}
        isMobileOpen={isMobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
        onOpenSettings={openSettings}
        onOpenSearch={handleOpenSearch}
        onOpenActions={handleOpenActions}
      />

      <div
        ref={mainContentRef}
        className={`relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden sm:transition-all sm:duration-500 sm:ease-[cubic-bezier(0.22,1,0.36,1)] ${hasActiveChat ? 'bg-[var(--dc-canvas)] shadow-none sm:m-0 sm:rounded-none sm:border-0' : 'bg-[var(--dc-canvas)] shadow-none sm:m-0 sm:rounded-none sm:border-0'}`}
      >
        <MobileNavbar
          isChatPage={isChatPage}
          hasActiveChat={hasActiveChat}
          isSharedChat={isSharedChat}
          activeChatId={activeChatId}
          chatTitle={chatTitle}
          unreadNotifications={unreadNotifications}
          isLeftDrawerOpen={isMobileMenuOpen}
          isRightDrawerOpen={isRightDrawerOpen}
          isModelSheetOpen={isModelSheetOpen}
          onOpenLeftDrawer={openMobileLeftDrawer}
          onOpenRightDrawer={openMobileRightDrawer}
          onOpenModelSheet={openMobileModelSheet}
          onNewChat={handleCreateChat}
        />

        {hasActiveChat && (
        <div className="hidden">
          <div className="flex min-w-0 items-center gap-4" />

          <div className="mx-6 max-w-2xl flex-1 xl:mx-12">
            <div className="relative group">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search chats, messages, files..."
                className="w-full bg-slate-50 border border-slate-200 rounded-full py-2.5 pl-12 pr-14 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner shadow-slate-100/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-black/20"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <ShortcutCombo keys={shortcuts.search} />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 xl:gap-5">
            <div className="flex items-center gap-3">
              <div
                className="relative"
                ref={(node) => {
                  notificationRefs.current[1] = node;
                }}
              >
                <button onClick={() => { setNotificationOpen(open => !open); setProfileMenuOpen(false); }} className="relative p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                  <Bell className="w-6 h-6" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-indigo-500 px-1 text-[10px] font-bold text-white shadow-sm">
                      {unreadNotifications}
                    </span>
                  )}
                </button>
                {isNotificationOpen && renderNotifications()}
              </div>
              <div
                className="relative"
                ref={(node) => {
                  profileMenuRefs.current[1] = node;
                }}
              >
                <button onClick={() => { setProfileMenuOpen(open => !open); setNotificationOpen(false); }} className="block rounded-full">
                  <Image src={safeAvatarSource(profile.avatar)} alt="User" width={40} height={40} unoptimized className="w-10 h-10 rounded-full border border-slate-200 cursor-pointer object-cover hover:ring-2 hover:ring-indigo-500/30 transition-all shadow-sm" />
                </button>
                {isProfileMenuOpen && renderProfileMenu()}
              </div>
            </div>
          </div>
        </div>
        )}

        {hasActiveChat ? (
          <div className="hidden">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              {folderName ? (
                <>
                  <Folder className="w-4 h-4 text-slate-400" />
                  <span className="font-medium hover:text-slate-700 cursor-pointer transition-colors">{folderName}</span>
                  <span className="text-slate-300">›</span>
                </>
              ) : null}
              <span className="font-semibold text-slate-800">{chatTitle || 'Loading...'}</span>
            </div>
            <div className="flex items-center gap-3">
              {isShared && (
                <div className="flex items-center text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-sm">
                  <Share2 className="w-3 h-3 mr-1.5 text-slate-400" /> Shared
                </div>
              )}
              <div className="relative">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-lg z-50 py-1 origin-top-right animate-in fade-in scale-in-95 duration-200">
                      <button onClick={handleShareChat} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors">
                        <Share2 className="w-4 h-4 text-slate-400" /> Share Link
                      </button>
                      <button onClick={handleDownloadChat} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors">
                        <Download className="w-4 h-4 text-slate-400" /> Download Chat
                      </button>
                      <button onClick={() => setIsMenuOpen(false)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors border-t border-slate-100 mt-1 pt-2">
                        <Edit3 className="w-4 h-4 text-slate-400" /> Rename
                      </button>
                      <button onClick={handleDeleteChat} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors mt-1 border-t border-slate-100 pt-2">
                        <Trash2 className="w-4 h-4 text-red-400" /> Delete Chat
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {children}

      </div>

      {isMobileViewport && (mobileDrawersPrimed || isMobileMenuOpen) && (
        <MobileSidebarDrawer
          ref={leftDrawerRef}
          isOpen={isMobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
          mainContentRef={mainContentRef}
          onNewChat={handleCreateChat}
          onOpenSettings={openSettings}
        />
      )}

      {isMobileViewport && isChatPage && (mobileDrawersPrimed || isRightDrawerOpen) && (
        <MobileRightDrawer
          ref={rightDrawerRef}
          isOpen={isRightDrawerOpen}
          activeTab={rightDrawerTab}
          onTabChange={setRightDrawerTab}
          onOpenChange={setRightDrawerOpen}
          mainContentRef={mainContentRef}
          hasActiveChat={hasActiveChat}
          activeChatId={activeChatId}
          chatTitle={chatTitle}
          isPinned={isActiveChatPinned}
          onRenameChat={handleRenameChat}
          onTogglePinChat={handleTogglePinActiveChat}
          onShareChat={() => void handleShareChat()}
          onDownloadChat={() => void handleDownloadChat()}
          onDeleteChat={() => void handleDeleteChat()}
          notifications={notifications}
          unreadNotifications={unreadNotifications}
          onMarkNotificationRead={markNotificationRead}
          onMarkAllNotificationsRead={markAllNotificationsRead}
          onClearNotifications={clearNotifications}
        />
      )}

      {isMobileViewport && (isModelSheetOpen || hasOpenedModelSheet) && (
        <MobileModelSheet
          isOpen={isModelSheetOpen}
          onClose={() => setModelSheetOpen(false)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => {
            setIsSettingsOpen(false);
            if (pathname === '/settings' || pathname.startsWith('/settings/')) {
              router.replace('/');
            }
          }}
          onBackToSidebar={openMobileLeftDrawer}
          initialTab={settingsInitialTab}
        />
      )}

      <DesktopGlobalSearchModal
        isOpen={isDesktopSearchOpen}
        onClose={() => setIsDesktopSearchOpen(false)}
      />

      <Toaster
        position="top-center"
        containerStyle={{ zIndex: 99999 }}
        toastOptions={THEME_TOAST_OPTIONS}
      />
    </div>
  );
}
