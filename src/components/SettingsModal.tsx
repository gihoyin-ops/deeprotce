'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { usePathname, useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import GsapMorphSvg from '@/components/ui/GsapMorphSvg';
import { Archive, ArrowLeft, Bell, Brain, Database, Search, Settings as SettingsIcon, User, X } from '@/components/ui/icons';
import {
  archiveAllChats,
  deleteAllChats,
  deleteChat,
  exportData,
  getArchivedChats,
  getSharedLinks,
  getUserProfile,
  saveUserProfile
} from '@/app/actions';
import { getPersona, savePersona } from '@/app/persona';
import { loadToolSettings, updateToolFeatureSettings, type ToolSettings } from '@/lib/settings/tool-settings';
import { clearSavedMemories, deleteSavedMemory, getSavedMemories, type SavedMemory } from '@/app/memory';
import {
  loadNotificationSettings,
  requestPushPermission,
  saveNotificationSettings,
  type NotificationEventKey,
  type NotificationEventSetting,
  type NotificationSettings
} from '@/lib/settings/notification-settings';
import { getMobileTabTitle, mobileDetailAnimationMs, modalAnimationMs } from './settings/constants';
import { type GeneralSettings, loadGeneralSettings, saveGeneralSettings } from '@/lib/settings/general-settings';
import { MobileSettingsHome } from './settings/mobile';
import { GeneralTab } from './settings/tabs/GeneralTab';
import { ProfileTab } from './settings/tabs/ProfileTab';
import { PersonalizationTab } from './settings/tabs/PersonalizationTab';
import { NotificationsTab } from './settings/tabs/NotificationsTab';
import { ToolsTab } from './settings/tabs/ToolsTab';
import { AgentTab } from './settings/tabs/AgentTab';
import { DataTab } from './settings/tabs/DataTab';
import { StorageTab } from './settings/tabs/StorageTab';
import { CropDialog } from './settings/panels/CropDialog';
import { SharedLinksDialog } from './settings/panels/ConnectionDialogs';
import { ArchivedChatsDialog, ConfirmDialog, MemoriesDialog } from './settings/panels/ListDialogs';
import type {
  ArchivedChatItem,
  ConfirmDialogState,
  PersonaState,
  SharedLinkItem,
  StorageState,
  UserProfile
} from './settings/types';
import type { SettingsModalProps, SettingsTab } from './settings/types';

export type { SettingsTab } from './settings/types';

const defaultPersona: PersonaState = {
  instructions: '',
  styleTone: 'default',
  charWarm: 'default',
  charEnthusiastic: 'default',
  charHeaders: 'default',
  charEmoji: 'default',
  aboutName: '',
  aboutOccupation: '',
  aboutMore: '',
  memoryReferenceSaved: true,
  memoryReferenceHistory: true
};

