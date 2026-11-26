'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, RefreshCw, Search, Trash2 } from '@/components/ui/icons';
import Tooltip from '@/components/ui/Tooltip';
import { SEND_MESSAGE_OPTIONS, type GeneralSettings } from '@/lib/settings/general-settings';
import {
  formatShortcutKeys,
  KEYBOARD_SHORTCUT_CATALOG,
  type KeyboardCategory,
  type KeyboardSettings,
  type KeyboardShortcutId,
  type ShortcutBinding
} from '@/lib/settings/keyboard-settings';
import { PillDropdown } from '../PillDropdown';

interface KeyboardTabProps {
  settings: KeyboardSettings;
  generalSettings: GeneralSettings;
  onChangeShortcut: (id: KeyboardShortcutId, binding: ShortcutBinding | null) => void;
  onResetAll: () => void;
  onChangeGeneral: (patch: Partial<GeneralSettings>) => void;
}

const CATEGORIES: Array<'All' | KeyboardCategory> = ['All', 'Chat', 'Voice', 'Navigation', 'Other'];
const MODIFIER_ONLY_KEYS = new Set(['control', 'meta', 'shift', 'alt', 'os', 'super']);

export function KeyboardTab({
  settings,
  generalSettings,
  onChangeShortcut,
  onResetAll,
  onChangeGeneral
}: KeyboardTabProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | KeyboardCategory>('All');
  const [recordingId, setRecordingId] = useState<KeyboardShortcutId | null>(null);
  const [platform, setPlatform] = useState<'apple' | 'default'>('default');

  useEffect(() => {
    if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform)) {
      setPlatform('apple');
    }
  }, []);

  useEffect(() => {
    if (!recordingId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const key = event.key.toLowerCase();
      if (key === 'escape') {
        setRecordingId(null);
        return;
      }
      if (MODIFIER_ONLY_KEYS.has(key)) return;

      const mod = platform === 'apple' ? event.metaKey : event.ctrlKey;
      const binding: ShortcutBinding = {
        mod,
        shift: event.shiftKey,
        alt: event.altKey,
        key
      };
      onChangeShortcut(recordingId, binding);
      setRecordingId(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recordingId, platform, onChangeShortcut]);

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visibleCategories = activeCategory === 'All'
      ? (['Chat', 'Voice', 'Navigation', 'Other'] as KeyboardCategory[])
      : [activeCategory];

    return visibleCategories
      .map(category => {
        const items = KEYBOARD_SHORTCUT_CATALOG.filter(item => {
          if (item.category !== category) return false;
          if (!q) return true;
          return (
            item.label.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            category.toLowerCase().includes(q)
          );
        });
        const showSendMessage =
          category === 'Chat' &&
          (!q || 'send message'.includes(q) || 'enter'.includes(q));
        return { category, items, showSendMessage };
      })
      .filter(section => section.items.length > 0 || section.showSendMessage);
  }, [activeCategory, search]);

  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">Keyboard</h3>
        <p className="mt-1 text-sm text-[var(--dc-text-muted)]">Review and change keyboard shortcuts</p>
      </header>

      {/* Search bar and reset all button */}
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[var(--dc-text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search shortcuts"
          aria-label="Search shortcuts"
          className="h-10 w-full rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] pl-10 pr-11 text-sm text-[var(--dc-text-strong)] outline-none placeholder:text-[var(--dc-text-placeholder)] focus:border-[var(--dc-border-strong)]"
        />
        <div className="absolute right-2">
          <Tooltip label="Reset all shortcuts" side="top" align="end">
            <button
              type="button"
              onClick={onResetAll}
              aria-label="Reset all shortcuts"
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Category filter pills so you don't have to scroll forever */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map(category => {
          const active = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-[var(--dc-invert)] text-[var(--dc-text-on-invert)]'
                  : 'border border-[var(--dc-border)] bg-[var(--dc-surface)] text-[var(--dc-text)] hover:bg-[var(--dc-surface-hover)]'
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* Grouped shortcut sections */}
      <div className="space-y-8 pt-1">
        {filteredSections.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--dc-text-muted)]">
            No shortcuts match your search.
          </p>
        ) : (
          filteredSections.map(section => (
            <section key={section.category}>
              <h4 className="border-b border-[var(--dc-border-subtle)] pb-3 text-sm font-semibold text-[var(--dc-text-strong)]">
                {section.category}
              </h4>

              <div className="divide-y divide-[var(--dc-border-subtle)]">
                {section.showSendMessage && (
                  <div className="flex items-center justify-between gap-6 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--dc-text-strong)]">Send message</p>
                      <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                        Choose when Enter sends a prompt or inserts a new line
                      </p>
                    </div>
                    <PillDropdown
                      value={generalSettings.sendMessageKey}
                      options={SEND_MESSAGE_OPTIONS}
                      onChange={value =>
                        onChangeGeneral({ sendMessageKey: value as GeneralSettings['sendMessageKey'] })
                      }
                      ariaLabel="Send message key"
                    />
                  </div>
                )}

                {section.items.map(item => {
                  const binding = settings[item.id];
                  const keys = formatShortcutKeys(binding, platform);
                  const isRecording = recordingId === item.id;
                  const comboLabel = keys.join('+');

                  return (
                    <div key={item.id} className="flex items-center justify-between gap-6 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--dc-text-strong)]">{item.label}</p>
                        <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">{item.description}</p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {isRecording ? (
                          <span className="animate-pulse rounded-md border border-blue-500 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                            Press keys… (Esc)
                          </span>
                        ) : keys.length > 0 ? (
                          <span className="rounded-md bg-[var(--dc-fill)] px-2.5 py-1 font-mono text-xs font-medium text-[var(--dc-text-strong)]">
                            {comboLabel}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--dc-text-muted)]">Unassigned</span>
                        )}

                        <Tooltip label={isRecording ? 'Cancel' : 'Edit shortcut'} side="top">
                          <button
                            type="button"
                            onClick={() => setRecordingId(isRecording ? null : item.id)}
                            aria-label={`Edit ${item.label} shortcut`}
                            className={`rounded-full p-1.5 transition-colors ${
                              isRecording
                                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                : 'text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]'
                            }`}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>

                        {keys.length > 0 && !isRecording && (
                          <Tooltip label="Clear shortcut" side="top">
                            <button
                              type="button"
                              onClick={() => onChangeShortcut(item.id, null)}
                              aria-label={`Clear ${item.label} shortcut`}
                              className="rounded-full p-1.5 text-[var(--dc-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
