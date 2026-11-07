import type { LlmConnection } from '@/lib/ai/llm';
import { splitModelEnv } from './live-model-env';

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
    model: splitModelEnv(env('LIVE_MODEL'))[0]?.id || env('LIVE_MODEL')
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
    model: splitModelEnv(env('LITE_MODEL'))[0]?.id || env('LITE_MODEL')
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
    model: env('IMAGE_MODEL') || 'gpt-image-2.5-sunburst',
    fastModel: env('IMAGE_MODEL_FAST') || 'gpt-image-2.5-flare'
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
}

export const formatFrontendModelName = (id: string): string => {
  const lower = id.toLowerCase();
  if (lower.includes('gemma')) return 'Gemma 4';
  if (lower.includes('llama')) return 'Llama 4';
  if (lower.includes('gpt-4o')) return 'GPT-4o';
  if (lower.includes('gpt-4')) return 'GPT-4';
  if (lower.includes('claude-3-5') || lower.includes('claude-3.5')) return 'Claude 3.5';
  if (lower.includes('claude')) return 'Claude 3';
  if (lower.includes('deepseek')) return 'DeepSeek R1';
  if (lower.startsWith('qwen3.8')) return 'Qwen 3.8';
  const clean = id.replace(/:[\w.-]+/g, '').replace(/[-_]/g, ' ').trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : id;
};

export const getModelDescription = (id: string, name?: string): string => {
  const target = `${id} ${name || ''}`.toLowerCase();
  if (target.includes('gemma')) {
    return 'Model by Google, specialized in deep reasoning, coding, and multilingual dialogue';
  }
  if (target.includes('llama')) {
    return 'Model by Meta, specialized in versatile conversation, logic, and general knowledge';
  }
  if (target.includes('deepseek')) {
    return 'Model by DeepSeek, specialized in advanced mathematics, code, and step-by-step logic';
  }
  if (target.includes('gpt-4o')) {
    return 'Model by OpenAI, specialized in high-speed multimodal intelligence and complex tasks';
  }
  if (target.includes('gpt-4')) {
    return 'Model by OpenAI, specialized in broad problem solving, writing, and deep analysis';
  }
  if (target.includes('claude-3-5') || target.includes('claude-3.5')) {
    return 'Model by Anthropic, specialized in nuanced coding, detailed writing, and analysis';
  }
  if (target.includes('claude')) {
    return 'Model by Anthropic, specialized in safe reasoning, creative tasks, and writing';
  }
  if (target.includes('gemini')) {
    return 'Model by Google, specialized in multimodal processing and long-context reasoning';
  }
  if (target.includes('mistral') || target.includes('codestral')) {
    return 'Model by Mistral AI, specialized in fast reasoning and concise generation';
  }
  if (target.includes('qwen')) {
    return 'Model by Alibaba Cloud, specialized in multilingual reasoning and programming';
  }
  if (target.includes('phi')) {
    return 'Model by Microsoft, specialized in compact high-efficiency reasoning';
  }
  return 'High-performance AI model specialized in reasoning and conversational tasks';
};

export const getLiveModels = (): LiveModelItem[] => {
  if (cachedLiveModels !== undefined) return cachedLiveModels;

  const models: LiveModelItem[] = [];
  const seen = new Set<string>();

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
        description: e.description || getModelDescription(e.id, name)
      };
    });
  };

  add(parseModels(env('LIVE_MODEL'), 'Default'));
  add(parseModels(env('LITE_MODEL'), 'Lite'));

  if (models.length === 0) {
    add([
      {
        id: 'gemma4:31b',
        name: 'Gemma 4',
        badge: 'Default',
        description: getModelDescription('gemma4:31b', 'Gemma 4')
      },
      {
        id: 'llama4:70b',
        name: 'Llama 4',
        badge: 'Lite',
        description: getModelDescription('llama4:70b', 'Llama 4')
      }
    ]);
  }

  cachedLiveModels = models;
  return cachedLiveModels;
};

export const getEnvModelIds = (): string[] => [
  ...splitModelEnv(env('LIVE_MODEL')),
  ...splitModelEnv(env('LITE_MODEL'))
].map(e => e.id);

