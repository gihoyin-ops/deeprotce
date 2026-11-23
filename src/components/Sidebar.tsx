'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getChats, getUserProfile, togglePinChat, archiveChat, deleteChat, updateChatTitle, shareChat } from '@/app/actions';
import toast from 'react-hot-toast';
import {
  ChevronDown, ChevronRight, Pin, FileText, User, Brain,
  Settings, PanelLeft, SquarePen, Search, Ellipsis, Library, Image as ImageIcon, Folder, Plus
} from '@/components/ui/icons';
import { useShortcutLabels } from './shortcuts';
import Tooltip from './ui/Tooltip';
import type { SettingsTab } from './SettingsModal';
import { deepchatQueryKeys } from '@/lib/query-keys';
import { safeAvatarSource } from '@/lib/utils';

type SidebarSettingsTab = Extract<SettingsTab, 'general' | 'profile' | 'personality'>;

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
  name: string;
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
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isPinnedOpen, setIsPinnedOpen] = useState(() => loadStoredBoolean('isPinnedOpen', true));
  const [isProjectsOpen, setIsProjectsOpen] = useState(() => loadStoredBoolean('isProjectsOpen', true));
  const [isRecentOpen, setIsRecentOpen] = useState(() => loadStoredBoolean('isRecentOpen', true));
  const queryClient = useQueryClient();
  const { data: chats = [] } = useQuery({
    queryKey: deepchatQueryKeys.chats,
    queryFn: async () => getChats() as Promise<ChatItem[]>
  });
  const { data: profile = { name: 'Guest', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix', plan: '' } } = useQuery({
    queryKey: deepchatQueryKeys.profile,
    queryFn: async () => getUserProfile() as Promise<UserProfileData>
  });

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

  const pinnedChats = chats.filter(c => c.pinned);
  const unpinnedChats = chats.filter(c => !c.pinned);
  const visibleRecent = showAllRecent ? unpinnedChats : unpinnedChats.slice(0, 4);

  const handleOpenSettings = (tab: SidebarSettingsTab = 'general') => {
    setProfileMenuOpen(false);
    setMobileOpen(false);
    onOpenSettings(tab);
  };

  const handleOpenDocs = () => {
    setProfileMenuOpen(false);
    setMobileOpen(false);
    toast('Docs are available in the project documentation.');
  };

  const profileMenuRefs = useRef<Array<HTMLDivElement | null>>([]);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isInsideProfileMenu = profileMenuRefs.current.some(node => node?.contains(target));
      if (!isInsideProfileMenu) {
        setProfileMenuOpen(false);
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
      <button
        type="button"
        className={isExpanded
          ? "flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] active:scale-[0.99] dark:hover:bg-white/[0.07]"
          : "flex w-full items-center gap-3 rounded-2xl bg-slate-800/50 p-2 text-left transition-colors hover:bg-slate-800 active:scale-[0.99]"}
        onClick={() => setProfileMenuOpen(!profileMenuOpen)}
        aria-expanded={profileMenuOpen}
        aria-label="Open profile menu"
      >
        <Image
          src={avatarSrc}
          alt="User"
          width={isExpanded ? 34 : 40}
          height={isExpanded ? 34 : 40}
          unoptimized
          className={isExpanded
            ? "h-[34px] w-[34px] rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] object-cover"
            : "h-10 w-10 rounded-full border-2 border-slate-700 object-cover"}
        />
        <div className="flex-1 min-w-0">
          <p className={isExpanded ? "truncate text-[15px] font-medium leading-tight text-[var(--dc-text-strong)]" : "truncate text-sm font-medium text-white"}>{profile.name || 'Guest'}</p>
          <p className={isExpanded ? "truncate text-xs font-medium leading-tight text-[var(--dc-text-muted)]" : "truncate text-xs text-slate-400"}>{profile.plan || 'No Plan'}</p>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${profileMenuOpen ? 'rotate-180' : ''} ${isExpanded ? 'text-[var(--dc-text-muted)]' : 'text-slate-400'}`} strokeWidth={1.75} />
      </button>
      
      {profileMenuOpen && (
        <div className={isExpanded
          ? "absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-[var(--dc-border)] bg-[var(--dc-panel)] py-1 shadow-xl shadow-black/10 dark:shadow-black/50"
          : "absolute bottom-16 left-0 right-0 z-50 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 py-1 shadow-xl"}
        >
          <button type="button" onClick={() => handleOpenSettings('general')} className={isExpanded ? "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]" : "flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"}>
            <Settings className="h-4 w-4 shrink-0" strokeWidth={1.9} /> Settings
          </button>
          <button type="button" onClick={() => handleOpenSettings('profile')} className={isExpanded ? "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]" : "flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"}>
            <User className="h-4 w-4 shrink-0" strokeWidth={1.9} /> Profile
          </button>
          <button type="button" onClick={() => handleOpenSettings('personality')} className={isExpanded ? "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]" : "flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"}>
            <Brain className="h-4 w-4 shrink-0" strokeWidth={1.9} /> Personalization
          </button>
          <button type="button" onClick={handleOpenDocs} className={isExpanded ? "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]" : "flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"}>
            <FileText className="h-4 w-4 shrink-0" strokeWidth={1.9} /> Docs
          </button>
        </div>
      )}
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
              <SquarePen className="h-[19px] w-[19px]" strokeWidth={1.9} />
            </CollapsedSidebarButton>
            <CollapsedSidebarButton label="Search" shortcuts={[{ label: shortcuts.search.join('+'), tone: 'muted' }]} onClick={onOpenSearch}>
              <Search className="h-[19px] w-[19px]" strokeWidth={2} />
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
                handleOpenSettings('profile');
              }}
              className="rail-action flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
              aria-label="Profile"
            >
              <Image src={safeAvatarSource(profile.avatar)} alt="User" width={28} height={28} unoptimized className="h-7 w-7 rounded-full object-cover" />
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
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--dc-text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--dc-text-strong)] active:scale-95 dark:hover:bg-white/[0.08]"
                aria-label="Search chats"
              >
                <Search className="h-[18px] w-[18px]" strokeWidth={1.9} />
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
            <ExpandedSidebarMenuItem label="New Chat" icon={<SquarePen className="h-[17px] w-[17px]" strokeWidth={1.9} />} onClick={handleNewChat} />
            <ExpandedSidebarMenuItem label="Library" icon={<Library className="h-[17px] w-[17px]" strokeWidth={1.9} />} onClick={() => window.dispatchEvent(new Event('openFileLibrary'))} />
            <ExpandedSidebarMenuItem label="Images" icon={<ImageIcon className="h-[17px] w-[17px]" strokeWidth={1.9} />} onClick={() => toast('Images are available from the composer image tool.')} />
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

        <div className="shrink-0 px-3 pb-3 pt-2">
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
    </>
  );
}

function CollapsedSidebarButton({ children, label, shortcuts = [], onClick }: { children: React.ReactNode; label: string; shortcuts?: Array<{ label: string; tone: 'muted' }>; onClick: () => void }) {
  return (
    <Tooltip label={label} shortcuts={shortcuts} side="right" align="center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="rail-action flex h-9 w-9 items-center justify-center rounded-xl text-[var(--dc-text-body)] transition-all hover:bg-black/[0.05] hover:text-[var(--dc-text-strong)] active:scale-95 dark:hover:bg-white/[0.08]"
        aria-label={label}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function ExpandedSidebarMenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-9 w-full items-center gap-2.5 rounded-xl px-2 text-left text-[var(--dc-text)] transition-all hover:bg-black/[0.05] hover:text-[var(--dc-text-strong)] active:scale-[0.99] dark:hover:bg-white/[0.07]"
    >
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-[var(--dc-text-body)] transition-transform group-hover:scale-105 group-hover:text-[var(--dc-text-strong)]">
        {icon}
      </span>
      <span className="truncate text-[14px] font-medium leading-normal tracking-[-0.01em]">{label}</span>
    </button>
  );
}


function ThreeDotsIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="3.25" cy="8" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="12.75" cy="8" r="1.25" />
    </svg>
  );
}

function RenamePencilIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M11.35 2.45a1.55 1.55 0 0 1 2.2 2.2L5.4 12.8l-3.1.85.85-3.1 8.2-8.1Z" />
      <path d="M9.85 3.95l2.2 2.2" />
    </svg>
  );
}

function ModernShareIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 2.25v7.5" />
      <path d="M5.25 5 8 2.25 10.75 5" />
      <path d="M3 10.25v2.25A1.75 1.75 0 0 0 4.75 14.25h6.5A1.75 1.75 0 0 0 13 12.5v-2.25" />
    </svg>
  );
}

function ArchiveBoxIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="2.5" width="12" height="3.25" rx="0.9" />
      <path d="M3.25 5.75v6.5A1.5 1.5 0 0 0 4.75 13.75h6.5a1.5 1.5 0 0 0 1.5-1.5v-6.5" />
      <path d="M6.5 8.75h3" />
    </svg>
  );
}

function TrashBinIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2.75 4.5h10.5" />
      <path d="M6 4.5V3.1A1.1 1.1 0 0 1 7.1 2h1.8A1.1 1.1 0 0 1 10 3.1v1.4" />
      <path d="M4.35 4.5l.55 8.1a1.4 1.4 0 0 0 1.4 1.3h3.4a1.4 1.4 0 0 0 1.4-1.3l.55-8.1" />
      <path d="M6.75 7.25v4" />
      <path d="M9.25 7.25v4" />
    </svg>
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
            {chat.title}
          </button>
        )}

        {!isRenaming && (
          <div className={`flex shrink-0 items-center gap-0.5 transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAction('pin', chat.id);
              }}
              className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.07] hover:text-[var(--dc-text-strong)] dark:hover:bg-white/[0.1] ${chat.pinned ? 'text-[var(--dc-text-strong)]' : 'text-[var(--dc-text-muted)]'}`}
              aria-label={chat.pinned ? `Unpin ${chat.title}` : `Pin ${chat.title}`}
            >
              <Pin className="h-3.5 w-3.5" strokeWidth={1.85} />
            </button>
            <button
              ref={triggerRef}
              type="button"
              onClick={openMenu}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--dc-text-muted)] transition-colors hover:bg-black/[0.07] hover:text-[var(--dc-text-strong)] dark:hover:bg-white/[0.1]"
              aria-label={`Open ${chat.title} menu`}
            >
              <ThreeDotsIcon className="h-4 w-4" />
            </button>
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
            <Pin className="h-4 w-4 shrink-0 text-[var(--dc-text-body)]" strokeWidth={1.75} />
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
            <RenamePencilIcon className="h-4 w-4 shrink-0 text-[var(--dc-text-body)]" />
            <span>Rename</span>
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onAction('share', chat.id); }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
          >
            <ModernShareIcon className="h-4 w-4 shrink-0 text-[var(--dc-text-body)]" />
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
                <Folder className="h-4 w-4 shrink-0 text-[var(--dc-text-body)]" strokeWidth={1.75} />
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
              <ArchiveBoxIcon className="h-4 w-4 shrink-0 text-[var(--dc-text-body)]" />
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
            <TrashBinIcon className="h-4 w-4 shrink-0" />
            <span>Delete</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
