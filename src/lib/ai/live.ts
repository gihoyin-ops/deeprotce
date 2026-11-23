import type { LlmConnection } from '@/lib/ai/llm';
import {
  parseModelMaxEffortEnv,
  resolveMaxEffortIndex,
  splitModelEnv,
} from './live-model-env';
import { getModelConfigValue } from './models';

// server-side live endpoints configured via env

export const LIVE_CHAT_CONNECTION_ID = 'live-chat';
export const LIVE_LITE_CONNECTION_ID = 'live-lite';
export const LIVE_PROVIDER = 'live';
export const LIVE_LITE_PROVIDER = 'live-lite';

const env = (key: string) => (process.env[key] || '').trim();

// normalize base url without trailing /v1
const cleanBase = (url: string) => {
  let base = url.replace(/\/+$/, '');
  if (base.endsWith('/v1')) base = base.slice(0, -3);
  return base;
};

// live connections always include baseUrl
type LiveConnection = Omit<LlmConnection, 'baseUrl'> & { baseUrl: string };

let cachedChatConnection: LiveConnection | null | undefined = undefined;
let cachedLiteConnection: LiveConnection | null | undefined = undefined;
let cachedImageConfig: LiveImageConfig | null | undefined = undefined;
let cachedLiveConnections: LlmConnection[] | undefined = undefined;
let cachedLiveModels: LiveModelItem[] | undefined = undefined;

export const getLiveChatConnection = (): LiveConnection | null => {
  if (cachedChatConnection !== undefined) return cachedChatConnection;
  const apiKey = env('LIVE_API_KEY');
  const baseUrl = cleanBase(env('LIVE_API_URL'));
  if (!apiKey || !baseUrl) {
    cachedChatConnection = null;
    return null;
  }
  cachedChatConnection = {
    id: LIVE_CHAT_CONNECTION_ID,
    provider: LIVE_PROVIDER,
    name: 'Live',
    apiKey,
    baseUrl,
    model: splitModelEnv(getModelConfigValue('LIVE_MODEL'))[0]?.id || getModelConfigValue('LIVE_MODEL')
  };
  return cachedChatConnection;
};

export const getLiveLiteConnection = (): LiveConnection | null => {
  if (cachedLiteConnection !== undefined) return cachedLiteConnection;
  const apiKey = env('LITE_API_KEY') || env('LIVE_API_KEY');
  const baseUrl = cleanBase(env('LITE_API_URL') || env('LIVE_API_URL'));
  if (!apiKey || !baseUrl) {
    cachedLiteConnection = null;
    return null;
  }
  cachedLiteConnection = {
    id: LIVE_LITE_CONNECTION_ID,
    provider: LIVE_LITE_PROVIDER,
    name: 'Live Lite',
    apiKey,
    baseUrl,
    model: splitModelEnv(getModelConfigValue('LITE_MODEL'))[0]?.id || getModelConfigValue('LITE_MODEL')
  };
  return cachedLiteConnection;
};

export interface LiveImageConfig {
  // normalized base without trailing /v1
  baseUrl: string;
  apiKey: string;
  model: string;
  fastModel: string;
}

export const getLiveImageConfig = (): LiveImageConfig | null => {
  if (cachedImageConfig !== undefined) return cachedImageConfig;
  const apiKey = env('IMAGE_API_KEY') || env('LIVE_API_KEY');
  const baseUrl = cleanBase(env('IMAGE_API_URL'));
  if (!apiKey || !baseUrl) {
    cachedImageConfig = null;
    return null;
  }
  cachedImageConfig = {
    baseUrl,
    apiKey,
    model: getModelConfigValue('IMAGE_MODEL') || 'gpt-image-2.5-sunburst',
    fastModel: getModelConfigValue('IMAGE_MODEL_FAST') || 'gpt-image-2.5-flare'
  };
  return cachedImageConfig;
};

export const getLiveConnections = (): LlmConnection[] => {
  if (cachedLiveConnections !== undefined) return cachedLiveConnections;
  const live: LlmConnection[] = [];
  const chat = getLiveChatConnection();
  const lite = getLiveLiteConnection();
  if (chat) live.push(chat);
  if (lite) live.push(lite);
  cachedLiveConnections = live;
  return cachedLiveConnections;
};

export interface LiveModelItem {
  id: string;
  name: string;
  badge?: string;
  description?: string;
  maxTierIndex?: number;
}

export const formatFrontendModelName = (id: string): string => {
  const clean = id.replace(/:[\w.-]+/g, '').replace(/[-_]/g, ' ').trim();
  if (!clean) return id;
  return clean
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
};

export const getLiveModels = (): LiveModelItem[] => {
  if (cachedLiveModels !== undefined) return cachedLiveModels;

  const models: LiveModelItem[] = [];
  const seen = new Set<string>();
  const effortConfig = parseModelMaxEffortEnv(getModelConfigValue('MODEL_MAX_EFFORT'));

  const add = (items: LiveModelItem[]) => {
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        models.push(item);
      }
    }
  };

  const parseModels = (val: string, badge?: string): LiveModelItem[] => {
    return splitModelEnv(val).map(e => {
      const name = e.name || formatFrontendModelName(e.id);
      return {
        id: e.id,
        name,
        badge,
        description: e.description || undefined,
        maxTierIndex: resolveMaxEffortIndex(e.id, e.maxEffort, effortConfig),
      };
    });
  };

  add(parseModels(getModelConfigValue('LIVE_MODEL'), 'Default'));
  add(parseModels(getModelConfigValue('LITE_MODEL'), 'Lite'));

  cachedLiveModels = models;
  return cachedLiveModels;
};

export const getEnvModelIds = (): string[] => [
  ...splitModelEnv(getModelConfigValue('LIVE_MODEL')),
  ...splitModelEnv(getModelConfigValue('LITE_MODEL'))
].map(e => e.id);

