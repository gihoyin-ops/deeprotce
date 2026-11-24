import { LANGUAGE_OPTIONS } from '@/lib/settings/languages';
import { defaultNotificationSettings, type NotificationEventKey } from '@/lib/settings/notification-settings';
import { TOOL_CATALOG, type ToolCategory } from '@/lib/settings/tool-settings';
import type { DropdownOption } from '@/components/ui/CustomDropdown';
import type { MobileSettingsMenuSection, SettingsTab } from './types';

// shared dropdown options
export const STYLE_TONE_OPTIONS: DropdownOption[] = [
  { label: 'Default', value: 'default', description: 'Standard AI behavior.' },
  { label: 'Professional', value: 'professional', description: 'Formal, polite, and objective.' },
  { label: 'Friendly', value: 'friendly', description: 'Warm, approachable, and conversational.' },
  { label: 'Direct', value: 'direct', description: 'Straight to the point, no fluff.' },
  { label: 'Playful', value: 'playful', description: 'Fun, witty, and slightly informal.' },
  { label: 'Efficient', value: 'efficient', description: 'Highly concise, focusing only on answers.' },
  { label: 'Sarcastic', value: 'sarcastic', description: 'Dry humor, slightly cynical but helpful.' },
];

export const WARMTH_OPTIONS: DropdownOption[] = [
  { label: 'Default', value: 'default', description: 'Standard warmth.' },
  { label: 'Less', value: 'less', description: 'More clinical.' },
  { label: 'More', value: 'more', description: 'Highly empathetic.' }
];

export const ENTHUSIASTIC_OPTIONS: DropdownOption[] = [
  { label: 'Default', value: 'default', description: 'Standard enthusiasm.' },
  { label: 'Less', value: 'less', description: 'Calm and collected.' },
  { label: 'More', value: 'more', description: 'Highly energetic.' }
];

export const HEADERS_OPTIONS: DropdownOption[] = [
  { label: 'Default', value: 'default', description: 'Standard formatting.' },
  { label: 'Less', value: 'less', description: 'Prefers paragraphs.' },
  { label: 'More', value: 'more', description: 'Highly structured.' }
];

export const EMOJI_OPTIONS: DropdownOption[] = [
  { label: 'Default', value: 'default', description: 'Standard emoji use.' },
  { label: 'Less', value: 'less', description: 'Rarely uses emojis.' },
  { label: 'More', value: 'more', description: 'Expressive with emojis.' }
];

export const VISUAL_ANSWERS_OPTIONS: DropdownOption[] = [
  { label: 'Default', value: 'default', description: 'Standard visual formatting.' },
  { label: 'Less', value: 'less', description: 'Prefer plain text.' },
  { label: 'More', value: 'more', description: 'Prefer tables, diagrams, and rich visuals.' }
];

export const PROVIDER_OPTIONS = ['OpenAI Compatible', 'OpenAI', 'Anthropic', 'Deepseek', 'Mistral', 'NVIDIA NIM', 'Gemini', 'VertexAI'];
export const VERTEX_LOCATION_OPTIONS = ['us-central1', 'us-east4', 'us-west1', 'europe-west4', 'europe-west1', 'asia-southeast1', 'asia-northeast1'];

export const REASONING_LEVEL_OPTIONS: DropdownOption[] = [
  { label: 'Minimal', value: 'minimal', description: 'Fastest thinking budget for simple prompts.' },
  { label: 'Low', value: 'low', description: 'Light reasoning with lower latency.' },
  { label: 'Medium', value: 'medium', description: 'Balanced thinking for everyday tasks.' },
  { label: 'High', value: 'high', description: 'Deeper reasoning for complex work.' },
  { label: 'Heavy', value: 'heavy', description: 'Maximum thinking preference when supported.' }
];

export const NOTIFICATION_EVENT_KEYS = Object.keys(defaultNotificationSettings.events) as NotificationEventKey[];
export const TOOL_CATEGORY_OPTIONS = ['All', ...Array.from(new Set(TOOL_CATALOG.map(tool => tool.category)))] as Array<'All' | ToolCategory>;

export const MOBILE_APPEARANCE_OPTIONS: DropdownOption[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' }
];
export const MOBILE_LANGUAGE_OPTIONS: DropdownOption[] = LANGUAGE_OPTIONS.map(option => option.value === 'auto' ? { ...option, label: 'Auto Detect' } : option);

export const modalAnimationMs = 260;
export const mobileDetailAnimationMs = 260;

export const mobileSettingsSections: MobileSettingsMenuSection[] = [
  {
    title: 'Account',
    items: [
      { tab: 'account', label: 'Account', icon: '/icons/user.svg', source: 'local' },
      { tab: 'usage', label: 'Usage', icon: '/icons/gauge.svg', source: 'local' }
    ]
  },
  {
    title: 'App',
    items: [
      { tab: 'general', label: 'General', icon: '/icons/settings.svg', source: 'local' },
      { tab: 'appearance', label: 'Appearance', icon: '/icons/palette.svg', source: 'local' },
      { tab: 'notifications', label: 'Notifications', icon: '/icons/bell.svg', source: 'local' },
      { tab: 'voice', label: 'Voice', icon: '/icons/mic.svg', source: 'local' },
      { tab: 'personality', label: 'Personalization', icon: '/icons/personalization.svg', source: 'local' },
      { tab: 'keyboard', label: 'Keyboard', icon: '/icons/keyboard.svg', source: 'local' }
    ]
  },
  {
    title: 'Data & Privacy',
    items: [
      { tab: 'archived', label: 'Archived chats', icon: '/icons/archive.svg', source: 'local' },
      { tab: 'storage', label: 'Storage', icon: '/icons/database.svg', source: 'local' },
      { tab: 'data', label: 'Data controls', icon: '/icons/shield-alert.svg', source: 'local' }
    ]
  }
];

export const getMobileTabTitle = (tab: SettingsTab) => {
  const titles: Record<SettingsTab, string> = {
    account: 'Account',
    usage: 'Usage',
    general: 'General',
    appearance: 'Appearance',
    notifications: 'Notifications',
    voice: 'Voice',
    personality: 'Personalization',
    keyboard: 'Keyboard',
    archived: 'Archived chats',
    storage: 'Storage',
    data: 'Data controls'
  };
  return titles[tab];
};
