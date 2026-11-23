'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { usePathname, useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import GsapMorphSvg from '@/components/ui/GsapMorphSvg';
import { Archive, ArrowLeft, Bell, Brain, Database, ExternalLink, Gauge, Mic, Palette, Search, Settings as SettingsIcon, User, X } from '@/components/ui/icons';
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
import { getMobileTabTitle, modalAnimationMs } from './settings/constants';
import { prefersReducedMotion, triggerSubtleHaptic } from '@/components/mobile/gesture-utils';
import { type GeneralSettings, loadGeneralSettings, saveGeneralSettings } from '@/lib/settings/general-settings';
import { type AppearanceSettings, loadAppearanceSettings, saveAppearanceSettings } from '@/lib/settings/appearance-settings';
import { IconMask, MobileSettingsHome } from './settings/mobile';
import { AccountTab } from './settings/tabs/AccountTab';
import { UsageTab } from './settings/tabs/UsageTab';
import { AppearanceTab } from './settings/tabs/AppearanceTab';
import { VoiceTab } from './settings/tabs/VoiceTab';
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
  charVisualAnswers: 'default',
  aboutName: '',
  aboutOccupation: '',
  aboutMore: '',
  memoryReferenceSaved: true,
  memoryReferenceHistory: true,
  suggestedPrompts: true,
  librarySearch: true,
  referencePhoto: '',
  fullBodyReferencePhoto: ''
};

