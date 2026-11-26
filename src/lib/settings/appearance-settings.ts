'use client';

export type AppearanceMode = 'system' | 'dark' | 'light';
export type ContrastMode = 'system' | 'medium' | 'increased';
export type AccentColor = 'default' | 'blue' | 'green' | 'yellow' | 'pink' | 'orange' | 'purple' | 'black';
export type ThemePreset = 'default' | 'slate' | 'zinc' | 'warm' | 'midnight';
export type ReduceMotionMode = 'system' | 'on' | 'off';

export interface AppearanceSettings {
  appearance: AppearanceMode;
  contrast: ContrastMode;
  accentColor: AccentColor;
  theme: ThemePreset;
  backgroundColor: string;
  foregroundColor: string;
  uiFontSize: number;
  codeFontSize: number;
  reduceMotion: ReduceMotionMode;
  separateLightDark: boolean;
  contrastLevel: number;
}

export const APPEARANCE_OPTIONS = [
  { label: 'System', value: 'system' },
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' }
];

export const CONTRAST_OPTIONS = [
  { label: 'System', value: 'system' },
  { label: 'Medium', value: 'medium' },
  { label: 'Increased', value: 'increased' }
];

export const THEME_OPTIONS = [
  { label: 'Default', value: 'default', description: 'Clean neutral surfaces' },
  { label: 'Slate', value: 'slate', description: 'Cool slate-tinted surfaces' },
  { label: 'Zinc', value: 'zinc', description: 'Crisp monochrome surfaces' },
  { label: 'Warm', value: 'warm', description: 'Soft warm stone surfaces' },
  { label: 'Midnight', value: 'midnight', description: 'Deep indigo-tinted darks' }
];

export const ACCENT_COLOR_OPTIONS: Array<{ label: string; value: AccentColor; swatch: string }> = [
  { label: 'Default', value: 'default', swatch: '#4f46e5' },
  { label: 'Blue', value: 'blue', swatch: '#2563eb' },
  { label: 'Green', value: 'green', swatch: '#16a34a' },
  { label: 'Yellow', value: 'yellow', swatch: '#ca8a04' },
  { label: 'Pink', value: 'pink', swatch: '#db2777' },
  { label: 'Orange', value: 'orange', swatch: '#ea580c' },
  { label: 'Purple', value: 'purple', swatch: '#9333ea' },
  { label: 'Black', value: 'black', swatch: '#020617' }
];

export const BACKGROUND_PRESETS = [
  { label: 'Default', value: 'default', swatch: 'transparent' },
  { label: 'Pure White', value: '#ffffff', swatch: '#ffffff' },
  { label: 'Warm Paper', value: '#faf8f5', swatch: '#faf8f5' },
  { label: 'Soft Slate', value: '#f8fafc', swatch: '#f8fafc' },
  { label: 'Obsidian', value: '#0b0d11', swatch: '#0b0d11' },
  { label: 'Charcoal', value: '#141619', swatch: '#141619' },
  { label: 'Deep Navy', value: '#0a101f', swatch: '#0a101f' }
];

export const FOREGROUND_PRESETS = [
  { label: 'Default', value: 'default', swatch: 'transparent' },
  { label: 'Slate Ink', value: '#0f172a', swatch: '#0f172a' },
  { label: 'Carbon', value: '#18181b', swatch: '#18181b' },
  { label: 'Soft White', value: '#eceef2', swatch: '#eceef2' },
  { label: 'Pure White', value: '#ffffff', swatch: '#ffffff' },
  { label: 'Warm Cream', value: '#f5f0e6', swatch: '#f5f0e6' }
];

export const defaultAppearanceSettings: AppearanceSettings = {
  appearance: 'system',
  contrast: 'system',
  accentColor: 'default',
  theme: 'default',
  backgroundColor: 'default',
  foregroundColor: 'default',
  uiFontSize: 14,
  codeFontSize: 12,
  reduceMotion: 'system',
  separateLightDark: false,
  contrastLevel: 100
};

const APPEARANCE_KEY = 'deepchat-appearance-settings';
const LEGACY_GENERAL_KEY = 'deepchat-general-settings';
export const APPEARANCE_EVENT = 'deepchat:appearance-settings-updated';

