'use client';

import React, { useEffect, useState } from 'react';
import { ChevronRight, Loader2, X } from '@/components/ui/icons';
import ToggleSwitch from '@/components/ui/ToggleSwitch';

interface DataTabProps {
  isExporting: boolean;
  isArchivingAll: boolean;
  isDeletingChats: boolean;
  onOpenSharedLinks: () => void;
  onOpenArchivedChats: () => void;
  onArchiveAll: () => void;
  onExport: () => void;
  onDeleteAllChats: () => void;
}

interface DataControlsPrefs {
  improveModel: boolean;
  locationEnabled: boolean;
  analyticsCookies: boolean;
  functionalCookies: boolean;
}

const PREFS_KEY = 'deepchat-data-controls';

const defaultPrefs: DataControlsPrefs = {
  improveModel: false,
  locationEnabled: false,
  analyticsCookies: false,
  functionalCookies: true
};

function loadPrefs(): DataControlsPrefs {
  if (typeof window === 'undefined') return defaultPrefs;
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return defaultPrefs;
    return {
      improveModel: Boolean(parsed.improveModel),
      locationEnabled: Boolean(parsed.locationEnabled),
      analyticsCookies: Boolean(parsed.analyticsCookies),
      functionalCookies: parsed.functionalCookies !== false
    };
  } catch {
    return defaultPrefs;
  }
}

export function DataTab({
  isExporting,
  isArchivingAll,
  isDeletingChats,
  onOpenSharedLinks,
  onOpenArchivedChats,
  onArchiveAll,
  onExport,
  onDeleteAllChats
}: DataTabProps) {
  const [prefs, setPrefs] = useState<DataControlsPrefs>(defaultPrefs);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const updatePrefs = (patch: Partial<DataControlsPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      if (typeof window !== 'undefined') {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleToggleLocation = () => {
    if (prefs.locationEnabled) {
      updatePrefs({ locationEnabled: false });
      return;
    }
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => updatePrefs({ locationEnabled: true }),
        () => updatePrefs({ locationEnabled: true }),
        { timeout: 5000 }
      );
    } else {
      updatePrefs({ locationEnabled: true });
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h3 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">Data controls</h3>
        <p className="mt-1 text-sm text-[var(--dc-text-muted)]">
          Manage your chat history and choose how DeepChat uses your data
        </p>
      </header>

      <div className="divide-y divide-[var(--dc-border-subtle)] border-t border-[var(--dc-border-subtle)]">
        {/* Shared links */}
        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Shared links</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              Review links you&apos;ve created to share chats
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSharedLinks}
            className="shrink-0 rounded-full bg-[var(--dc-fill)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)]"
          >
            Manage
          </button>
        </div>

        {/* Improve the model for everyone */}
        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Improve the model for everyone</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              Control whether your chats are used for model training
            </p>
          </div>
          <ToggleSwitch
            size="mobile"
            ariaLabel="Improve the model for everyone"
            checked={prefs.improveModel}
            onChange={checked => updatePrefs({ improveModel: checked })}
          />
        </div>

        {/* Location */}
        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Location</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              When enabled, your location helps DeepChat provide more relevant local recommendations, news, and weather.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleLocation}
            className="shrink-0 rounded-full bg-[var(--dc-fill)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)]"
          >
            {prefs.locationEnabled ? 'Turn off' : 'Turn on'}
          </button>
        </div>

        {/* Archived chats (navigates to Archived chats tab) */}
        <button
          type="button"
          onClick={onOpenArchivedChats}
          className="flex w-full items-center justify-between gap-6 py-4 text-left transition-colors hover:bg-[var(--dc-surface-hover)]/50"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Archived chats</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              Review or restore chats you&apos;ve archived
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--dc-text-muted)]" />
        </button>

        {/* Archive all chats */}
        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Archive all chats</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              Move your chats to Archived chats so you can restore them later
            </p>
          </div>
          <button
            type="button"
            disabled={isArchivingAll}
            onClick={onArchiveAll}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--dc-fill)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)] disabled:opacity-50"
          >
            {isArchivingAll && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Archive all</span>
          </button>
        </div>

        {/* Delete all chats */}
        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Delete all chats</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              Permanently delete all your chats
            </p>
          </div>
          <button
            type="button"
            disabled={isDeletingChats}
            onClick={onDeleteAllChats}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-50 px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/25"
          >
            {isDeletingChats && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Delete all</span>
          </button>
        </div>

        {/* Export data */}
        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Export data</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              Download your chats, profile, memories, and settings as JSON
            </p>
          </div>
          <button
            type="button"
            disabled={isExporting}
            onClick={onExport}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--dc-fill)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)] disabled:opacity-50"
          >
            {isExporting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Export</span>
          </button>
        </div>

        {/* Cookie preferences */}
        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Cookie preferences</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              Manage your cookie and local storage preferences
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCookieModalOpen(true)}
            className="shrink-0 rounded-full bg-[var(--dc-fill)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)]"
          >
            Manage
          </button>
        </div>
      </div>

      {/* Cookie Preferences modal */}
      {isCookieModalOpen && (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={() => setIsCookieModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cookie preferences"
            className="w-full max-w-md rounded-3xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-6 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-[var(--dc-text-strong)]">Cookie preferences</h3>
              <button
                type="button"
                onClick={() => setIsCookieModalOpen(false)}
                aria-label="Close cookie preferences"
                className="rounded-full p-1 text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 divide-y divide-[var(--dc-border-subtle)]">
              <div className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--dc-text-strong)]">Essential storage</p>
                  <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                    Required for core chat, session, and theme functionality
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-[var(--dc-text-muted)]">Always on</span>
              </div>

              <div className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--dc-text-strong)]">Functional preferences</p>
                  <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                    Remembers UI layout, shortcuts, and model selections
                  </p>
                </div>
                <ToggleSwitch
                  size="mobile"
                  ariaLabel="Functional preferences"
                  checked={prefs.functionalCookies}
                  onChange={checked => updatePrefs({ functionalCookies: checked })}
                />
              </div>

              <div className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--dc-text-strong)]">Analytics</p>
                  <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                    Helps improve performance and reliability
                  </p>
                </div>
                <ToggleSwitch
                  size="mobile"
                  ariaLabel="Analytics cookies"
                  checked={prefs.analyticsCookies}
                  onChange={checked => updatePrefs({ analyticsCookies: checked })}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCookieModalOpen(false)}
                className="rounded-full bg-[var(--dc-invert)] px-4 py-2 text-sm font-medium text-[var(--dc-text-on-invert)] transition-opacity hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