const desktopSections: Array<{
  title: string;
  items: Array<{ tab: SettingsTab; label: string; icon: React.ReactNode }>;
}> = [
  {
    title: 'Account',
    items: [
      { tab: 'account', label: 'Account', icon: <User className="h-4 w-4" /> },
      { tab: 'usage', label: 'Usage', icon: <Gauge className="h-4 w-4" /> }
    ]
  },
  {
    title: 'App',
    items: [
      { tab: 'general', label: 'General', icon: <SettingsIcon className="h-4 w-4" /> },
      { tab: 'appearance', label: 'Appearance', icon: <Palette className="h-4 w-4" /> },
      { tab: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
      { tab: 'voice', label: 'Voice', icon: <Mic className="h-4 w-4" /> },
      { tab: 'personality', label: 'Personalization', icon: <IconMask icon="/icons/personalization.svg" source="local" className="h-4 w-4" /> }
    ]
  }
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
  const mobileDetailRef = useRef<HTMLElement>(null);
  const mobileSwipeBackRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    velocityX: number;
    axis: 'none' | 'x' | 'y';
  } | null>(null);

  // tab data
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(() => loadGeneralSettings());
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>(() => loadAppearanceSettings());
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ name: '', username: '', avatar: '', plan: '', age: '18 or older' });
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
        charVisualAnswers: data.charVisualAnswers || 'default',
        aboutName: data.aboutName || '',
        aboutOccupation: data.aboutOccupation || '',
        aboutMore: data.aboutMore || '',
        memoryReferenceSaved: data.memoryReferenceSaved ?? true,
        memoryReferenceHistory: data.memoryReferenceHistory ?? true,
        suggestedPrompts: data.suggestedPrompts ?? true,
        librarySearch: data.librarySearch ?? true,
        referencePhoto: data.referencePhoto || '',
        fullBodyReferencePhoto: data.fullBodyReferencePhoto || ''
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

  // GSAP mobile detail panel slide entrance (< 640px)
  useEffect(() => {
    if (!isOpen || !isMobileDetailOpen || typeof window === 'undefined' || window.innerWidth >= 640) return;
    const detailEl = mobileDetailRef.current;
    if (!detailEl || prefersReducedMotion()) return;
    gsap.fromTo(
      detailEl,
      { x: '100%' },
      { x: 0, duration: 0.3, ease: 'expo.out', clearProps: 'transform' }
    );
  }, [isOpen, isMobileDetailOpen]);

  const openMobileTab = (tab: SettingsTab) => {
    clearTimeout(mobileTimerRef.current);
    mobileTimerRef.current = undefined;
    setActiveTab(tab);
    setIsMobileDetailClosing(false);
    setIsMobileDetailOpen(true);
  };

  const backToMobileMenu = useCallback(() => {
    if (isMobileDetailClosing) return;
    const detailEl = mobileDetailRef.current;
    if (!detailEl || prefersReducedMotion() || (typeof window !== 'undefined' && window.innerWidth >= 640)) {
      setIsMobileDetailOpen(false);
      setIsMobileDetailClosing(false);
      return;
    }
    setIsMobileDetailClosing(true);
    gsap.to(detailEl, {
      x: '100%',
      duration: 0.24,
      ease: 'power3.in',
      onComplete: () => {
        setIsMobileDetailOpen(false);
        setIsMobileDetailClosing(false);
        gsap.set(detailEl, { clearProps: 'transform' });
      },
    });
  }, [isMobileDetailClosing]);

  const handleMobileTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined' || window.innerWidth >= 640 || e.touches.length !== 1) return;
    if (cropImage || isSharedLinksOpen || isArchivedOpen || isMemoriesOpen || confirm) return;
    const t = e.touches[0];
    if (t.clientX > 32) return;
    mobileSwipeBackRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      lastX: t.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      axis: 'none',
    };
  };

  const handleMobileTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const drag = mobileSwipeBackRef.current;
    if (!drag || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - drag.startX;
    const dy = t.clientY - drag.startY;

    if (drag.axis === 'none') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.35 && dx > 0) {
        drag.axis = 'x';
      } else {
        mobileSwipeBackRef.current = null;
        return;
      }
    }

    const now = performance.now();
    const dt = Math.max(1, now - drag.lastTime);
    drag.velocityX = (t.clientX - drag.lastX) / dt;
    drag.lastX = t.clientX;
    drag.lastTime = now;

    const targetEl = isMobileDetailOpen ? mobileDetailRef.current : modalRef.current;
    if (targetEl) {
      gsap.set(targetEl, { x: Math.max(0, dx) });
    }
  };

  const handleMobileTouchEnd = () => {
    const drag = mobileSwipeBackRef.current;
    mobileSwipeBackRef.current = null;
    if (!drag || drag.axis !== 'x') return;

    const dx = Math.max(0, drag.lastX - drag.startX);
    const targetEl = isMobileDetailOpen ? mobileDetailRef.current : modalRef.current;
    if (!targetEl) return;

    if (dx > 88 || drag.velocityX > 0.42) {
      triggerSubtleHaptic(6);
      if (isMobileDetailOpen) {
        backToMobileMenu();
      } else {
        gsap.to(targetEl, {
          x: '100%',
          duration: prefersReducedMotion() ? 0.01 : 0.22,
          ease: 'power3.in',
          onComplete: () => {
            onClose();
            onBackToSidebar?.();
          },
        });
      }
    } else {
      gsap.to(targetEl, {
        x: 0,
        duration: prefersReducedMotion() ? 0.01 : 0.28,
        ease: 'expo.out',
        clearProps: 'transform',
      });
    }
  };

  // general, appearance, profile, persona
  const updateGeneral = (patch: Partial<GeneralSettings>) => setGeneralSettings(prev => saveGeneralSettings({ ...prev, ...patch }));
  const updateAppearance = (patch: Partial<AppearanceSettings>) => setAppearanceSettings(prev => saveAppearanceSettings({ ...prev, ...patch }));
  const updatePersona = (patch: Partial<PersonaState>) => setPersona(prev => ({ ...prev, ...patch }));

  const updateProfilePatch = async (patch: Partial<UserProfile>) => {
    const nextProfile = { ...profile, ...patch };
    setProfile(nextProfile);
    try {
      await saveUserProfile(nextProfile);
      window.dispatchEvent(new Event('profileUpdated'));
    } catch {
      toast.error('Failed to update account');
    }
  };

  const deleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await Promise.all([
        deleteAllChats().catch(() => {}),
        clearSavedMemories().catch(() => {})
      ]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('deepchat-user-profile');
        localStorage.removeItem('deepchat-general-settings');
        localStorage.removeItem('deepchat-appearance-settings');
      }
      const resetProfile: UserProfile = { name: 'Guest', username: '', avatar: '', plan: '', age: '18 or older' };
      await saveUserProfile(resetProfile);
      setProfile(resetProfile);
      window.dispatchEvent(new Event('chatUpdated'));
      window.dispatchEvent(new Event('profileUpdated'));
      toast.success('Account and local data deleted');
      onClose();
      router.push('/');
    } catch {
      toast.error('Failed to delete account');
    }
    setIsDeletingAccount(false);
  };

  const saveProfile = async () => {
    try {
      await saveUserProfile(profile);
      window.dispatchEvent(new Event('profileUpdated'));
      toast.success('Profile saved successfully!');
    } catch {
      toast.error('Failed to save profile');
    }
  };

  const savePersonaDraft = async (nextPersona?: PersonaState) => {
    setIsSavingPersona(true);
    try {
      await savePersona(nextPersona ?? persona);
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

  const updateToolFeatures = (patch: Partial<Pick<ToolSettings, 'searchEnabled' | 'urlContextEnabled'>>) => setToolSettings(updateToolFeatureSettings(patch));

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
    GeneralTab: {
      settings: generalSettings,
      appearanceSettings,
      onChange: updateGeneral,
      onChangeAppearance: updateAppearance
    },
    AppearanceTab: {
      settings: appearanceSettings,
      onChange: updateAppearance
    },
    AccountTab: {
      profile,
      isLoading: isProfileLoading,
      onUpdateProfile: updateProfilePatch,
      onDeleteAccount: deleteAccount,
      isDeletingAccount
    },
    ProfileTab: { profile, isLoading: isProfileLoading, setProfile, onSave: saveProfile, onAvatarPicked: pickAvatar, fileInputRef },
    PersonalizationTab: {
      persona,
      onChange: updatePersona,
      isLoading: isPersonaLoading,
      isSaving: isSavingPersona,
      onSave: savePersonaDraft,
      onOpenMemories: openMemories,
      onOpenMemoryDocs: () => router.push('/docs/memory'),
      webSearchEnabled: toolSettings.searchEnabled,
      onToggleWebSearch: (enabled: boolean) => updateToolFeatures({ searchEnabled: enabled })
    },
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
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onTouchStart={handleMobileTouchStart}
        onTouchMove={handleMobileTouchMove}
        onTouchEnd={handleMobileTouchEnd}
        onTouchCancel={handleMobileTouchEnd}
        className="settings-root-panel deepchat-mobile-settings-light relative flex h-dvh w-full flex-col overflow-hidden bg-[var(--dc-panel)] text-[var(--dc-text)] shadow-xl will-change-transform sm:h-[min(90dvh,740px)] sm:max-w-[920px] sm:flex-row sm:rounded-3xl sm:border sm:border-[var(--dc-border)] dark:shadow-2xl dark:shadow-black/50"
        onClick={event => event.stopPropagation()}
      >
        <MobileSettingsHome profile={profile} onClose={closeToSidebar} onOpenTab={openMobileTab} hidden={isMobileDetailOpen && !isMobileDetailClosing} />

        {/* Desktop Sidebar Navigation (matches screenshot 1 & 2) */}
        <nav className="hidden shrink-0 flex-col border-b border-[var(--dc-border-subtle)] bg-[var(--dc-sidebar)] p-4 sm:flex sm:w-64 sm:border-b-0 sm:border-r sm:p-4">
          <h2 className="mb-3 px-2 text-[17px] font-semibold text-[var(--dc-text-strong)]">
            Settings
          </h2>

          {/* Search box */}
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dc-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search settings"
              className="h-9 w-full rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] pl-9 pr-3 text-sm text-[var(--dc-text-strong)] outline-none placeholder:text-[var(--dc-text-placeholder)] focus:border-[var(--dc-border-strong)]"
            />
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto custom-scrollbar pr-0.5">
            {/* Profile link -> /profile */}
            {(!searchQuery.trim() || 'profile'.includes(searchQuery.trim().toLowerCase()) || (profile.name || 'guest').toLowerCase().includes(searchQuery.trim().toLowerCase())) && (
              <div>
                <p className="mb-1.5 px-2 text-xs font-medium text-[var(--dc-text-muted)]">Profile</p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push('/profile');
                  }}
                  className="group flex w-full items-center justify-between gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--dc-surface-hover)]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {profile.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={profile.name || 'Profile'}
                        className="h-6 w-6 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[11px] font-semibold text-white">
                        {(profile.name || 'G').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="truncate text-sm font-medium text-[var(--dc-text-strong)]">
                      {profile.name || 'Guest'}
                    </span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--dc-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--dc-text-strong)]" />
                </button>
              </div>
            )}

            {/* Account & App Sections */}
            {desktopSections.map(section => {
              const q = searchQuery.trim().toLowerCase();
              const filteredItems = q
                ? section.items.filter(item => item.label.toLowerCase().includes(q) || section.title.toLowerCase().includes(q))
                : section.items;
              if (filteredItems.length === 0) return null;

              return (
                <div key={section.title}>
                  <p className="mb-1.5 px-2 text-xs font-medium text-[var(--dc-text-muted)]">
                    {section.title}
                  </p>
                  <div className="space-y-0.5">
                    {filteredItems.map(item => {
                      const isActive = activeTab === item.tab;
                      return (
                        <button
                          key={item.tab}
                          type="button"
                          onClick={() => setActiveTab(item.tab)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${
                            isActive
                              ? 'bg-[var(--dc-fill)] font-medium text-[var(--dc-text-strong)]'
                              : 'text-[var(--dc-text)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]'
                          }`}
                        >
                          <span className="shrink-0 text-[var(--dc-text-muted)]">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Desktop Content Panel */}
        <section
          ref={mobileDetailRef}
          key={isMobileDetailOpen ? activeTab : 'settings-content'}
          className={`${isMobileDetailOpen ? `settings-mobile-detail-panel ${isMobileDetailClosing ? 'settings-mobile-detail-panel-closing' : ''} flex` : 'hidden'} absolute inset-0 z-10 min-h-0 flex-1 flex-col bg-[var(--dc-panel)] sm:relative sm:inset-auto sm:z-auto sm:flex`}
        >
          <button
            onClick={close}
            className="absolute right-4 top-4 z-10 hidden rounded-full p-2 text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)] sm:right-5 sm:top-5 sm:block"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Unified Mobile Settings Detail Header */}
          <div className="dc-mob-navbar flex min-h-[56px] shrink-0 items-center justify-between px-2 pt-[env(safe-area-inset-top)] sm:hidden">
            <button
              type="button"
              onClick={backToMobileMenu}
              aria-label="Back to settings menu"
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--dc-text-strong)] transition-transform active:scale-90 hover:bg-[var(--dc-fill)]"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <h3 className="truncate px-2 text-center text-[16px] font-semibold leading-none text-[var(--dc-text-strong)]">
              {getMobileTabTitle(activeTab)}
            </h3>
            <div className="h-11 w-11 shrink-0" aria-hidden="true" />
          </div>

          <div ref={contentRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar sm:px-10 sm:py-8 will-change-transform">
            {activeTab === 'account' && <AccountTab {...children.AccountTab} />}
            {activeTab === 'usage' && <UsageTab />}
            {activeTab === 'general' && <GeneralTab {...children.GeneralTab} />}
            {activeTab === 'appearance' && <AppearanceTab {...children.AppearanceTab} />}
            {activeTab === 'voice' && <VoiceTab settings={generalSettings} onChange={updateGeneral} />}
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