const validAppearances = new Set<string>(APPEARANCE_OPTIONS.map(option => option.value));
const validContrasts = new Set<string>(CONTRAST_OPTIONS.map(option => option.value));
const validAccentColors = new Set<string>(ACCENT_COLOR_OPTIONS.map(option => option.value));
const validThemes = new Set<string>(THEME_OPTIONS.map(option => option.value));
const validReduceMotion = new Set<string>(['system', 'on', 'off']);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object');
const isValidColorValue = (value: unknown): value is string =>
  typeof value === 'string' && (value === 'default' || /^#[0-9a-fA-F]{6}$/.test(value));
const clampNum = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

const normalizeAppearanceSettings = (settings: unknown): AppearanceSettings => {
  if (!isRecord(settings)) return defaultAppearanceSettings;
  return {
    appearance: typeof settings.appearance === 'string' && validAppearances.has(settings.appearance) ? settings.appearance as AppearanceMode : defaultAppearanceSettings.appearance,
    contrast: typeof settings.contrast === 'string' && validContrasts.has(settings.contrast) ? settings.contrast as ContrastMode : defaultAppearanceSettings.contrast,
    accentColor: typeof settings.accentColor === 'string' && validAccentColors.has(settings.accentColor) ? settings.accentColor as AccentColor : defaultAppearanceSettings.accentColor,
    theme: typeof settings.theme === 'string' && validThemes.has(settings.theme) ? settings.theme as ThemePreset : defaultAppearanceSettings.theme,
    backgroundColor: isValidColorValue(settings.backgroundColor) ? settings.backgroundColor : defaultAppearanceSettings.backgroundColor,
    foregroundColor: isValidColorValue(settings.foregroundColor) ? settings.foregroundColor : defaultAppearanceSettings.foregroundColor,
    uiFontSize: clampNum(settings.uiFontSize, 10, 24, defaultAppearanceSettings.uiFontSize),
    codeFontSize: clampNum(settings.codeFontSize, 10, 24, defaultAppearanceSettings.codeFontSize),
    reduceMotion: typeof settings.reduceMotion === 'string' && validReduceMotion.has(settings.reduceMotion) ? settings.reduceMotion as ReduceMotionMode : defaultAppearanceSettings.reduceMotion,
    separateLightDark: typeof settings.separateLightDark === 'boolean' ? settings.separateLightDark : defaultAppearanceSettings.separateLightDark,
    contrastLevel: clampNum(settings.contrastLevel, 50, 100, defaultAppearanceSettings.contrastLevel)
  };
};

const getSystemPrefersDark = () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
const getSystemPrefersMoreContrast = () => typeof window !== 'undefined' && window.matchMedia('(prefers-contrast: more)').matches;

export const applyAppearanceSettings = (settings: AppearanceSettings) => {
  if (typeof document === 'undefined') return;
  const normalized = normalizeAppearanceSettings(settings);
  const root = document.documentElement;
  const dark = normalized.appearance === 'dark' || (normalized.appearance === 'system' && getSystemPrefersDark());
  const contrast = normalized.contrast === 'system' ? getSystemPrefersMoreContrast() ? 'increased' : 'medium' : normalized.contrast;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.dataset.appearance = normalized.appearance;
  root.dataset.contrast = contrast;
  root.dataset.accentColor = normalized.accentColor;
  root.dataset.theme = normalized.theme;
  root.dataset.reduceMotion = normalized.reduceMotion;

  if (normalized.uiFontSize !== defaultAppearanceSettings.uiFontSize) {
    root.style.fontSize = `${(16 * normalized.uiFontSize) / 14}px`;
  } else {
    root.style.removeProperty('font-size');
  }

  root.style.setProperty('--dc-code-font-size', `${normalized.codeFontSize}px`);

  if (normalized.contrastLevel < 100) {
    root.style.filter = `contrast(${(0.75 + (normalized.contrastLevel / 100) * 0.25).toFixed(3)})`;
  } else {
    root.style.removeProperty('filter');
  }

  if (normalized.backgroundColor !== 'default') {
    root.style.setProperty('--background', normalized.backgroundColor);
    root.style.setProperty('--dc-canvas', normalized.backgroundColor);
  } else {
    root.style.removeProperty('--background');
    root.style.removeProperty('--dc-canvas');
  }

  if (normalized.foregroundColor !== 'default') {
    root.style.setProperty('--foreground', normalized.foregroundColor);
    root.style.setProperty('--dc-text', normalized.foregroundColor);
    root.style.setProperty('--dc-text-strong', normalized.foregroundColor);
  } else {
    root.style.removeProperty('--foreground');
    root.style.removeProperty('--dc-text');
    root.style.removeProperty('--dc-text-strong');
  }
};

export const loadAppearanceSettings = (): AppearanceSettings => {
  if (typeof window === 'undefined') return defaultAppearanceSettings;
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (raw) return normalizeAppearanceSettings(JSON.parse(raw));
    // fall back to the old legacy key if they haven't saved under the new key yet
    const legacy = localStorage.getItem(LEGACY_GENERAL_KEY);
    if (legacy) return normalizeAppearanceSettings(JSON.parse(legacy));
    return defaultAppearanceSettings;
  } catch {
    return defaultAppearanceSettings;
  }
};

export const saveAppearanceSettings = (settings: AppearanceSettings): AppearanceSettings => {
  const normalized = normalizeAppearanceSettings(settings);
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(normalized));
  applyAppearanceSettings(normalized);
  window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: normalized }));
  return normalized;
};

export const subscribeAppearanceSettings = (listener: (settings: AppearanceSettings) => void) => {
  const handler = (event: Event) => {
    if (event instanceof CustomEvent) {
      listener(normalizeAppearanceSettings(event.detail));
    }
  };
  window.addEventListener(APPEARANCE_EVENT, handler);
  return () => window.removeEventListener(APPEARANCE_EVENT, handler);
};
