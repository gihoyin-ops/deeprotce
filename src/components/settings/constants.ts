import { LANGUAGE_OPTIONS } from '@/lib/settings/languages';
import { defaultNotificationSettings, type NotificationEventKey } from '@/lib/settings/notification-settings';
import { MCP_CATALOG, type MCPServerCategory } from '@/lib/mcp/mcp-settings';
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

export const PROVIDER_OPTIONS = ['OpenAI Compatible', 'OpenAI', 'Anthropic', 'Deepseek', 'Mistral', 'NVIDIA NIM', 'Gemini', 'VertexAI'];
export const VERTEX_LOCATION_OPTIONS = ['us-central1', 'us-east4', 'us-west1', 'europe-west4', 'europe-west1', 'asia-southeast1', 'asia-northeast1'];

export const REASONING_LEVEL_OPTIONS: DropdownOption[] = [
  { label: 'Minimal', value: 'minimal', description: 'Fastest thinking budget for simple prompts.' },
  { label: 'Low', value: 'low', description: 'Light reasoning with lower latency.' },
  { label: 'Medium', value: 'medium', description: 'Balanced thinking for everyday tasks.' },
  { label: 'High', value: 'high', description: 'Deeper reasoning for complex work.' },
  { label: 'Heavy', value: 'heavy', description: 'Maximum thinking preference when supported.' }
];

export const DEFAULT_BASE_URL_BY_PROVIDER: Record<string, string> = {
  Mistral: 'https://api.mistral.ai',
  'NVIDIA NIM': 'https://integrate.api.nvidia.com'
};

export const NOTIFICATION_EVENT_KEYS = Object.keys(defaultNotificationSettings.events) as NotificationEventKey[];
export const MCP_CATEGORY_OPTIONS = ['All', ...Array.from(new Set(MCP_CATALOG.map(server => server.category)))] as Array<'All' | MCPServerCategory>;
export const MCP_AVAILABILITY_OPTIONS = ['All', 'offline', 'online'] as Array<'All' | 'offline' | 'online'>;
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
    title: 'Settings',
    items: [
      { tab: 'general', label: 'General', icon: '/icons/settings.svg', source: 'local' },
      { tab: 'profile', label: 'My Profile', icon: '/icons/user.svg', source: 'local' },
      { tab: 'notifications', label: 'Notification', icon: '/icons/bell.svg', source: 'local' }
    ]
  },
  {
    title: 'Model & Services',
    items: [
      { tab: 'tools', label: 'Tools Configuration', icon: '/icons/sliders-horizontal.svg', source: 'local' },
      { tab: 'agent', label: 'Agent', icon: '/icons/agent.svg', source: 'local' },
      { tab: 'personality', label: 'Personalization', icon: '/icons/personalization.svg', source: 'local' },
      { tab: 'data', label: 'Data control', icon: '/icons/database.svg', source: 'local' },
      { tab: 'storage', label: 'Storage', icon: '/icons/archive.svg', source: 'local' }
    ]
  }
];

export const getMobileTabTitle = (tab: SettingsTab) => {
  const titles: Record<SettingsTab, string> = {
    general: 'General',
    profile: 'Profile',
    personality: 'Personalization',
    notifications: 'Notification',
    tools: 'Tools Configuration',
    agent: 'Agent',
    data: 'Data control',
    storage: 'Storage'
  };
  return titles[tab];
};
