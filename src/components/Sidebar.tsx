'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getChats, getUserProfile, togglePinChat, archiveChat, deleteChat } from '@/app/actions';
import toast from 'react-hot-toast';
import {
  ChevronDown, Pin, MoreVertical, Archive, Trash2, FileText, User, Brain,
  Settings, PanelLeft, SquarePen, Search, Ellipsis, Library, Image as ImageIcon, Folder
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

  const handleAction = async (action: string, id: string) => {
    try {
      if (action === 'pin') {
        await togglePinChat(id);
        toast.success('Chat pin toggled');
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
      <div className={`deepchat-rail-light hidden min-h-0 shrink-0 flex-col items-center border-r border-[var(--dc-sidebar-border)] bg-[var(--dc-sidebar)] py-2 text-[var(--dc-text)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:flex ${isOpen ? 'w-0 overflow-hidden opacity-0 pointer-events-none border-r-0' : 'w-[44px] opacity-100'}`}>
        <Tooltip label="Open sidebar" side="right" align="center">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group/collapse-logo mb-6 flex h-8 w-8 cursor-e-resize items-center justify-center rounded-xl text-[var(--dc-text-strong)] transition-all hover:bg-black/[0.05] active:scale-95 dark:hover:bg-white/[0.08]"
            aria-label="Open sidebar"
          >
            <Image
              src="/brands/brand.svg"
              alt="DeepChat"
              width={28}
              height={28}
              unoptimized
              className="h-7 w-7 rounded-lg ring-1 ring-black/10 transition-opacity group-hover/collapse-logo:opacity-0 dark:ring-white/20"
            />
            <PanelLeft className="absolute h-5 w-5 opacity-0 transition-opacity group-hover/collapse-logo:opacity-100" strokeWidth={1.9} />
          </button>
        </Tooltip>

        <div className="flex flex-1 flex-col items-center">
          <div className="flex flex-col items-center gap-4">
            <CollapsedSidebarButton label="New Chat" shortcuts={[{ label: shortcuts.newChat.join('+'), tone: 'muted' }]} onClick={handleNewChat}>
              <SquarePen className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </CollapsedSidebarButton>
            <CollapsedSidebarButton label="Search" shortcuts={[{ label: shortcuts.search.join('+'), tone: 'muted' }]} onClick={onOpenSearch}>
              <Search className="h-5 w-5" strokeWidth={2} />
            </CollapsedSidebarButton>
            <CollapsedSidebarButton label="Action menu" onClick={onOpenActions}>
              <Ellipsis className="h-5 w-5" strokeWidth={2} />
            </CollapsedSidebarButton>
          </div>

          <div className="mt-auto flex flex-col items-center gap-4 pb-1">
            <CollapsedSidebarButton label="Settings" onClick={() => handleOpenSettings()}>
              <Settings className="h-5 w-5" strokeWidth={1.9} />
            </CollapsedSidebarButton>
            <button
              type="button"
              onClick={() => handleOpenSettings('profile')}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
              aria-label="Profile"
            >
              <Image src={safeAvatarSource(profile.avatar)} alt="User" width={28} height={28} unoptimized className="h-7 w-7 rounded-full object-cover" />
            </button>
          </div>
        </div>
      </div>

      <div className={`deepchat-sidebar-light hidden min-h-0 origin-left overflow-hidden sm:flex flex-col border-r border-[var(--dc-sidebar-border)] bg-[var(--dc-sidebar)] text-[var(--dc-text)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width,opacity,transform] ${isOpen ? 'w-[248px] xl:w-[250px] translate-x-0 opacity-100' : 'w-0 -translate-x-4 opacity-0 pointer-events-none border-r-0'}`}>
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

        <div className="shrink-0 px-3 pb-4 pt-3">
          <div className="space-y-2">
            <ExpandedSidebarMenuItem label="New Chat" icon={<SquarePen className="h-[18px] w-[18px]" strokeWidth={1.9} />} onClick={handleNewChat} />
            <ExpandedSidebarMenuItem label="Library" icon={<Library className="h-[18px] w-[18px]" strokeWidth={1.9} />} onClick={() => window.dispatchEvent(new Event('openFileLibrary'))} />
            <ExpandedSidebarMenuItem label="Images" icon={<ImageIcon className="h-[18px] w-[18px]" strokeWidth={1.9} />} onClick={() => toast('Images are available from the composer image tool.')} />
            <ExpandedSidebarMenuItem label="Project" icon={<Folder className="h-[18px] w-[18px]" strokeWidth={1.9} />} onClick={() => toast('Projects are coming soon.')} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 custom-scrollbar">
          <button
            type="button"
            className="flex h-8 w-full items-center gap-1.5 text-left text-[16px] font-normal leading-none text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
            onClick={togglePinned}
          >
            <span>Pin chat</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isPinnedOpen ? '' : '-rotate-90'}`} strokeWidth={1.75} />
          </button>
          <div>
            {isPinnedOpen && (
              <div className="space-y-1">
                {pinnedChats.map((chat) => (
                  <ExpandedChatItem
                    key={chat.id}
                    chat={chat}
                    active={pathname === `/chat/${chat.id}`}
                    onAction={handleAction}
                    onClick={() => router.push(`/chat/${chat.id}`)}
                  />
                ))}
                {pinnedChats.length === 0 && (
                  <div className="px-1 py-1 text-sm font-medium text-[var(--dc-text-faint)]">No pinned chats</div>
                )}
              </div>
            )}
          </div>

          <div className={isPinnedOpen ? 'mt-3' : 'mt-0'}>
            <button
              type="button"
              className="flex h-8 w-full items-center gap-1.5 text-left text-[16px] font-normal leading-none text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
              onClick={toggleRecent}
            >
              <span>Recent</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isRecentOpen ? '' : '-rotate-90'}`} strokeWidth={1.75} />
            </button>
            {isRecentOpen && (
              <div className="space-y-1">
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
                    className="mt-1 w-full rounded-xl px-1 py-2 text-left text-sm font-medium text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
                  >
                    {showAllRecent ? 'Show less' : `Show ${unpinnedChats.length - 4} more`}
                  </button>
                )}
                
                {unpinnedChats.length === 0 && (
                  <div className="px-1 py-2 text-sm font-medium text-[var(--dc-text-faint)]">No recent chats</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-3 pb-3 pt-2">
          {renderProfile('expanded', 0)}
        </div>
      </div>
    </>
  );
}

function CollapsedSidebarButton({ children, label, shortcuts = [], onClick }: { children: React.ReactNode; label: string; shortcuts?: Array<{ label: string; tone: 'muted' }>; onClick: () => void }) {
  return (
    <Tooltip label={label} shortcuts={shortcuts} side="right" align="center">
      <button
        type="button"
        onClick={onClick}
        className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--dc-text-body)] transition-all hover:bg-black/[0.05] hover:text-[var(--dc-text-strong)] active:scale-95 dark:hover:bg-white/[0.08]"
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
      className="group flex h-8 w-full items-center gap-2.5 rounded-xl px-1.5 text-left text-[var(--dc-text)] transition-all hover:bg-black/[0.05] hover:text-[var(--dc-text-strong)] active:scale-[0.99] dark:hover:bg-white/[0.07]"
    >
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center transition-transform group-hover:scale-105">
        {icon}
      </span>
      <span className="truncate text-[20px] font-medium leading-none tracking-normal">{label}</span>
    </button>
  );
}


