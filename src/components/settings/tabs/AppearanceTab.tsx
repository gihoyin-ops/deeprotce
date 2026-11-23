'use client';

import React from 'react';
import {
  ACCENT_COLOR_OPTIONS,
  BACKGROUND_PRESETS,
  FOREGROUND_PRESETS,
  THEME_OPTIONS,
  type AppearanceMode,
  type AppearanceSettings
} from '@/lib/settings/appearance-settings';
import { PillDropdown } from '../PillDropdown';

interface AppearanceTabProps {
  settings: AppearanceSettings;
  onChange: (patch: Partial<AppearanceSettings>) => void;
}

function ColorModePreviewCard({
  mode,
  selected,
  onSelect
}: {
  mode: AppearanceMode;
  selected: boolean;
  onSelect: () => void;
}) {
  const label = mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Color mode: ${label}`}
      title={label}
      className={`group relative h-[62px] w-[96px] overflow-hidden rounded-xl border-2 transition-all ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-500/25'
          : 'border-[var(--dc-border)] hover:border-[var(--dc-border-strong)]'
      }`}
    >
      {mode === 'light' && (
        <div className="flex h-full w-full bg-white p-1.5">
          <div className="w-5 shrink-0 rounded-l-md bg-slate-100 p-1">
            <span className="block h-1.5 w-1.5 rounded-full bg-slate-300" />
          </div>
          <div className="flex flex-1 flex-col justify-between bg-white p-1.5">
            <div className="space-y-1">
              <span className="ml-auto block h-1 w-8 rounded-full bg-blue-500" />
              <span className="block h-1 w-7 rounded-full bg-slate-200" />
              <span className="block h-1 w-5 rounded-full bg-slate-200" />
              <span className="ml-auto block h-1 w-9 rounded-full bg-blue-500" />
            </div>
            <div className="flex items-center justify-end rounded-full border border-slate-200 px-1 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            </div>
          </div>
        </div>
      )}

      {mode === 'dark' && (
        <div className="flex h-full w-full bg-[#111317] p-1.5">
          <div className="w-5 shrink-0 rounded-l-md bg-[#1c1f26] p-1">
            <span className="block h-1.5 w-1.5 rounded-full bg-slate-600" />
          </div>
          <div className="flex flex-1 flex-col justify-between bg-[#111317] p-1.5">
            <div className="space-y-1">
              <span className="ml-auto block h-1 w-8 rounded-full bg-blue-500" />
              <span className="block h-1 w-7 rounded-full bg-slate-700" />
              <span className="block h-1 w-5 rounded-full bg-slate-700" />
              <span className="ml-auto block h-1 w-9 rounded-full bg-blue-500" />
            </div>
            <div className="flex items-center justify-end rounded-full border border-slate-700 px-1 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            </div>
          </div>
        </div>
      )}

      {mode === 'system' && (
        <div className="relative flex h-full w-full">
          {/* Left half light */}
          <div className="flex h-full w-1/2 bg-white p-1.5 pr-0">
            <div className="w-4 shrink-0 rounded-l-md bg-slate-100 p-1">
              <span className="block h-1.5 w-1.5 rounded-full bg-slate-300" />
            </div>
            <div className="flex flex-1 flex-col justify-between bg-white py-1.5 pl-1">
              <div className="space-y-1">
                <span className="block h-1 w-5 rounded-full bg-slate-200" />
                <span className="block h-1 w-4 rounded-full bg-slate-200" />
                <span className="ml-auto block h-1 w-4 rounded-l-full bg-blue-500" />
              </div>
              <div className="h-2 rounded-l-full border border-r-0 border-slate-200" />
            </div>
          </div>
          {/* Right half dark */}
          <div className="flex h-full w-1/2 bg-[#111317] p-1.5 pl-0">
            <div className="w-4 shrink-0 bg-[#1c1f26] p-1">
              <span className="block h-1.5 w-1.5 rounded-full bg-slate-600" />
            </div>
            <div className="flex flex-1 flex-col justify-between bg-[#111317] py-1.5 pr-1">
              <div className="space-y-1">
                <span className="ml-auto block h-1 w-5 rounded-full bg-blue-500" />
                <span className="block h-1 w-5 rounded-r-full bg-slate-700" />
                <span className="block h-1 w-4 rounded-r-full bg-slate-700" />
              </div>
              <div className="flex items-center justify-end rounded-r-full border border-l-0 border-slate-700 px-1 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              </div>
            </div>
          </div>
        </div>
      )}
    </button>
  );
}

export function AppearanceTab({ settings, onChange }: AppearanceTabProps) {
  return (
    <div className="space-y-8">
      <header>
        <h3 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">Appearance</h3>
        <p className="mt-1 text-sm text-[var(--dc-text-muted)]">Customize color mode, theme, and surface colors</p>
      </header>

      <section>
        <h4 className="border-b border-[var(--dc-border-subtle)] pb-3 text-base font-medium text-[var(--dc-text-strong)]">
          Visual style
        </h4>

        <div className="divide-y divide-[var(--dc-border-subtle)]">
          {/* Color mode (matches screenshot 5) */}
          <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Color mode</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                Use light or dark colors, or follow your system setting
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              {(['system', 'light', 'dark'] as AppearanceMode[]).map(mode => (
                <ColorModePreviewCard
                  key={mode}
                  mode={mode}
                  selected={settings.appearance === mode}
                  onSelect={() => onChange({ appearance: mode })}
                />
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Theme</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Choose a surface palette preset</p>
            </div>
            <PillDropdown
              value={settings.theme}
              options={THEME_OPTIONS}
              onChange={value => onChange({ theme: value as AppearanceSettings['theme'] })}
              ariaLabel="Theme preset"
            />
          </div>

          {/* Accent (with color dot) */}
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Accent</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Highlight color for active controls and buttons</p>
            </div>
            <PillDropdown
              value={settings.accentColor}
              options={ACCENT_COLOR_OPTIONS}
              showSwatch
              onChange={value => onChange({ accentColor: value as AppearanceSettings['accentColor'] })}
              ariaLabel="Accent color"
            />
          </div>

          {/* Background */}
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Background</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Override the primary canvas background color</p>
            </div>
            <PillDropdown
              value={settings.backgroundColor}
              options={BACKGROUND_PRESETS}
              showSwatch
              allowCustomColor
              onChange={value => onChange({ backgroundColor: value })}
              ariaLabel="Background color"
            />
          </div>

          {/* Foreground */}
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Foreground</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Override the primary text foreground color</p>
            </div>
            <PillDropdown
              value={settings.foregroundColor}
              options={FOREGROUND_PRESETS}
              showSwatch
              allowCustomColor
              onChange={value => onChange({ foregroundColor: value })}
              ariaLabel="Foreground color"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
