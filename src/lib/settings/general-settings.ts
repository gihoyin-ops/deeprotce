'use client';

import { LANGUAGE_OPTIONS } from './languages';

export type SendMessageKey = 'enter' | 'mod-enter';

export interface GeneralSettings {
  language: string;
  sendMessageKey: SendMessageKey;
  dictationEnabled: boolean;
}

export const SEND_MESSAGE_OPTIONS = [
  { label: 'Enter', value: 'enter', description: 'Enter sends, Shift + Enter adds a new line' },
  { label: 'Ctrl + Enter', value: 'mod-enter', description: 'Ctrl/Cmd + Enter sends, Enter adds a new line' }
];

export const defaultGeneralSettings: GeneralSettings = {
  language: 'auto',
  sendMessageKey: 'enter',
  dictationEnabled: true
};

const SETTINGS_KEY = 'deepchat-general-settings';
const SETTINGS_EVENT = 'deepchat:general-settings-updated';
const validSendKeys = new Set<string>(SEND_MESSAGE_OPTIONS.map(option => option.value));
const validLanguages = new Set<string>(LANGUAGE_OPTIONS.map(option => option.value));
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object');

const normalizeSettings = (settings: unknown): GeneralSettings => {
  if (!isRecord(settings)) return defaultGeneralSettings;
  return {
    language: typeof settings.language === 'string' && validLanguages.has(settings.language) ? settings.language : defaultGeneralSettings.language,
    sendMessageKey: typeof settings.sendMessageKey === 'string' && validSendKeys.has(settings.sendMessageKey) ? settings.sendMessageKey as SendMessageKey : defaultGeneralSettings.sendMessageKey,
    dictationEnabled: typeof settings.dictationEnabled === 'boolean' ? settings.dictationEnabled : defaultGeneralSettings.dictationEnabled
  };
};

export const applyGeneralSettings = (settings: GeneralSettings) => {
  if (typeof document === 'undefined') return;
  const normalized = normalizeSettings(settings);
  document.documentElement.dataset.language = normalized.language;
};

export const loadGeneralSettings = () => {
  if (typeof window === 'undefined') return defaultGeneralSettings;
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'));
  } catch {
    return defaultGeneralSettings;
  }
};

export const saveGeneralSettings = (settings: GeneralSettings) => {
  const normalized = normalizeSettings(settings);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  applyGeneralSettings(normalized);
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: normalized }));
  return normalized;
};

export const subscribeGeneralSettings = (listener: (settings: GeneralSettings) => void) => {
  const handler = (event: Event) => {
    if (event instanceof CustomEvent) {
      listener(normalizeSettings(event.detail));
    }
  };
  window.addEventListener(SETTINGS_EVENT, handler);
  return () => window.removeEventListener(SETTINGS_EVENT, handler);
};

export const getDictationLanguage = (settings: GeneralSettings) => {
  if (settings.language !== 'auto') return settings.language;
  if (typeof navigator === 'undefined') return 'en-US';
  return navigator.language || 'en-US';
};