function ExpandedChatItem({ chat, active, onAction, onClick }: { chat: ChatItem; active?: boolean; onAction: (action: string, id: string) => void; onClick?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <div
        className={`group flex h-8 w-full items-center justify-between gap-2 rounded-xl px-1.5 text-left transition-colors ${active ? 'bg-black/[0.06] text-[var(--dc-text-strong)] font-medium dark:bg-white/[0.09]' : 'text-[var(--dc-text-body)] hover:bg-black/[0.045] hover:text-[var(--dc-text-strong)] dark:hover:bg-white/[0.06]'}`}
      >
        <button
          type="button"
          onClick={onClick}
          className="min-w-0 flex-1 truncate text-left text-[16px] font-normal leading-none"
        >
          {chat.title}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen(open => !open);
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--dc-text-muted)] opacity-0 transition-all hover:bg-black/[0.06] hover:text-[var(--dc-text-strong)] group-hover:opacity-100 dark:hover:bg-white/[0.08]"
          aria-label={`Open ${chat.title} menu`}
        >
          <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute right-0 top-8 z-50 w-32 overflow-hidden rounded-xl border border-[var(--dc-border)] bg-[var(--dc-panel)] py-1 shadow-xl shadow-black/10 dark:shadow-black/50">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onAction('pin', chat.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]">
            <Pin className="h-3.5 w-3.5" /> {chat.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onAction('archive', chat.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--dc-text)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]">
            <Archive className="h-3.5 w-3.5" /> Archive
          </button>
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onAction('delete', chat.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
