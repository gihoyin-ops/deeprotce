'use client';

export type KeyboardShortcutId =
  | 'newChat'
  | 'branchChat'
  | 'sendInBackground'
  | 'dictation'
  | 'search'
  | 'uploadFile'
  | 'selectModel'
  | 'toggleSidebar'
  | 'openSettings';

export type KeyboardCategory = 'Chat' | 'Voice' | 'Navigation' | 'Other';

export interface ShortcutBinding {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string; // lowercase key name e.g. 'k', 'enter', ','
}

export interface KeyboardShortcutMeta {
  id: KeyboardShortcutId;
  label: string;
  description: string;
  category: KeyboardCategory;
  defaultBinding: ShortcutBinding | null;
}

export type KeyboardSettings = Record<KeyboardShortcutId, ShortcutBinding | null>;

export const KEYBOARD_SHORTCUT_CATALOG: KeyboardShortcutMeta[] = [
  {
    id: 'newChat',
    label: 'New chat',
    description: 'Start a new chat',
    category: 'Chat',
    defaultBinding: { mod: true, shift: false, alt: false, key: 'k' }
  },
  {
    id: 'branchChat',
    label: 'Branch chat',
    description: 'Branch the current chat',
    category: 'Chat',
    defaultBinding: null
  },
  {
    id: 'sendInBackground',
    label: 'Send message in background',
    description: 'Send the current composer message without opening its chat',
    category: 'Chat',
    defaultBinding: { mod: true, shift: false, alt: false, key: 'enter' }
  },
  {
    id: 'dictation',
    label: 'Dictation',
    description: 'Toggle voice input in the chat composer',
    category: 'Voice',
    defaultBinding: { mod: true, shift: true, alt: false, key: 'd' }
  },
  {
    id: 'search',
    label: 'Search chats',
    description: 'Search your conversation history',
    category: 'Navigation',
    defaultBinding: { mod: true, shift: false, alt: false, key: 'f' }
  },
  {
    id: 'toggleSidebar',
    label: 'Toggle sidebar',
    description: 'Show or collapse the navigation sidebar',
    category: 'Navigation',
    defaultBinding: null
  },
  {
    id: 'openSettings',
    label: 'Open settings',
    description: 'Open Benthos settings',
    category: 'Navigation',
    defaultBinding: { mod: true, shift: false, alt: false, key: ',' }
  },
  {
    id: 'uploadFile',
    label: 'Upload file',
    description: 'Attach a file to your prompt',
    category: 'Other',
    defaultBinding: { mod: true, shift: false, alt: false, key: 'u' }
  },
  {
    id: 'selectModel',
    label: 'Select model',
    description: 'Switch the active AI model',
    category: 'Other',
    defaultBinding: { mod: true, shift: true, alt: false, key: 'm' }
  }
];

export const defaultKeyboardSettings: KeyboardSettings = KEYBOARD_SHORTCUT_CATALOG.reduce(
  (acc, item) => {
    acc[item.id] = item.defaultBinding;
    return acc;
  },
  {} as KeyboardSettings
);

const SETTINGS_KEY = 'deepchat-keyboard-settings';
export const KEYBOARD_SETTINGS_EVENT = 'deepchat:keyboard-settings-updated';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object');

const normalizeBinding = (raw: unknown, fallback: ShortcutBinding | null): ShortcutBinding | null => {
  if (raw === null) return null;
  if (!isRecord(raw) || typeof raw.key !== 'string' || !raw.key.trim()) return fallback;
  return {
    mod: Boolean(raw.mod),
    shift: Boolean(raw.shift),
    alt: Boolean(raw.alt),
    key: raw.key.trim().toLowerCase()
  };
};

const normalizeKeyboardSettings = (raw: unknown): KeyboardSettings => {
  if (!isRecord(raw)) return { ...defaultKeyboardSettings };
  const result = { ...defaultKeyboardSettings };
  for (const item of KEYBOARD_SHORTCUT_CATALOG) {
    if (Object.prototype.hasOwnProperty.call(raw, item.id)) {
      result[item.id] = normalizeBinding(raw[item.id], item.defaultBinding);
    }
  }
  return result;
};

export const loadKeyboardSettings = (): KeyboardSettings => {
  if (typeof window === 'undefined') return { ...defaultKeyboardSettings };
  try {
    return normalizeKeyboardSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'));
  } catch {
    return { ...defaultKeyboardSettings };
  }
};

export const saveKeyboardSettings = (settings: KeyboardSettings): KeyboardSettings => {
  const normalized = normalizeKeyboardSettings(settings);
  if (typeof window !== 'undefined') {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(KEYBOARD_SETTINGS_EVENT, { detail: normalized }));
  }
  return normalized;
};

export const resetKeyboardSettings = (): KeyboardSettings => saveKeyboardSettings({ ...defaultKeyboardSettings });

export const subscribeKeyboardSettings = (listener: (settings: KeyboardSettings) => void) => {
  const handler = (event: Event) => {
    if (event instanceof CustomEvent) {
      listener(normalizeKeyboardSettings(event.detail));
    }
  };
  window.addEventListener(KEYBOARD_SETTINGS_EVENT, handler);
  return () => window.removeEventListener(KEYBOARD_SETTINGS_EVENT, handler);
};

export const formatShortcutKeyLabel = (key: string): string => {
  if (key === 'enter') return '↵';
  if (key === ' ') return 'Space';
  if (key === 'escape') return 'Esc';
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
};

export const formatShortcutKeys = (
  binding: ShortcutBinding | null,
  platform: 'apple' | 'default' = 'default'
): string[] => {
  if (!binding) return [];
  const keys: string[] = [];
  if (binding.mod) keys.push(platform === 'apple' ? 'Cmd' : 'Ctrl');
  if (binding.alt) keys.push(platform === 'apple' ? 'Option' : 'Alt');
  if (binding.shift) keys.push('Shift');
  keys.push(formatShortcutKeyLabel(binding.key));
  return keys;
};

export const matchesShortcutBinding = (
  event: KeyboardEvent,
  binding: ShortcutBinding | null,
  platform: 'apple' | 'default'
): boolean => {
  if (!binding) return false;
  const modPressed = platform === 'apple' ? event.metaKey : event.ctrlKey;
  if (Boolean(binding.mod) !== modPressed) return false;
  if (Boolean(binding.shift) !== event.shiftKey) return false;
  if (Boolean(binding.alt) !== event.altKey) return false;
  return event.key.toLowerCase() === binding.key.toLowerCase();
};
