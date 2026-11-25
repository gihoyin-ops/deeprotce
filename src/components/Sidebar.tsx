'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getChats, getUserProfile, togglePinChat, archiveChat, deleteChat, updateChatTitle, shareChat } from '@/app/actions';
import { DEFAULT_GUEST_AVATAR } from '@/lib/avatar';
import { getCachedUserProfileSync } from '@/lib/storage/client-storage';
import toast from 'react-hot-toast';
import {
  ChevronDown, ChevronRight, FileText, User, Brain,
  Settings, PanelLeft, SquarePen, Search, Ellipsis, Library, Image as ImageIcon, Folder, Plus, X, Check
} from '@/components/ui/icons';
import { useShortcutLabels } from './shortcuts';
import Tooltip from './ui/Tooltip';
import { AnimatedChatTitle } from './ui/AnimatedChatTitle';
import type { SettingsTab } from './SettingsModal';
import { IconMask } from './settings/mobile';
import { deepchatQueryKeys } from '@/lib/query-keys';
import { safeAvatarSource } from '@/lib/utils';
import { logoutAccountClient, useGuestStatus } from '@/lib/auth/guest';
import ContactSupportModal from './ui/ContactSupportModal';
import {
  AnimatedImagesSvg,
  AnimatedLibrarySvg,
  AnimatedNewChatSvg,
  AnimatedSearchSvg
} from './ui/SidebarAnimatedIcons';

type SidebarSettingsTab = Extract<SettingsTab, 'general' | 'account' | 'personality' | 'keyboard'>;

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  isMobileOpen: boolean;
  setMobileOpen: (val: boolean) => void;
  onOpenSettings: (tab?: SidebarSettingsTab) => void;
  onOpenSearch: () => void;
  onOpenActions: () => void;
}

interface UserProfileData {
  id?: string;
  name: string;
  username?: string;
  avatar: string;
  plan?: string;
}

interface ChatItem {
  id: string;
  title: string;
  pinned?: boolean;
}

const loadStoredBoolean = (key: string, fallback: boolean) => {
  if (typeof window === 'undefined') return fallback;
  const saved = localStorage.getItem(key);
  return saved !== null ? saved === 'true' : fallback;
};

