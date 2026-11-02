'use client';

import CustomDropdown from '@/components/ui/CustomDropdown';
import { ACCENT_COLOR_OPTIONS, APPEARANCE_OPTIONS, CONTRAST_OPTIONS, type GeneralSettings } from '@/lib/settings/general-settings';
import { LANGUAGE_OPTIONS } from '@/lib/settings/languages';
import { MOBILE_LANGUAGE_OPTIONS, MOBILE_APPEARANCE_OPTIONS } from '../constants';
import { ToggleRow, SettingRow, SettingsPanel, TabHeader } from '../primitives';
import { MobileGeneralDropdown, MobileGeneralSelectRow } from '../mobile';

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
    <div className="sm:hidden">
      <section>
        <p className="mb-4 px-1 text-[12px] font-semibold text-[#9b9b9b]">Theme</p>
        <div className="space-y-[6px]">
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

      <section className="mt-7">
        <p className="mb-4 px-1 text-[12px] font-semibold text-[#9b9b9b]">Language</p>
        <div className="space-y-[6px]">
          <div className="flex h-[51px] items-center justify-between rounded-[17px] bg-[#d9d9d9] px-4 dark:bg-slate-800">
            <span className="truncate text-[12px] font-semibold leading-none text-black dark:text-slate-100">App language</span>
            <MobileGeneralDropdown
              value={settings.language}
              options={MOBILE_LANGUAGE_OPTIONS}
              onChange={value => onChange({ language: value })}
              menuClassName="min-w-[140px]"
            />
          </div>
        </div>
      </section>

      <section className="mt-7">
        <p className="mb-4 px-1 text-[12px] font-semibold text-[#9b9b9b]">Input</p>
        <div className="space-y-[6px]">
          <label className="flex h-[51px] items-center justify-between rounded-[17px] bg-[#d9d9d9] px-4 dark:bg-slate-800">
            <span className="truncate text-[12px] font-semibold leading-none text-black dark:text-slate-100">Enable dictation</span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-indigo-600"
              checked={settings.dictationEnabled}
              onChange={event => onChange({ dictationEnabled: event.target.checked })}
            />
          </label>
        </div>
      </section>

    </div>
  );
}
