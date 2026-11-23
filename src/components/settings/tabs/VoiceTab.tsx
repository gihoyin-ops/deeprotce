'use client';

import React from 'react';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import type { GeneralSettings } from '@/lib/settings/general-settings';

interface VoiceTabProps {
  settings: GeneralSettings;
  onChange: (patch: Partial<GeneralSettings>) => void;
}

export function VoiceTab({ settings, onChange }: VoiceTabProps) {
  return (
    <div className="space-y-8">
      <header>
        <h3 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">Voice</h3>
        <p className="mt-1 text-sm text-[var(--dc-text-muted)]">Manage voice input and dictation preferences</p>
      </header>

      <section>
        <h4 className="border-b border-[var(--dc-border-subtle)] pb-3 text-base font-medium text-[var(--dc-text-strong)]">
          Dictation
        </h4>

        <div className="divide-y divide-[var(--dc-border-subtle)]">
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Enable dictation</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                Turn on voice input in the chat composer using your selected app language
              </p>
            </div>
            <ToggleSwitch
              size="mobile"
              ariaLabel="Enable dictation"
              checked={settings.dictationEnabled}
              onChange={checked => onChange({ dictationEnabled: checked })}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
