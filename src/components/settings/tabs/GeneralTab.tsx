'use client';

import ToggleSwitch from '@/components/ui/ToggleSwitch';
import {
  SEND_MESSAGE_OPTIONS,
  type GeneralSettings
} from '@/lib/settings/general-settings';
import {
  ACCENT_COLOR_OPTIONS,
  CONTRAST_OPTIONS,
  type AppearanceSettings
} from '@/lib/settings/appearance-settings';
import { LANGUAGE_OPTIONS } from '@/lib/settings/languages';
import { MOBILE_LANGUAGE_OPTIONS, MOBILE_APPEARANCE_OPTIONS } from '../constants';
import { PillDropdown } from '../PillDropdown';
import { IconMask, MobileGeneralDropdown, MobileGeneralSelectRow } from '../mobile';

interface GeneralTabProps {
  settings: GeneralSettings;
  appearanceSettings: AppearanceSettings;
  onChange: (patch: Partial<GeneralSettings>) => void;
  onChangeAppearance: (patch: Partial<AppearanceSettings>) => void;
}

// general preferences tab (desktop matches screenshot 2)
export function GeneralTab({ settings, appearanceSettings, onChange, onChangeAppearance }: GeneralTabProps) {
  return (
    <>
      <MobileGeneralSettings
        settings={settings}
        appearanceSettings={appearanceSettings}
        onChange={onChange}
        onChangeAppearance={onChangeAppearance}
      />

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

// mobile general preferences layout
function MobileGeneralSettings({ settings, appearanceSettings, onChange, onChangeAppearance }: GeneralTabProps) {
  return (
    <div className="space-y-6 sm:hidden">
      <section>
        <p className="mb-2.5 px-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]">
          Theme
        </p>
        <div className="overflow-hidden rounded-[20px] border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-muted)] divide-y divide-[var(--dc-border-subtle)]">
          <MobileGeneralSelectRow
            label="Appearance"
            icon="/icons/monitor.svg"
            value={appearanceSettings.appearance}
            options={MOBILE_APPEARANCE_OPTIONS}
            position="top"
            onChange={value => onChangeAppearance({ appearance: value as AppearanceSettings['appearance'] })}
          />
          <MobileGeneralSelectRow
            label="Contrast"
            icon="/icons/sliders-horizontal.svg"
            value={appearanceSettings.contrast}
            options={CONTRAST_OPTIONS}
            position="middle"
            onChange={value => onChangeAppearance({ contrast: value as AppearanceSettings['contrast'] })}
          />
          <MobileGeneralSelectRow
            label="Accent color"
            icon="/icons/palette.svg"
            value={appearanceSettings.accentColor}
            options={ACCENT_COLOR_OPTIONS}
            position="bottom"
            onChange={value => onChangeAppearance({ accentColor: value as AppearanceSettings['accentColor'] })}
          />
        </div>
      </section>

      <section>
        <p className="mb-2.5 px-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]">
          Language
        </p>
        <div className="overflow-hidden rounded-[20px] border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-muted)]">
          <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
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
              menuClassName="min-w-[140px]"
            />
          </div>
        </div>
      </section>

      <section>
        <p className="mb-2.5 px-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]">
          Input
        </p>
        <div className="overflow-hidden rounded-[20px] border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-muted)]">
          <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--dc-surface)] text-[var(--dc-text-strong)] ring-1 ring-[var(--dc-border-subtle)]">
                <IconMask icon="/icons/mic.svg" source="local" className="h-[17px] w-[17px] shrink-0" />
              </span>
              <span className="truncate text-[14px] font-semibold leading-none text-[var(--dc-text-strong)]">
                Enable dictation
              </span>
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