const tabMeta: Array<{ tab: SettingsTab; label: string; icon: React.ReactNode }> = [
  { tab: 'general', label: 'General', icon: <SettingsIcon className="h-4 w-4" /> },
  { tab: 'profile', label: 'Profile Settings', icon: <User className="h-4 w-4" /> },
  { tab: 'personality', label: 'Personalization', icon: <Brain className="h-4 w-4" /> },
  { tab: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  { tab: 'tools', label: 'Tools Settings', icon: <Search className="h-4 w-4" /> },
  { tab: 'agent', label: 'Agent Settings', icon: <SettingsIcon className="h-4 w-4" /> },
  { tab: 'data', label: 'Data Control', icon: <Database className="h-4 w-4" /> },
  { tab: 'storage', label: 'Storage', icon: <Archive className="h-4 w-4" /> }
];

// settings shell: shared state and loaders with GSAP micro-interactions
export default function SettingsModal({ isOpen, onClose, onBackToSidebar, initialTab = 'general' }: SettingsModalProps) {
  const router = useRouter();
  const pathname = usePathname();

  // nav
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(initialTab !== 'general');
  const [isMobileDetailClosing, setIsMobileDetailClosing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // GSAP animation refs
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // tab data
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(() => loadGeneralSettings());
  const [profile, setProfile] = useState<UserProfile>({ name: '', avatar: '', plan: '' });
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [persona, setPersona] = useState<PersonaState>(defaultPersona);
  const [isPersonaLoading, setIsPersonaLoading] = useState(false);
  const [isSavingPersona, setIsSavingPersona] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => loadNotificationSettings());
  const [pushPermission, setPushPermission] = useState<'default' | 'denied' | 'granted' | 'unsupported'>('default');
  const [toolSettings, setToolSettings] = useState<ToolSettings>(() => loadToolSettings());
  const [storage, setStorage] = useState<StorageState>({ usage: null, quota: null, localItems: 0 });

  // dialogs
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [isCropClosing, setIsCropClosing] = useState(false);
  const [sharedLinks, setSharedLinks] = useState<SharedLinkItem[]>([]);
  const [isSharedLinksOpen, setIsSharedLinksOpen] = useState(false);
  const [isSharedLinksClosing, setIsSharedLinksClosing] = useState(false);
  const [isSharedLinksLoading, setIsSharedLinksLoading] = useState(false);
  const [archivedChats, setArchivedChats] = useState<ArchivedChatItem[]>([]);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [isArchivedClosing, setIsArchivedClosing] = useState(false);
  const [isArchivedLoading, setIsArchivedLoading] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [isArchivingAll, setIsArchivingAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [savedMemories, setSavedMemories] = useState<SavedMemory[]>([]);
  const [isMemoriesOpen, setIsMemoriesOpen] = useState(false);
  const [isMemoriesClosing, setIsMemoriesClosing] = useState(false);
  const [isMemoriesLoading, setIsMemoriesLoading] = useState(false);
  const [isClearingMemories, setIsClearingMemories] = useState(false);
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmDialogState | null>(null);
  const [isConfirmClosing, setIsConfirmClosing] = useState(false);
  const [isDeletingChats, setIsDeletingChats] = useState(false);

  // avoid re-triggering loaders on reopen
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);
  const loadedRef = useRef({ profile: false, persona: false });
  const timersRef = useRef<number[]>([]);
  const mobileTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(clearTimeout);
      clearTimeout(mobileTimerRef.current);
    };
  }, []);

  // GSAP modal entrance
  useEffect(() => {
    if (!isOpen) return;

    if (backdropRef.current) {
      gsap.fromTo(
        backdropRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.24, ease: 'power2.out' }
      );
    }
    if (modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { opacity: 0, scale: 0.95, y: 16 },
        { opacity: 1, scale: 1, y: 0, duration: 0.32, ease: 'power3.out' }
      );
    }
  }, [isOpen]);

  // GSAP tab switch micro-animation
  useEffect(() => {
    if (!contentRef.current) return;
    gsap.killTweensOf(contentRef.current);
    gsap.fromTo(
      contentRef.current,
      { opacity: 0, y: 8, filter: 'blur(3px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.22, ease: 'power2.out' }
    );
  }, [activeTab]);

  // wait for exit animation
  const afterExit = useCallback((callback: () => void) => {
    const timer = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter(item => item !== timer);
      callback();
    }, modalAnimationMs);
    timersRef.current.push(timer);
  }, []);

  // loaders
  const loadProfile = useCallback(async () => {
    if (loadedRef.current.profile) return;
    setIsProfileLoading(true);
    try {
      const next = await getUserProfile();
      if (mountedRef.current) {
        setProfile(next);
        loadedRef.current.profile = true;
      }
    } catch {
      // keep defaults on error
    } finally {
      if (mountedRef.current) setIsProfileLoading(false);
    }
  }, []);

  const loadPersona = useCallback(async () => {
    if (loadedRef.current.persona) return;
    setIsPersonaLoading(true);
    try {
      const data = await getPersona();
      if (!mountedRef.current) return;
      setPersona({
        instructions: data.instructions || '',
        styleTone: data.styleTone || 'default',
        charWarm: data.charWarm || 'default',
        charEnthusiastic: data.charEnthusiastic || 'default',
        charHeaders: data.charHeaders || 'default',
        charEmoji: data.charEmoji || 'default',
        aboutName: data.aboutName || '',
        aboutOccupation: data.aboutOccupation || '',
        aboutMore: data.aboutMore || '',
        memoryReferenceSaved: data.memoryReferenceSaved ?? true,
        memoryReferenceHistory: data.memoryReferenceHistory ?? true
      });
      loadedRef.current.persona = true;
    } catch {
      // keep defaults on error
    } finally {
      if (mountedRef.current) setIsPersonaLoading(false);
    }
  }, []);

  const refreshPushPermission = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushPermission('unsupported');
      return;
    }
    setPushPermission(Notification.permission);
  }, []);

  const loadStorage = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const localItems = window.localStorage.length;
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (!mountedRef.current) return;
      setStorage({
        usage: typeof estimate?.usage === 'number' ? estimate.usage : null,
        quota: typeof estimate?.quota === 'number' ? estimate.quota : null,
        localItems
      });
    } catch {
      if (mountedRef.current) setStorage({ usage: null, quota: null, localItems });
    }
  }, []);

  // lazy load active tab data
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'profile') void loadProfile();
    if (activeTab === 'notifications') refreshPushPermission();
    if (activeTab === 'personality') void loadPersona();
    if (activeTab === 'storage') void loadStorage();
  }, [activeTab, isOpen, loadProfile, loadPersona, loadStorage, refreshPushPermission]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setIsMobileDetailOpen(initialTab !== 'general');
    void loadProfile();
  }, [initialTab, isOpen, loadProfile]);

  // close helpers with GSAP exit animation
  const close = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    if (modalRef.current && backdropRef.current) {
      gsap.to(modalRef.current, { opacity: 0, scale: 0.95, y: 12, duration: 0.2, ease: 'power2.in' });
      gsap.to(backdropRef.current, {
        opacity: 0,
        duration: 0.2,
        ease: 'power1.in',
        onComplete: () => {
          setIsClosing(false);
          onClose();
        }
      });
    } else {
      afterExit(onClose);
    }
  }, [afterExit, isClosing, onClose]);

  const closeToSidebar = () => {
    if (isClosing) return;
    setIsClosing(true);
    if (modalRef.current && backdropRef.current) {
      gsap.to(modalRef.current, { opacity: 0, scale: 0.95, y: 12, duration: 0.2, ease: 'power2.in' });
      gsap.to(backdropRef.current, {
        opacity: 0,
        duration: 0.2,
        ease: 'power1.in',
        onComplete: () => {
          setIsClosing(false);
          onClose();
          onBackToSidebar?.();
        }
      });
    } else {
      afterExit(() => {
        onClose();
        onBackToSidebar?.();
      });
    }
  };

  const openMobileTab = (tab: SettingsTab) => {
    clearTimeout(mobileTimerRef.current);
    mobileTimerRef.current = undefined;
    setActiveTab(tab);
    setIsMobileDetailClosing(false);
    setIsMobileDetailOpen(true);
  };

  const backToMobileMenu = () => {
    if (isMobileDetailClosing) return;
    setIsMobileDetailClosing(true);
    mobileTimerRef.current = window.setTimeout(() => {
      mobileTimerRef.current = undefined;
      setIsMobileDetailOpen(false);
      setIsMobileDetailClosing(false);
    }, mobileDetailAnimationMs);
  };

  // general, profile, persona
  const updateGeneral = (patch: Partial<GeneralSettings>) => setGeneralSettings(prev => saveGeneralSettings({ ...prev, ...patch }));
  const updatePersona = (patch: Partial<PersonaState>) => setPersona(prev => ({ ...prev, ...patch }));

  const saveProfile = async () => {
    try {
      await saveUserProfile(profile);
      window.dispatchEvent(new Event('profileUpdated'));
      toast.success('Profile saved successfully!');
    } catch {
      toast.error('Failed to save profile');
    }
  };

  const savePersonaDraft = async () => {
    setIsSavingPersona(true);
    try {
      await savePersona(persona);
      toast.success('Personalization saved successfully!');
    } catch {
      toast.error('Failed to save personalization');
    }
    setIsSavingPersona(false);
  };

  const pickAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => setCropImage(reader.result?.toString() || null));
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const saveAvatar = async (dataUrl: string) => {
    const next = { ...profile, avatar: dataUrl };
    setProfile(next);
    await saveUserProfile(next);
    window.dispatchEvent(new Event('profileUpdated'));
    toast.success('Avatar saved!');
  };

  // notifications
  const updateNotifications = (patch: Partial<NotificationSettings>) => setNotificationSettings(prev => saveNotificationSettings({ ...prev, ...patch }));
  const updateQuietHours = (patch: Partial<NotificationSettings['quietHours']>) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, ...patch } });
  const updateEvent = (key: NotificationEventKey, patch: Partial<NotificationEventSetting>) => updateNotifications({
    events: { ...notificationSettings.events, [key]: { ...notificationSettings.events[key], ...patch } }
  });

  const enablePush = async () => {
    const perm = await requestPushPermission();
    setPushPermission(perm);
    if (perm === 'granted') {
      updateNotifications({ pushEnabled: true });
      toast.success('Push notifications enabled!');
    } else if (perm === 'denied') {
      toast.error('Push notification permission denied in browser.');
    }
  };

  const sendTestNotification = async () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      toast.error('Please enable push notifications first.');
      return;
    }
    new Notification('DeepChat Notification', {
      body: 'This is a test notification from DeepChat.',
      icon: '/favicon.ico'
    });
  };

  const updateToolFeatures = (patch: Partial<Pick<ToolSettings, 'searchEnabled' | 'codeExecutionEnabled' | 'urlContextEnabled'>>) => setToolSettings(updateToolFeatureSettings(patch));

  // data control
  const openMemories = async () => {
    setIsMemoriesOpen(true);
    setIsMemoriesLoading(true);
    try {
      setSavedMemories(await getSavedMemories());
    } catch {
      toast.error('Failed to load saved memories');
    }
    setIsMemoriesLoading(false);
  };

  const removeMemory = async (id: string) => {
    setDeletingMemoryId(id);
    const ok = await deleteSavedMemory(id).catch(() => false);
    if (ok) {
      setSavedMemories(prev => prev.filter(memory => memory.id !== id));
      toast.success('Memory removed');
    } else {
      toast.error('Failed to remove memory');
    }
    setDeletingMemoryId(null);
  };

  const clearMemories = async () => {
    setIsClearingMemories(true);
    const ok = await clearSavedMemories().catch(() => false);
    if (ok) {
      setSavedMemories([]);
      toast.success('Saved memories cleared');
    } else {
      toast.error('Failed to clear memories');
    }
    setIsClearingMemories(false);
  };

  const openSharedLinks = async () => {
    setIsSharedLinksOpen(true);
    setIsSharedLinksLoading(true);
    try {
      setSharedLinks(await getSharedLinks());
    } catch {
      toast.error('Failed to load shared links');
    }
    setIsSharedLinksLoading(false);
  };

  const copySharedLink = (shareId: string) => {
    const url = `${window.location.origin}/chat/s/${shareId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  const openArchived = async () => {
    setIsArchivedOpen(true);
    setIsArchivedLoading(true);
    try {
      setArchivedChats(await getArchivedChats());
    } catch {
      toast.error('Failed to load archived chats');
    }
    setIsArchivedLoading(false);
  };

  const removeArchivedChat = async (id: string) => {
    setDeletingChatId(id);
    const ok = await deleteChat(id).catch(() => false);
    if (ok) {
      setArchivedChats(prev => prev.filter(chat => chat.id !== id));
      toast.success('Chat deleted');
    } else {
      toast.error('Failed to delete chat');
    }
    setDeletingChatId(null);
  };

  const openArchivedChat = (id: string) => {
    setIsArchivedOpen(false);
    onClose();
    router.push(`/chat/${id}`);
  };

  const archiveAll = async () => {
    setIsArchivingAll(true);
    try {
      const res = await archiveAllChats();
      if (res.success) {
        toast.success(`Archived ${res.count} chats`);
        window.dispatchEvent(new Event('chatUpdated'));
      }
    } catch {
      toast.error('Failed to archive chats');
    }
    setIsArchivingAll(false);
  };

  const downloadExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `deepchat-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch {
      toast.error('Failed to export data');
    }
    setIsExporting(false);
  };

  const askDeleteChats = () => setConfirm({
    action: 'deleteChats',
    title: 'Delete all chats?',
    description: 'This will permanently remove every conversation from this device. This action cannot be undone.',
    confirmLabel: 'Delete All Chats'
  });

  const confirmDelete = async () => {
    if (!confirm) return;
    if (confirm.action === 'deleteChats') {
      setIsDeletingChats(true);
      try {
        await deleteAllChats();
        window.dispatchEvent(new Event('chatUpdated'));
        toast.success('All chats deleted successfully');
        if (pathname.startsWith('/chat/')) router.push('/');
      } catch {
        toast.error('Failed to delete chats');
      }
      setIsDeletingChats(false);
    }
    closeConfirm();
  };

  const closeConfirm = () => {
    if (isConfirmClosing) return;
    setIsConfirmClosing(true);
    afterExit(() => {
      setConfirm(null);
      setIsConfirmClosing(false);
    });
  };

  const animateClose = (setClosing: (value: boolean) => void, reset: () => void) => {
    setClosing(true);
    afterExit(() => {
      reset();
      setClosing(false);
    });
  };

  if (!isOpen) return null;

  const children = {
    GeneralTab: { settings: generalSettings, onChange: updateGeneral },
    ProfileTab: { profile, isLoading: isProfileLoading, setProfile, onSave: saveProfile, onAvatarPicked: pickAvatar, fileInputRef },
    PersonalizationTab: { persona, onChange: updatePersona, isLoading: isPersonaLoading, isSaving: isSavingPersona, onSave: savePersonaDraft, onOpenMemories: openMemories, onOpenMemoryDocs: () => router.push('/docs/memory') },
    NotificationsTab: {
      settings: notificationSettings,
      pushPermission,
      onChange: updateNotifications,
      onQuietHoursChange: updateQuietHours,
      onEventChange: updateEvent,
      onEnablePush: enablePush,
      onSendTest: sendTestNotification
    },
    ToolsTab: { settings: toolSettings, onChange: updateToolFeatures },
    StorageTab: { storage, onRefresh: loadStorage }
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] dark:bg-slate-900/40 sm:items-center sm:p-4"
      onClick={close}
    >
      <div
        ref={modalRef}
        className="settings-root-panel deepchat-mobile-settings-light relative flex h-dvh w-full flex-col overflow-hidden bg-white shadow-xl will-change-transform sm:h-[min(92dvh,800px)] sm:max-w-5xl sm:flex-row sm:rounded-3xl sm:border sm:border-white/70 sm:bg-white dark:border-slate-700/80 dark:shadow-2xl dark:shadow-black/50"
        onClick={event => event.stopPropagation()}
      >
        <MobileSettingsHome profile={profile} onClose={closeToSidebar} onOpenTab={openMobileTab} hidden={isMobileDetailOpen && !isMobileDetailClosing} />

        {/* Desktop Sidebar Navigation */}
        <nav className="hidden shrink-0 flex-col border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-700/60 dark:bg-slate-900/40 sm:flex sm:w-64 sm:border-b-0 sm:border-r sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 px-1 text-lg font-extrabold text-slate-800 dark:text-slate-100 sm:mb-6 sm:px-2 sm:text-xl">
            <GsapMorphSvg rotate={20} scale={1.2}>
              <SettingsIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </GsapMorphSvg>
            Settings
          </h2>
          <div className="flex gap-2 overflow-x-auto custom-scrollbar sm:block sm:space-y-1.5 sm:overflow-visible">
            {tabMeta.map(item => (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                aria-current={activeTab === item.tab ? 'page' : undefined}
                className={`group flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl border px-4 py-3 font-bold transition-all sm:w-full ${activeTab === item.tab
                  ? 'border-slate-200 bg-white text-indigo-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-300 dark:shadow-black/20'
                  : 'border-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-900/80 dark:hover:text-slate-100'}`}
              >
                <GsapMorphSvg rotate={14} scale={1.22}>
                  {item.icon as React.ReactElement}
                </GsapMorphSvg>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Desktop Content Panel */}
        <section
          key={isMobileDetailOpen ? activeTab : 'settings-content'}
          className={`${isMobileDetailOpen ? `settings-mobile-detail-panel ${isMobileDetailClosing ? 'settings-mobile-detail-panel-closing' : ''} flex` : 'hidden'} absolute inset-0 z-10 min-h-0 flex-1 flex-col bg-white sm:relative sm:inset-auto sm:z-auto sm:flex dark:bg-slate-900`}
        >
          <button
            onClick={close}
            className="absolute right-4 top-4 z-10 hidden rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 sm:right-5 sm:top-5 sm:block"
            aria-label="Close settings"
          >
            <GsapMorphSvg rotate={90} scale={1.25}>
              <X className="h-5 w-5" />
            </GsapMorphSvg>
          </button>
          <button onClick={backToMobileMenu} className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-[#efeeee] text-black transition-transform active:scale-95 dark:bg-slate-800 dark:text-slate-200 sm:hidden" aria-label="Back to settings menu">
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          </button>
          <h3 className="absolute left-14 right-14 top-3 z-10 flex h-8 items-center justify-center truncate text-center text-[22px] font-semibold leading-none text-black dark:text-slate-100 sm:hidden">
            {getMobileTabTitle(activeTab)}
          </h3>

          <div ref={contentRef} className="flex-1 overflow-y-auto p-4 pt-14 custom-scrollbar sm:p-6 will-change-transform">
            {activeTab === 'general' && <GeneralTab {...children.GeneralTab} />}
            {activeTab === 'profile' && <ProfileTab {...children.ProfileTab} />}
            {activeTab === 'personality' && <PersonalizationTab {...children.PersonalizationTab} />}
            {activeTab === 'notifications' && <NotificationsTab {...children.NotificationsTab} />}
            {activeTab === 'tools' && <ToolsTab {...children.ToolsTab} />}
            {activeTab === 'agent' && <AgentTab />}
            {activeTab === 'data' && (
              <DataTab
                isExporting={isExporting}
                isArchivingAll={isArchivingAll}
                isDeletingChats={isDeletingChats}
                onOpenSharedLinks={openSharedLinks}
                onOpenArchivedChats={openArchived}
                onArchiveAll={archiveAll}
                onExport={downloadExport}
                onDeleteAllChats={askDeleteChats}
              />
            )}
            {activeTab === 'storage' && <StorageTab {...children.StorageTab} />}
          </div>
        </section>
      </div>

      {cropImage && (
        <CropDialog
          key={cropImage}
          image={cropImage}
          closing={isCropClosing}
          onClose={() => animateClose(setIsCropClosing, () => setCropImage(null))}
          onSave={saveAvatar}
        />
      )}

      <SharedLinksDialog
        open={isSharedLinksOpen}
        closing={isSharedLinksClosing}
        links={sharedLinks}
        isLoading={isSharedLinksLoading}
        onClose={() => animateClose(setIsSharedLinksClosing, () => setIsSharedLinksOpen(false))}
        onCopy={copySharedLink}
      />
      <ArchivedChatsDialog
        open={isArchivedOpen}
        closing={isArchivedClosing}
        chats={archivedChats}
        isLoading={isArchivedLoading}
        deletingId={deletingChatId}
        onClose={() => animateClose(setIsArchivedClosing, () => setIsArchivedOpen(false))}
        onDelete={removeArchivedChat}
        onOpenChat={openArchivedChat}
      />
      <MemoriesDialog
        open={isMemoriesOpen}
        closing={isMemoriesClosing}
        memories={savedMemories}
        isLoading={isMemoriesLoading}
        isClearing={isClearingMemories}
        deletingId={deletingMemoryId}
        onClose={() => animateClose(setIsMemoriesClosing, () => setIsMemoriesOpen(false))}
        onDelete={removeMemory}
        onClearAll={clearMemories}
      />
      <ConfirmDialog
        state={confirm}
        closing={isConfirmClosing}
        isBusy={isDeletingChats}
        onCancel={closeConfirm}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