export default function Sidebar({ isOpen, setIsOpen, setMobileOpen, onOpenSettings, onOpenSearch, onOpenActions }: SidebarProps) {
  const shortcuts = useShortcutLabels();
  const { isGuest, isAuthLoading } = useGuestStatus();
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [searchHovered, setSearchHovered] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [isPinnedOpen, setIsPinnedOpen] = useState(() => loadStoredBoolean('isPinnedOpen', true));
  const [isProjectsOpen, setIsProjectsOpen] = useState(() => loadStoredBoolean('isProjectsOpen', true));
  const [isRecentOpen, setIsRecentOpen] = useState(() => loadStoredBoolean('isRecentOpen', true));
  const [deleteTarget, setDeleteTarget] = useState<ChatItem | null>(null);
  const [deleteFilesToo, setDeleteFilesToo] = useState(true);
  const queryClient = useQueryClient();
  const { data: chats = [] } = useQuery({
    queryKey: deepchatQueryKeys.chats,
    queryFn: async () => getChats() as Promise<ChatItem[]>
  });
  const {
    data: profile = { name: 'Guest', avatar: DEFAULT_GUEST_AVATAR, plan: '' },
    isPending: isProfilePending
  } = useQuery({
    queryKey: deepchatQueryKeys.profile,
    queryFn: async () => getUserProfile() as Promise<UserProfileData>,
    initialData: () => getCachedUserProfileSync() ?? undefined,
    staleTime: 5 * 60 * 1000
  });

  const isStaffPlan = (profile.plan || '').trim().toLowerCase() === 'staff';
  const formatPlanLabel = (raw?: string) => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return 'Free';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  };
  const displayPlanLabel = formatPlanLabel(profile.plan);

  const togglePinned = () => {
    const val = !isPinnedOpen;
    setIsPinnedOpen(val);
    localStorage.setItem('isPinnedOpen', val.toString());
  };

  const toggleProjects = () => {
    const val = !isProjectsOpen;
    setIsProjectsOpen(val);
    localStorage.setItem('isProjectsOpen', val.toString());
  };

  const toggleRecent = () => {
    const val = !isRecentOpen;
    setIsRecentOpen(val);
    localStorage.setItem('isRecentOpen', val.toString());
  };
  
  const pathname = usePathname();
  const router = useRouter();

  const handleNewChat = () => {
    localStorage.removeItem('deepchat-draft-new');
    window.dispatchEvent(new Event('deepchat:new-home-prompt'));
    router.push('/');
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    setHelpMenuOpen(false);
    setMobileOpen(false);
    await logoutAccountClient(queryClient);
    toast.success('Signed out');
    router.push('/login');
    router.refresh();
  };

  const handleAction = async (action: string, id: string, value?: string) => {
    try {
      if (action === 'pin') {
        await togglePinChat(id);
        toast.success('Chat pin toggled');
      } else if (action === 'rename') {
        const trimmed = value?.trim();
        if (!trimmed) return;
        await updateChatTitle(id, trimmed);
        toast.success('Chat renamed');
      } else if (action === 'share') {
        const shareId = await shareChat(id);
        if (shareId) {
          const shareUrl = `${window.location.origin}/chat/s/${shareId}`;
          await navigator.clipboard.writeText(shareUrl);
          toast.success('Share link copied');
        } else {
          toast.error('Failed to share chat');
        }
      } else if (action === 'archive') {
        await archiveChat(id);
        toast.success('Chat archived');
        if (pathname === `/chat/${id}`) router.push('/');
      } else if (action === 'delete') {
        const target = chats.find((c) => c.id === id);
        if (target) {
          setDeleteFilesToo(true);
          setDeleteTarget(target);
        }
        return;
      }
      window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { chatId: id } }));
      void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.chats });
    } catch {
      toast.error(`Failed to ${action} chat`);
    }
  };

  const pinnedChats = chats.filter(c => c.pinned);
  const unpinnedChats = chats.filter(c => !c.pinned);
  const visibleRecent = showAllRecent ? unpinnedChats : unpinnedChats.slice(0, 4);

  const handleOpenSettings = (tab: SidebarSettingsTab = 'general') => {
    setProfileMenuOpen(false);
    setMobileOpen(false);
    onOpenSettings(tab);
  };

  const handleOpenSupport = () => {
    setHelpMenuOpen(false);
    setProfileMenuOpen(false);
    setMobileOpen(false);
    setSupportModalOpen(true);
  };

  const profileMenuRefs = useRef<Array<HTMLDivElement | null>>([]);
  const profilePopoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverCoords, setPopoverCoords] = useState<{ left: number; bottom: number; width: number } | null>(null);

  useEffect(() => {
    if (!profileMenuOpen || typeof window === 'undefined') {
      setHelpMenuOpen(false);
      return;
    }
    const updateCoords = () => {
      const anchor = profileMenuRefs.current.find(node => {
        if (!node) return false;
        const r = node.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPopoverCoords({
        left: Math.max(8, rect.left),
        bottom: Math.max(8, window.innerHeight - rect.top + 8),
        width: Math.max(248, rect.width)
      });
    };
    updateCoords();
    window.addEventListener('resize', updateCoords);
    return () => window.removeEventListener('resize', updateCoords);
  }, [profileMenuOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isInsideProfileMenu =
        profileMenuRefs.current.some(node => node?.contains(target)) ||
        Boolean(profilePopoverRef.current?.contains(target));
      if (!isInsideProfileMenu) {
        setProfileMenuOpen(false);
        setHelpMenuOpen(false);
      }
    }
    if (profileMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileMenuOpen]);

  const renderProfile = (variant: 'expanded' | 'mobile', refIndex: number) => {
    const isExpanded = variant === 'expanded';
    const avatarSrc = safeAvatarSource(profile.avatar);
    return (
    <div className="relative" ref={(node) => { profileMenuRefs.current[refIndex] = node; }}>
      {isExpanded ? (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[var(--dc-text)] transition-colors hover:bg-black/[0.06] active:scale-[0.99] dark:hover:bg-white/[0.08]"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            aria-expanded={profileMenuOpen}
            aria-label="Open profile menu"
          >
            {isAuthLoading ? (
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)]" />
            ) : !isGuest ? (
              isProfilePending ? (
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)]" />
              ) : (
                <Image
                  src={avatarSrc}
                  alt="User"
                  width={32}
                  height={32}
                  unoptimized
                  loading="lazy"
                  className="h-8 w-8 shrink-0 rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] object-cover"
                />
              )
            ) : null}
            <div className="min-w-0 flex-1">
              {isAuthLoading ? (
                <div className="h-4 w-20 animate-pulse rounded bg-[var(--dc-surface)]" />
              ) : (
                <>
                  <p className="truncate text-[14px] font-medium leading-tight text-[var(--dc-text-strong)]">
                    {isGuest ? 'Guest' : profile.name || 'Guest'}
                  </p>
                  {!isGuest && (
                    <p className="truncate text-xs font-normal leading-tight text-[var(--dc-text-muted)]">
                      {displayPlanLabel}
                    </p>
                  )}
                </>
              )}
            </div>
          </button>

          {!isGuest && !isStaffPlan && (
            <a
              href="/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 py-1 text-xs font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)]"
            >
              Upgrade
            </a>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl bg-slate-800/50 p-2 text-left transition-colors hover:bg-slate-800 active:scale-[0.99]"
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          aria-expanded={profileMenuOpen}
          aria-label="Open profile menu"
        >
          {!isGuest && (
            <Image
              src={avatarSrc}
              alt="User"
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 rounded-full border-2 border-slate-700 object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-white">{isGuest ? 'Guest' : profile.name || 'Guest'}</p>
            {!isGuest && <p className="truncate text-xs text-slate-400">{displayPlanLabel}</p>}
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} strokeWidth={1.75} />
        </button>
      )}
      
      {profileMenuOpen && popoverCoords && typeof document !== 'undefined' && createPortal(
        <div
          ref={profilePopoverRef}
          style={{
            position: 'fixed',
            left: popoverCoords.left,
            bottom: popoverCoords.bottom,
            width: popoverCoords.width,
            zIndex: 450
          }}
          className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-1.5 shadow-xl shadow-black/15 dark:shadow-black/60"
        >
          {!isGuest && (
            <>
              {/* Header user card */}
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setHelpMenuOpen(false);
                  router.push(profile.username ? `/u/${encodeURIComponent(profile.username)}` : '/profile');
                }}
                className="flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--dc-surface-hover)]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Image
                    src={avatarSrc}
                    alt="User"
                    width={32}
                    height={32}
                    unoptimized
                    className="h-8 w-8 shrink-0 rounded-full border border-[var(--dc-border)] object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-tight text-[var(--dc-text-strong)]">
                      {profile.name || 'Guest'}
                    </p>
                    <p className="truncate text-xs leading-tight text-[var(--dc-text-muted)]">
                      {displayPlanLabel}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--dc-text-muted)]" />
              </button>

              <div className="my-1 border-t border-[var(--dc-border-subtle)]" />

              {!isStaffPlan && (
                <a
                  href="/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setProfileMenuOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-[var(--dc-text)] transition-colors hover:bg-[var(--dc-surface-hover)]"
                >
                  <IconMask icon="/icons/upgrade-plan.svg" className="h-4 w-4 shrink-0" />
                  <span>Upgrade plan</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => handleOpenSettings('personality')}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-[var(--dc-text)] transition-colors hover:bg-[var(--dc-surface-hover)]"
              >
                <IconMask icon="/icons/personalization.svg" className="h-4 w-4 shrink-0" />
                <span>Personalization</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  router.push(profile.username ? `/u/${encodeURIComponent(profile.username)}` : '/profile');
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-[var(--dc-text)] transition-colors hover:bg-[var(--dc-surface-hover)]"
              >
                <IconMask icon="/icons/user.svg" className="h-4 w-4 shrink-0" />
                <span>Profile</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => handleOpenSettings('general')}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-[var(--dc-text)] transition-colors hover:bg-[var(--dc-surface-hover)]"
          >
            <IconMask icon="/icons/settings.svg" className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </button>

          <div className="my-1 border-t border-[var(--dc-border-subtle)]" />

          {/* Help with submenu */}
          <div
            className="relative"
            onMouseEnter={() => setHelpMenuOpen(true)}
            onMouseLeave={() => setHelpMenuOpen(false)}
          >
            <button
              type="button"
              onClick={() => setHelpMenuOpen(prev => !prev)}
              aria-expanded={helpMenuOpen}
              className="flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-[var(--dc-text)] transition-colors hover:bg-[var(--dc-surface-hover)]"
            >
              <span className="flex items-center gap-2.5">
                <IconMask icon="/icons/help-buoy.svg" className="h-4 w-4 shrink-0" />
                <span>Help</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--dc-text-muted)]" />
            </button>

            {helpMenuOpen && (
              <div className="absolute bottom-0 left-full z-50 ml-1.5 w-48 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-1.5 shadow-xl shadow-black/15 dark:shadow-black/50">
                <button
                  type="button"
                  onClick={handleOpenSupport}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--dc-text)] transition-colors hover:bg-[var(--dc-surface-hover)]"
                >
                  <IconMask icon="/icons/help-buoy.svg" className="h-4 w-4 shrink-0" />
                  <span>Contact support</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHelpMenuOpen(false);
                    handleOpenSettings('keyboard');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--dc-text)] transition-colors hover:bg-[var(--dc-surface-hover)]"
                >
                  <IconMask icon="/icons/keyboard.svg" className="h-4 w-4 shrink-0" />
                  <span>Keyboard shortcuts</span>
                </button>
              </div>
            )}
          </div>

          {/* Log in / Log out */}
          {isGuest ? (
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                setHelpMenuOpen(false);
                setMobileOpen(false);
                router.push('/login');
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-[var(--dc-text)] transition-colors hover:bg-[var(--dc-surface-hover)]"
            >
              <IconMask icon="/icons/arrow-right-to-line.svg" className="h-4 w-4 shrink-0" />
              <span>Log in</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-[var(--dc-text)] transition-colors hover:bg-red-500/10 hover:text-red-500"
            >
              <IconMask icon="/icons/log-out.svg" className="h-4 w-4 shrink-0" />
              <span>Log out</span>
            </button>
          )}
        </div>,
        document.body
      )}
      <ContactSupportModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
      />
    </div>
    );
  };

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className={`deepchat-rail-light group/rail relative hidden min-h-0 shrink-0 cursor-e-resize flex-col items-center border-r border-[var(--dc-sidebar-border)] bg-[var(--dc-sidebar)] py-3 text-[var(--dc-text)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:flex ${isOpen ? 'w-0 overflow-hidden opacity-0 pointer-events-none border-r-0' : 'w-[52px] opacity-100'}`}
      >
        <div className="mb-3 flex items-center justify-center">
          <Tooltip label="Open sidebar" side="right" align="center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(true);
              }}
              className="group/collapse-logo relative flex h-9 w-9 cursor-e-resize items-center justify-center rounded-xl text-[var(--dc-text-strong)] transition-all hover:bg-black/[0.05] group-hover/rail:bg-black/[0.05] group-has-[.rail-action:hover]/rail:bg-transparent active:scale-95 dark:hover:bg-white/[0.08] dark:group-hover/rail:bg-white/[0.08] dark:group-has-[.rail-action:hover]/rail:bg-transparent"
              aria-label="Open sidebar"
            >
              <Image
                src="/brands/brand.svg"
                alt="DeepChat"
                width={28}
                height={28}
                unoptimized
                className="h-7 w-7 transition-opacity group-hover/collapse-logo:opacity-0 group-hover/rail:opacity-0 group-has-[.rail-action:hover]/rail:opacity-100 dark:invert"
              />
              <PanelLeft className="absolute h-[19px] w-[19px] opacity-0 transition-opacity group-hover/collapse-logo:opacity-100 group-hover/rail:opacity-100 group-has-[.rail-action:hover]/rail:opacity-0" strokeWidth={1.9} />
            </button>
          </Tooltip>
        </div>

        <div className="flex flex-1 flex-col items-center">
          <div className="flex flex-col items-center gap-1.5">
            <CollapsedSidebarButton label="New Chat" shortcuts={[{ label: shortcuts.newChat.join('+'), tone: 'muted' }]} onClick={handleNewChat}>
              {(hovered) => <AnimatedNewChatSvg hovered={hovered} className="h-[19px] w-[19px]" />}
            </CollapsedSidebarButton>
            <CollapsedSidebarButton label="Search" shortcuts={[{ label: shortcuts.search.join('+'), tone: 'muted' }]} onClick={onOpenSearch}>
              {(hovered) => <AnimatedSearchSvg hovered={hovered} className="h-[19px] w-[19px]" />}
            </CollapsedSidebarButton>
            <CollapsedSidebarButton label="Action menu" onClick={onOpenActions}>
              <Ellipsis className="h-[19px] w-[19px]" strokeWidth={2} />
            </CollapsedSidebarButton>
          </div>

          <div className="mt-auto flex flex-col items-center gap-1.5 pb-1">
            <CollapsedSidebarButton label="Settings" onClick={() => handleOpenSettings()}>
              <Settings className="h-[19px] w-[19px]" strokeWidth={1.9} />
            </CollapsedSidebarButton>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isAuthLoading) return;
                if (isGuest) {
                  router.push('/login');
                } else {
                  router.push(profile.username ? `/u/${encodeURIComponent(profile.username)}` : '/profile');
                }
              }}
              className="rail-action flex h-9 min-w-[36px] items-center justify-center rounded-full px-1.5 transition-transform hover:scale-105 active:scale-95"
              aria-label={isGuest ? 'Guest — Sign in' : 'Profile'}
            >
              {isAuthLoading || (!isGuest && isProfilePending) ? (
                <div className="h-7 w-7 animate-pulse rounded-full bg-[var(--dc-surface)]" />
              ) : isGuest ? (
                <span className="text-[11px] font-medium text-[var(--dc-text-muted)]">Guest</span>
              ) : (
                <Image src={safeAvatarSource(profile.avatar)} alt="User" width={28} height={28} unoptimized loading="lazy" className="h-7 w-7 rounded-full object-cover" />
              )}
            </button>
          </div>
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          className="absolute -right-[3px] top-0 bottom-0 z-20 w-[6px] cursor-e-resize"
          aria-hidden="true"
        />
      </div>

      <div className={`deepchat-sidebar-light relative hidden min-h-0 origin-left overflow-hidden sm:flex flex-col border-r border-[var(--dc-sidebar-border)] bg-[var(--dc-surface)] dark:bg-[var(--dc-surface-input)] text-[var(--dc-text)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width,opacity,transform] ${isOpen ? 'w-[248px] xl:w-[250px] translate-x-0 opacity-100' : 'w-0 -translate-x-4 opacity-0 pointer-events-none border-r-0'}`}>
        <div className="flex h-14 shrink-0 items-center justify-between px-3">
          <button type="button" className="flex min-w-0 items-center px-1" onClick={() => router.push('/')} aria-label="DeepChat home">
            <span
              className="truncate text-[18px] font-semibold leading-none tracking-[-0.02em] text-[var(--dc-text-strong)]"
              style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
            >
              DeepChat
            </span>
          </button>
          <div className="flex items-center gap-0.5">
            <Tooltip label="Search" shortcuts={[{ label: shortcuts.search.join('+'), tone: 'muted' }]} side="bottom" align="center">
              <button
                type="button"
                onClick={onOpenSearch}
                onMouseEnter={() => setSearchHovered(true)}
                onMouseLeave={() => setSearchHovered(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--dc-text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--dc-text-strong)] active:scale-95 dark:hover:bg-white/[0.08]"
                aria-label="Search chats"
              >
                <AnimatedSearchSvg hovered={searchHovered} className="h-[18px] w-[18px]" />
              </button>
            </Tooltip>
            <Tooltip label="Close sidebar" side="bottom" align="end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 cursor-w-resize items-center justify-center rounded-xl text-[var(--dc-text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--dc-text-strong)] active:scale-95 dark:hover:bg-white/[0.08]"
                aria-label="Close sidebar"
              >
                <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="shrink-0 px-2.5 pb-3 pt-1">
          <div className="space-y-0.5">
            <ExpandedSidebarMenuItem label="New Chat" icon={(hovered) => <AnimatedNewChatSvg hovered={hovered} className="h-[17px] w-[17px]" />} onClick={handleNewChat} />
            <ExpandedSidebarMenuItem label="Library" icon={(hovered) => <AnimatedLibrarySvg hovered={hovered} className="h-[17px] w-[17px]" />} onClick={() => { setMobileOpen(false); router.push('/library'); }} />
            <ExpandedSidebarMenuItem label="Images" icon={(hovered) => <AnimatedImagesSvg hovered={hovered} className="h-[17px] w-[17px]" />} onClick={() => toast('Images are available from the composer image tool.')} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-4 custom-scrollbar">
          {pinnedChats.length > 0 && (
            <div className="mb-3">
              <button
                type="button"
                className="flex h-7 w-full items-center gap-1.5 px-2 text-left text-[12px] font-medium leading-none tracking-wide text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
                onClick={togglePinned}
              >
                <span>Pin chat</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isPinnedOpen ? '' : '-rotate-90'}`} strokeWidth={1.75} />
              </button>
              {isPinnedOpen && (
                <div className="space-y-0.5">
                  {pinnedChats.map((chat) => (
                    <ExpandedChatItem
                      key={chat.id}
                      chat={chat}
                      active={pathname === `/chat/${chat.id}`}
                      onAction={handleAction}
                      onClick={() => router.push(`/chat/${chat.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mb-3">
            <button
              type="button"
              className="flex h-7 w-full items-center gap-1.5 px-2 text-left text-[12px] font-medium leading-none tracking-wide text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
              onClick={toggleProjects}
            >
              <span>Projects</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isProjectsOpen ? '' : '-rotate-90'}`} strokeWidth={1.75} />
            </button>
            {isProjectsOpen && (
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toast('Projects are coming soon.')}
                  className="group flex h-9 w-full items-center gap-2.5 rounded-xl px-2 text-left text-[var(--dc-text-body)] transition-colors hover:bg-black/[0.045] hover:text-[var(--dc-text-strong)] dark:hover:bg-white/[0.06]"
                >
                  <Folder className="h-[16px] w-[16px] shrink-0 text-[var(--dc-text-muted)] group-hover:text-[var(--dc-text-strong)]" strokeWidth={1.9} />
                  <span className="truncate text-[13.5px] font-normal leading-normal">New project</span>
                </button>
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              className="flex h-7 w-full items-center gap-1.5 px-2 text-left text-[12px] font-medium leading-none tracking-wide text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
              onClick={toggleRecent}
            >
              <span>Recents</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isRecentOpen ? '' : '-rotate-90'}`} strokeWidth={1.75} />
            </button>
            {isRecentOpen && (
              <div className="space-y-0.5">
                {visibleRecent.map((chat) => (
                  <ExpandedChatItem
                    key={chat.id}
                    chat={chat}
                    active={pathname === `/chat/${chat.id}`}
                    onAction={handleAction}
                    onClick={() => router.push(`/chat/${chat.id}`)}
                  />
                ))}
                
                {unpinnedChats.length > 4 && (
                  <button 
                    onClick={() => setShowAllRecent(!showAllRecent)}
                    className="mt-0.5 w-full rounded-xl px-2 py-1.5 text-left text-[13px] font-medium text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
                  >
                    {showAllRecent ? 'Show less' : `Show ${unpinnedChats.length - 4} more`}
                  </button>
                )}
                
                {unpinnedChats.length === 0 && (
                  <div className="px-2 py-1.5 text-[13px] font-normal text-[var(--dc-text-faint)]">No recent chats</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--dc-sidebar-border)] px-2.5 py-2.5">
          {renderProfile('expanded', 0)}
        </div>
        {isOpen && (
          <div
            onClick={() => setIsOpen(false)}
            className="absolute right-0 top-0 bottom-0 z-20 w-[6px] cursor-w-resize transition-colors hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
            aria-hidden="true"
          />
        )}
      </div>

      {deleteTarget && typeof document !== 'undefined' && createPortal(
        <DeleteChatConfirmModal
          title={deleteTarget.title || 'New Chat'}
          deleteFiles={deleteFilesToo}
          onToggleDeleteFiles={() => setDeleteFilesToo((prev) => !prev)}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const targetId = deleteTarget.id;
            setDeleteTarget(null);
            try {
              await deleteChat(targetId);
              toast.success('Chat deleted');
              if (pathname === `/chat/${targetId}`) router.push('/');
              window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { chatId: targetId } }));
              void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.chats });
            } catch {
              toast.error('Failed to delete chat');
            }
          }}
        />,
        document.body
      )}
    </>
  );
}

