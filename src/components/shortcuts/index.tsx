'use client';

import React, { useEffect, useState } from 'react';
import {
  defaultKeyboardSettings,
  formatShortcutKeys,
  loadKeyboardSettings,
  matchesShortcutBinding,
  subscribeKeyboardSettings,
  type KeyboardSettings,
  type KeyboardShortcutId
} from '@/lib/settings/keyboard-settings';

type ShortcutId = KeyboardShortcutId;
type ShortcutPlatform = 'apple' | 'default';
export type ShortcutLabels = Record<ShortcutId, string[]>;

const getPlatform = (): ShortcutPlatform => {
  if (typeof navigator === 'undefined') return 'default';
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? 'apple' : 'default';
};

const toShortcutLabels = (settings: KeyboardSettings, platform: ShortcutPlatform): ShortcutLabels => ({
  newChat: formatShortcutKeys(settings.newChat, platform),
  branchChat: formatShortcutKeys(settings.branchChat, platform),
  sendInBackground: formatShortcutKeys(settings.sendInBackground, platform),
  dictation: formatShortcutKeys(settings.dictation, platform),
  search: formatShortcutKeys(settings.search, platform),
  uploadFile: formatShortcutKeys(settings.uploadFile, platform),
  selectModel: formatShortcutKeys(settings.selectModel, platform),
  toggleSidebar: formatShortcutKeys(settings.toggleSidebar, platform),
  openSettings: formatShortcutKeys(settings.openSettings, platform)
});

export function useShortcutLabels(): ShortcutLabels {
  const [labels, setLabels] = useState<ShortcutLabels>(() =>
    toShortcutLabels(defaultKeyboardSettings, 'default')
  );

  useEffect(() => {
    const sync = (settings?: KeyboardSettings) => {
      setLabels(toShortcutLabels(settings ?? loadKeyboardSettings(), getPlatform()));
    };
    sync();
    return subscribeKeyboardSettings(next => sync(next));
  }, []);

  return labels;
}

export function isShortcutEvent(event: KeyboardEvent, shortcut: ShortcutId) {
  const settings = loadKeyboardSettings();
  return matchesShortcutBinding(event, settings[shortcut], getPlatform());
}

export function ShortcutCombo({ keys, tone = 'light' }: { keys: string[]; tone?: 'light' | 'dark' }) {
  if (keys.length === 0) return null;
  const className = tone === 'dark'
    ? 'bg-indigo-500/50 text-indigo-100 border border-indigo-400/30'
    : 'bg-white text-slate-400 border border-slate-200 shadow-sm dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key) => (
        <span key={key} className={`rounded-lg px-2 py-0.5 text-[11px] font-bold leading-5 ${className}`}>
          {key}
        </span>
      ))}
    </span>
  );
}
