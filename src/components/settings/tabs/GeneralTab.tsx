'use client';

import {
  SEND_MESSAGE_OPTIONS,
  type GeneralSettings
} from '@/lib/settings/general-settings';
import { LANGUAGE_OPTIONS } from '@/lib/settings/languages';
import { MOBILE_LANGUAGE_OPTIONS } from '../constants';
import { PillDropdown } from '../PillDropdown';
import { IconMask, MobileGeneralDropdown } from '../mobile';

interface GeneralTabProps {
  settings: GeneralSettings;
  onChange: (patch: Partial<GeneralSettings>) => void;
}

// General preferences tab for both desktop and mobile, ngl pretty straightforward
export function GeneralTab({ settings, onChange }: GeneralTabProps) {
  return (
    <>
      <MobileGeneralSettings settings={settings} onChange={onChange} />

      <div className="hidden space-y-8 sm:block">
        <header>
          <h3 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">General</h3>
          <p className="mt-1 text-sm text-[var(--dc-text-muted)]">Set your app language and other preferences</p>
        </header>

        <section>
          <h4 className="border-b border-[var(--dc-border-subtle)] pb-3 text-sm font-semibold text-[var(--dc-text-strong)]">
            General
          </h4>

          <div className="divide-y divide-[var(--dc-border-subtle)]">
            <div className="flex items-center justify-between gap-6 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--dc-text-strong)]">App language</p>
                <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Choose the language for menus and controls</p>
              </div>
              <PillDropdown
                value={settings.language}
                options={LANGUAGE_OPTIONS}
                onChange={value => onChange({ language: value })}
                ariaLabel="App language"
              />
            </div>

            <div className="flex items-center justify-between gap-6 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--dc-text-strong)]">Send message</p>
                <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                  Choose when Enter sends a prompt or inserts a new line
                </p>
              </div>
              <PillDropdown
                value={settings.sendMessageKey}
                options={SEND_MESSAGE_OPTIONS}
                onChange={value => onChange({ sendMessageKey: value as GeneralSettings['sendMessageKey'] })}
                ariaLabel="Send message key"
              />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

// Mobile general preferences layout, uses portal-based MobileGeneralDropdown so the damn menu doesn't clip
function MobileGeneralSettings({ settings, onChange }: GeneralTabProps) {
  return (
    <div className="space-y-6 sm:hidden">
      <section>
        <p className="mb-2.5 px-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]">
          General
        </p>
        <div className="divide-y divide-[var(--dc-border-subtle)] rounded-[20px] border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-muted)]">
          <div className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--dc-surface)] text-[var(--dc-text-strong)] ring-1 ring-[var(--dc-border-subtle)]">
                <IconMask icon="/icons/globe.svg" source="local" className="h-[17px] w-[17px] shrink-0" />
              </span>
              <span className="truncate text-[14px] font-semibold leading-none text-[var(--dc-text-strong)]">
                App language
              </span>
            </div>
            <MobileGeneralDropdown
              value={settings.language}
              options={MOBILE_LANGUAGE_OPTIONS}
              onChange={value => onChange({ language: value })}
              menuClassName="min-w-[168px]"
            />
          </div>

          <div className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--dc-surface)] text-[var(--dc-text-strong)] ring-1 ring-[var(--dc-border-subtle)]">
                <IconMask icon="/icons/corner-down-left.svg" source="local" className="h-[17px] w-[17px] shrink-0" />
              </span>
              <span className="truncate text-[14px] font-semibold leading-none text-[var(--dc-text-strong)]">
                Send message
              </span>
            </div>
            <MobileGeneralDropdown
              value={settings.sendMessageKey}
              options={SEND_MESSAGE_OPTIONS}
              onChange={value => onChange({ sendMessageKey: value as GeneralSettings['sendMessageKey'] })}
              menuClassName="min-w-[168px]"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