function CollapsedSidebarButton({
  children,
  label,
  shortcuts = [],
  onClick
}: {
  children: React.ReactNode | ((hovered: boolean) => React.ReactNode);
  label: string;
  shortcuts?: Array<{ label: string; tone: 'muted' }>;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Tooltip label={label} shortcuts={shortcuts} side="right" align="center">
      <button
        type="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="rail-action flex h-9 w-9 items-center justify-center rounded-xl text-[var(--dc-text-body)] transition-all hover:bg-black/[0.05] hover:text-[var(--dc-text-strong)] active:scale-95 dark:hover:bg-white/[0.08]"
        aria-label={label}
      >
        {typeof children === 'function' ? children(hovered) : children}
      </button>
    </Tooltip>
  );
}

function ExpandedSidebarMenuItem({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode | ((hovered: boolean) => React.ReactNode);
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex h-9 w-full items-center gap-2.5 rounded-xl px-2 text-left text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] hover:text-[var(--dc-text-strong)] active:scale-[0.99] dark:hover:bg-white/[0.07]"
    >
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-[var(--dc-text-body)] group-hover:text-[var(--dc-text-strong)]">
        {typeof icon === 'function' ? icon(hovered) : icon}
      </span>
      <span className="truncate text-[14px] font-medium leading-normal tracking-[-0.01em]">{label}</span>
    </button>
  );
}


