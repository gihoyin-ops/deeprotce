'use client';

import CustomDropdown from '@/components/ui/CustomDropdown';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import { ACCENT_COLOR_OPTIONS, APPEARANCE_OPTIONS, CONTRAST_OPTIONS, type GeneralSettings } from '@/lib/settings/general-settings';
import { LANGUAGE_OPTIONS } from '@/lib/settings/languages';
import { MOBILE_LANGUAGE_OPTIONS, MOBILE_APPEARANCE_OPTIONS } from '../constants';
import { ToggleRow, SettingRow, SettingsPanel, TabHeader } from '../primitives';
import { IconMask, MobileGeneralDropdown, MobileGeneralSelectRow } from '../mobile';

interface GeneralTabProps {
  settings: GeneralSettings;
  onChange: (patch: Partial<GeneralSettings>) => void;
}

// general preferences tab
export function GeneralTab({ settings, onChange }: GeneralTabProps) {
  return (
    <>
      <MobileGeneralSettings settings={settings} onChange={onChange} />
      <div className="hidden space-y-6 sm:block">
        <TabHeader title="General" description="Manage app display, language, and dictation preferences." />
        <SettingsPanel>
          <SettingRow title="Appearance" description="Choose how DeepChat follows your device or uses a fixed theme.">
            <CustomDropdown value={settings.appearance} onChange={value => onChange({ appearance: value as GeneralSettings['appearance'] })} options={APPEARANCE_OPTIONS} />
          </SettingRow>
          <SettingRow title="Contrast" description="Tune readability for softer or stronger separation between surfaces.">
            <CustomDropdown value={settings.contrast} onChange={value => onChange({ contrast: value as GeneralSettings['contrast'] })} options={CONTRAST_OPTIONS} />
          </SettingRow>
          <SettingRow title="Accent Color" description="Set the primary highlight used by controls, active states, and actions.">
            <CustomDropdown value={settings.accentColor} onChange={value => onChange({ accentColor: value as GeneralSettings['accentColor'] })} options={ACCENT_COLOR_OPTIONS} />
          </SettingRow>
          <SettingRow title="Language" description="Use auto-detect or pick one of the available language presets.">
            <CustomDropdown value={settings.language} onChange={value => onChange({ language: value })} options={LANGUAGE_OPTIONS} />
          </SettingRow>
          <ToggleRow
            title="Enable Dictation"
            description="Turn on voice input in the chat composer and use the selected language when supported by your browser."
            checked={settings.dictationEnabled}
            onChange={checked => onChange({ dictationEnabled: checked })}
          />
        </SettingsPanel>
      </div>
    </>
  );
}

// mobile general preferences layout
function MobileGeneralSettings({ settings, onChange }: GeneralTabProps) {
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
            value={settings.appearance}
            options={MOBILE_APPEARANCE_OPTIONS}
            position="top"
            onChange={value => onChange({ appearance: value as GeneralSettings['appearance'] })}
          />
          <MobileGeneralSelectRow
            label="Contrast"
            icon="/icons/sliders-horizontal.svg"
            value={settings.contrast}
            options={CONTRAST_OPTIONS}
            position="middle"
            onChange={value => onChange({ contrast: value as GeneralSettings['contrast'] })}
          />
          <MobileGeneralSelectRow
            label="Accent color"
            icon="/icons/palette.svg"
            value={settings.accentColor}
            options={ACCENT_COLOR_OPTIONS}
            position="bottom"
            onChange={value => onChange({ accentColor: value as GeneralSettings['accentColor'] })}
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
