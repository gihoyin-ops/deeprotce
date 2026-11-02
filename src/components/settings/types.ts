// shared settings modal types

export type SettingsTab = 'general' | 'profile' | 'personality' | 'notifications' | 'tools' | 'agent' | 'data' | 'storage';

export type CropArea = { x: number; y: number; width: number; height: number };

export interface UserProfile {
  id?: string;
  name: string;
  avatar: string;
  plan: string;
}

export interface SharedLinkItem {
  id: string;
  title: string;
  shareId: string;
  createdAt: string;
  messageCount: number;
}

export interface ArchivedChatItem {
  id: string;
  title: string;
  createdAt: string;
  messages?: unknown[];
}

export type ConfirmAction = 'deleteChats' | 'deleteConnections';

export interface ConfirmDialogState {
  action: ConfirmAction;
  title: string;
  description: string;
  confirmLabel: string;
}

export type SettingsIconSource = 'iconify' | 'local';

export interface MobileSettingsMenuItem {
  tab: SettingsTab;
  label: string;
  icon: string;
  source: SettingsIconSource;
}

export interface MobileSettingsMenuSection {
  title: string;
  items: MobileSettingsMenuItem[];
}

export interface StorageState {
  usage: number | null;
  quota: number | null;
  localItems: number;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToSidebar?: () => void;
  initialTab?: SettingsTab;
}

// personalization draft state
export interface PersonaState {
  instructions: string;
  styleTone: string;
  charWarm: string;
  charEnthusiastic: string;
  charHeaders: string;
  charEmoji: string;
  aboutName: string;
  aboutOccupation: string;
  aboutMore: string;
  memoryReferenceSaved: boolean;
  memoryReferenceHistory: boolean;
}