function SidebarSvgIcon({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        maskImage: `url(/icons/${name}.svg)`,
        WebkitMaskImage: `url(/icons/${name}.svg)`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  );
}

function ExpandedChatItem({ chat, active, onAction, onClick }: { chat: ChatItem; active?: boolean; onAction: (action: string, id: string, value?: string) => void; onClick?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectsSubmenuOpen, setProjectsSubmenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(chat.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const insideRow = menuRef.current?.contains(target);
      const insidePortal = portalMenuRef.current?.contains(target);
      if (!insideRow && !insidePortal) {
        setMenuOpen(false);
        setProjectsSubmenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || isRenaming) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'a' || event.key === 'A') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setMenuOpen(false);
        setProjectsSubmenuOpen(false);
        onAction('archive', chat.id);
      } else if (event.key === 'Escape') {
        setMenuOpen(false);
        setProjectsSubmenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen, isRenaming, chat.id, onAction]);

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  const openMenu = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
      setProjectsSubmenuOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const estimatedHeight = 260;
      const top = rect.bottom + estimatedHeight > window.innerHeight
        ? Math.max(12, rect.top - estimatedHeight)
        : rect.bottom + 4;
      setMenuPos({ top, left: Math.max(12, rect.right - 196) });
    }
    setMenuOpen(true);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    setIsRenaming(false);
    if (trimmed && trimmed !== chat.title) {
      onAction('rename', chat.id, trimmed);
    } else {
      setRenameValue(chat.title);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <div
        className={`group flex h-9 w-full items-center justify-between gap-1.5 rounded-xl px-2 text-left transition-colors ${active || menuOpen ? 'bg-black/[0.06] text-[var(--dc-text-strong)] font-medium dark:bg-white/[0.09]' : 'text-[var(--dc-text-body)] hover:bg-black/[0.045] hover:text-[var(--dc-text-strong)] dark:hover:bg-white/[0.06]'}`}
      >
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitRename();
              } else if (e.key === 'Escape') {
                setRenameValue(chat.title);
                setIsRenaming(false);
              }
            }}
            className="min-w-0 flex-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[13.5px] font-normal text-[var(--dc-text-strong)] outline-none ring-1 ring-[var(--dc-border-strong)] dark:bg-black/30"
          />
        ) : (
          <button
            type="button"
            onClick={onClick}
            className="min-w-0 flex-1 truncate text-left text-[13.5px] font-normal leading-normal"
          >
            <AnimatedChatTitle title={chat.title} chatId={chat.id} />
          </button>
        )}

        {!isRenaming && (
          <div className={`flex shrink-0 items-center gap-0.5 transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <Tooltip label={chat.pinned ? 'Unpin' : 'Pin'} side="top" align="center">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAction('pin', chat.id);
                }}
                className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.07] hover:text-[var(--dc-text-strong)] dark:hover:bg-white/[0.1] ${chat.pinned ? 'text-[var(--dc-text-strong)]' : 'text-[var(--dc-text-muted)]'}`}
                aria-label={chat.pinned ? `Unpin ${chat.title}` : `Pin ${chat.title}`}
              >
                <SidebarSvgIcon name={chat.pinned ? 'pin-tilted-filled' : 'pin-tilted'} className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip label="More" side="top" align="end" disabled={menuOpen}>
              <button
                ref={triggerRef}
                type="button"
                onClick={openMenu}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--dc-text-muted)] transition-colors hover:bg-black/[0.07] hover:text-[var(--dc-text-strong)] dark:hover:bg-white/[0.1]"
                aria-label={`More actions for ${chat.title}`}
              >
                <SidebarSvgIcon name="more-horizontal" className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {menuOpen && menuPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={portalMenuRef}
          style={{ top: menuPos.top, left: menuPos.left }}
          className="fixed z-[120] w-52 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-1.5 shadow-xl shadow-black/12 dark:shadow-black/55"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onAction('pin', chat.id); }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
          >
            <SidebarSvgIcon name={chat.pinned ? 'pin-tilted-filled' : 'pin-tilted'} className="h-[18px] w-[18px] text-[var(--dc-text-body)]" />
            <span>{chat.pinned ? 'Unpin' : 'Pin'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(false);
              setRenameValue(chat.title);
              setIsRenaming(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
          >
            <SidebarSvgIcon name="rename-pencil" className="h-4 w-4 text-[var(--dc-text-body)]" />
            <span>Rename</span>
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onAction('share', chat.id); }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
          >
            <SidebarSvgIcon name="share-modern" className="h-4 w-4 text-[var(--dc-text-body)]" />
            <span>Share</span>
          </button>

          <div
            className="relative"
            onMouseEnter={() => setProjectsSubmenuOpen(true)}
            onMouseLeave={() => setProjectsSubmenuOpen(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setProjectsSubmenuOpen((prev) => !prev);
              }}
              className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
            >
              <span className="flex items-center gap-2.5">
                <SidebarSvgIcon name="folder" className="h-4 w-4 text-[var(--dc-text-body)]" />
                <span>Move to project</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-[var(--dc-text-muted)]" strokeWidth={1.9} />
            </button>

            {projectsSubmenuOpen && (
              <div className="absolute left-full top-0 ml-1.5 w-44 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-1.5 shadow-xl shadow-black/12 dark:shadow-black/55">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setProjectsSubmenuOpen(false);
                    toast('Projects are coming soon.');
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
                >
                  <Plus className="h-4 w-4 shrink-0 text-[var(--dc-text-body)]" strokeWidth={1.9} />
                  <span>New project</span>
                </button>
              </div>
            )}
          </div>

          <div className="my-1 border-t border-[var(--dc-border-subtle)]" />

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onAction('archive', chat.id); }}
            className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
          >
            <span className="flex items-center gap-2.5">
              <SidebarSvgIcon name="archive" className="h-4 w-4 text-[var(--dc-text-body)]" />
              <span>Archive</span>
            </span>
            <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-[var(--dc-text-muted)] dark:bg-white/[0.08]">
              A
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onAction('delete', chat.id); }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <SidebarSvgIcon name="trash-2" className="h-4 w-4" />
            <span>Delete</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

