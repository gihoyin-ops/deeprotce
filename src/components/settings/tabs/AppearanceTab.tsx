'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from '@/components/ui/icons';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import {
  ACCENT_COLOR_OPTIONS,
  defaultAppearanceSettings,
  THEME_OPTIONS,
  type AppearanceMode,
  type AppearanceSettings,
  type ReduceMotionMode
} from '@/lib/settings/appearance-settings';
import { PillDropdown } from '../PillDropdown';
import { ColorPickerPill } from '../ColorPickerPill';

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
  const [isDarkResolved, setIsDarkResolved] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      if (settings.appearance === 'dark') {
        setIsDarkResolved(true);
      } else if (settings.appearance === 'light') {
        setIsDarkResolved(false);
      } else {
        setIsDarkResolved(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    };
    sync();
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [settings.appearance]);

  const defaultBgHex = isDarkResolved ? '#0B0D11' : '#FCFCFC';
  const defaultFgHex = isDarkResolved ? '#ECEEF2' : '#0D0D0D';

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

          {/* Background (color pill picker) */}
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Background</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Set the color behind app content</p>
            </div>
            <ColorPickerPill
              value={settings.backgroundColor}
              fallbackHex={defaultBgHex}
              onChange={hex => onChange({ backgroundColor: hex })}
              onReset={() => onChange({ backgroundColor: 'default' })}
              ariaLabel="Background color"
            />
          </div>

          {/* Foreground (color pill picker) */}
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Foreground</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Choose the main text color</p>
            </div>
            <ColorPickerPill
              value={settings.foregroundColor}
              fallbackHex={defaultFgHex}
              onChange={hex => onChange({ foregroundColor: hex })}
              onReset={() => onChange({ foregroundColor: 'default' })}
              ariaLabel="Foreground color"
            />
          </div>
        </div>
      </section>

      {/* Collapsible Advanced section (matches screenshots) */}
      <section>
        <div className="flex items-center justify-between border-b border-[var(--dc-border-subtle)] pb-3">
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(prev => !prev)}
            aria-expanded={isAdvancedOpen}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--dc-text)] transition-colors hover:text-[var(--dc-text-strong)]"
          >
            <span>Advanced</span>
            {isAdvancedOpen ? (
              <ChevronDown className="h-4 w-4 text-[var(--dc-text-muted)]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[var(--dc-text-muted)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onChange({ ...defaultAppearanceSettings })}
            className="text-xs font-medium text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
          >
            Reset to default
          </button>
        </div>

        {isAdvancedOpen && (
          <div className="divide-y divide-[var(--dc-border-subtle)]">
            {/* UI font size */}
            <div className="flex items-center justify-between gap-6 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--dc-text-strong)]">UI font size</p>
                <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                  Adjust the base size used for DeepChat
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={24}
                  value={settings.uiFontSize}
                  onChange={event => {
                    const parsed = parseInt(event.target.value, 10);
                    if (!Number.isNaN(parsed)) {
                      onChange({ uiFontSize: Math.min(24, Math.max(10, parsed)) });
                    }
                  }}
                  aria-label="UI font size in pixels"
                  className="h-8 w-16 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2.5 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
                />
                <span className="text-xs text-[var(--dc-text-muted)]">px</span>
              </div>
            </div>

            {/* Code font size */}
            <div className="flex items-center justify-between gap-6 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--dc-text-strong)]">Code font size</p>
                <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                  Adjust the base size used for code across chats and diffs
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={24}
                  value={settings.codeFontSize}
                  onChange={event => {
                    const parsed = parseInt(event.target.value, 10);
                    if (!Number.isNaN(parsed)) {
                      onChange({ codeFontSize: Math.min(24, Math.max(10, parsed)) });
                    }
                  }}
                  aria-label="Code font size in pixels"
                  className="h-8 w-16 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2.5 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
                />
                <span className="text-xs text-[var(--dc-text-muted)]">px</span>
              </div>
            </div>

            {/* Reduce motion */}
            <div className="flex items-center justify-between gap-6 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--dc-text-strong)]">Reduce motion</p>
                <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                  Reduce animations or match your system
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1" role="radiogroup" aria-label="Reduce motion">
                {(['system', 'on', 'off'] as ReduceMotionMode[]).map(mode => {
                  const active = settings.reduceMotion === mode;
                  const label = mode === 'system' ? 'System' : mode === 'on' ? 'On' : 'Off';
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onChange({ reduceMotion: mode })}
                      className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                        active
                          ? 'bg-[var(--dc-fill)] font-medium text-[var(--dc-text-strong)]'
                          : 'text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Separate light and dark modes */}
            <div className="flex items-center justify-between gap-6 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--dc-text-strong)]">Separate light and dark modes</p>
                <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                  Choose a theme, colors, and font for each
                </p>
              </div>
              <ToggleSwitch
                size="mobile"
                ariaLabel="Separate light and dark modes"
                checked={settings.separateLightDark}
                onChange={checked => onChange({ separateLightDark: checked })}
              />
            </div>

            {/* Contrast */}
            <div className="flex items-center justify-between gap-6 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--dc-text-strong)]">Contrast</p>
                <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                  Adjust how strongly text and controls stand out from the background
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={settings.contrastLevel}
                  onChange={event => onChange({ contrastLevel: Number(event.target.value) })}
                  aria-label="Contrast level"
                  className="h-1.5 w-32 cursor-pointer accent-blue-600"
                />
                <span className="w-8 text-right text-xs font-medium tabular-nums text-[var(--dc-text-strong)]">
                  {settings.contrastLevel}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