function DeleteChatConfirmModal({
  title,
  deleteFiles,
  onToggleDeleteFiles,
  onCancel,
  onConfirm,
}: {
  title: string;
  deleteFiles: boolean;
  onToggleDeleteFiles: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-chat-modal-title"
      onClick={onCancel}
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px] animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-[24px] border border-[var(--dc-border)] bg-[var(--dc-panel)] p-6 shadow-2xl shadow-black/15 dark:shadow-black/60"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="delete-chat-modal-title" className="text-[18px] font-semibold leading-snug tracking-[-0.015em] text-[var(--dc-text-strong)]">
            Delete chat?
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close delete dialog"
            className="-mr-1.5 -mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--dc-text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--dc-text-strong)] dark:hover:bg-white/[0.08]"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <p className="mt-2 text-[14px] leading-relaxed text-[var(--dc-text-muted)]">
          This will permanently delete <span className="font-medium text-[var(--dc-text)]">{title}</span>. This can&apos;t be undone.
        </p>

        <label className="mt-4 flex cursor-pointer items-center gap-2.5 select-none">
          <button
            type="button"
            role="checkbox"
            aria-checked={deleteFiles}
            onClick={onToggleDeleteFiles}
            className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
              deleteFiles
                ? 'border-[var(--dc-invert)] bg-[var(--dc-invert)] text-[var(--dc-text-on-invert)]'
                : 'border-[var(--dc-border-strong)] bg-transparent text-transparent'
            }`}
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </button>
          <span className="text-[13.5px] font-normal text-[var(--dc-text)]">
            Also delete files uploaded or created in this chat
          </span>
        </label>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-[var(--dc-fill)] px-4 py-2 text-[13.5px] font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-red-500/12 px-4 py-2 text-[13.5px] font-medium text-red-600 transition-colors hover:bg-red-500/20 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/25"
          >
            Delete chat
          </button>
        </div>
      </div>
    </div>
  );
}
