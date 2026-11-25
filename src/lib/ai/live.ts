import { NextResponse } from 'next/server';
import type { LlmConnection } from '@/lib/ai/llm';
import { SESSION_COOKIE_NAME } from '@/lib/security/auth';
import { getClientIp } from '@/lib/security/rate-limit';
import {
  parseModelMaxEffortEnv,
  resolveMaxEffortIndex,
  splitModelEnv,
} from './live-model-env';
import { getModelConfigValue, getModelListConfigValue } from './models';

// Server-side AI Relay (api_deepchat) configuration & helpers

export const LIVE_CHAT_CONNECTION_ID = 'live-chat';
export const LIVE_LITE_CONNECTION_ID = 'live-lite';
export const LIVE_PROVIDER = 'live';
export const LIVE_LITE_PROVIDER = 'live-lite';

const env = (key: string) => {
  const raw = (process.env[key] || '').trim();
  if (
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'")))
  ) {
    return raw.slice(1, -1).trim();
  }
  return raw;
};

// Normalize base url without trailing slash or /v1
const cleanBase = (url: string) => {
  let base = url.replace(/\/+$/, '');
  if (base.endsWith('/v1')) base = base.slice(0, -3);
  return base;
};

export const API_PROD_URL = 'https://api.deepsia.my.id';

export interface AiRelayConfig {
  baseUrl: string;
  clientSecret: string;
}

export const getAiRelayConfig = (): AiRelayConfig | null => {
  const baseUrl = cleanBase(API_PROD_URL);
  const clientSecret = env('AI_RELAY_CLIENT_SECRET');
  if (!baseUrl || !clientSecret) {
    return null;
  }
  return { baseUrl, clientSecret };
};

// Sanitize user/session identifier to max 64 alphanumeric/_/- chars for X-Client-Id
export const sanitizeRelayClientId = (raw: string | null | undefined): string | undefined => {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return cleaned || undefined;
};

export const resolveRelayClientId = (req?: Request): string | undefined => {
  if (!req) return undefined;
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const name = part.slice(0, idx).trim();
      if (name === SESSION_COOKIE_NAME) {
        const token = part.slice(idx + 1).trim();
        const sanitized = sanitizeRelayClientId(token);
        if (sanitized) return sanitized;
      }
    }
  }
  const ip = getClientIp(req);
  if (ip && ip !== '__direct__') {
    return sanitizeRelayClientId(ip);
  }
  return undefined;
};

export const buildRelayHeaders = ({
  clientSecret,
  clientId,
  contentType,
}: {
  clientSecret: string;
  clientId?: string;
  contentType?: string;
}): Record<string, string> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${clientSecret}`,
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (clientId) {
    headers['X-Client-Id'] = clientId;
  }
  return headers;
};

const parseWaitSeconds = (headers?: Headers): number | undefined => {
  if (!headers) return undefined;

  const retryAfter = headers.get('retry-after')?.trim();
  if (retryAfter) {
    const numeric = Number(retryAfter);
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.ceil(numeric);
    }
    const parsedDate = Date.parse(retryAfter);
    if (Number.isFinite(parsedDate)) {
      const diffSec = Math.ceil((parsedDate - Date.now()) / 1000);
      if (diffSec > 0) return diffSec;
    }
  }

  const rateReset = headers.get('x-ratelimit-reset')?.trim();
  if (rateReset) {
    const numeric = Number(rateReset);
    if (Number.isFinite(numeric) && numeric > 0) {
      if (numeric > 1e12) {
        const diffSec = Math.ceil((numeric - Date.now()) / 1000);
        if (diffSec > 0) return diffSec;
      } else if (numeric > 1e9) {
        const diffSec = Math.ceil(numeric - Date.now() / 1000);
        if (diffSec > 0) return diffSec;
      } else {
        return Math.ceil(numeric);
      }
    }
  }

  return undefined;
};

const formatWaitDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? '' : 's'}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
};

export interface FormattedRelayError {
  status: number;
  message: string;
  headers: Record<string, string>;
}

// Sanitized error mapping: never expose upstream body, URLs, or secrets to the UI
export const formatRelayError = (upstreamStatus: number, upstreamHeaders?: Headers): FormattedRelayError => {
  if (upstreamStatus === 429) {
    const waitSeconds = parseWaitSeconds(upstreamHeaders);
    const outHeaders: Record<string, string> = {};
    const retryAfter = upstreamHeaders?.get('retry-after');
    const rateReset = upstreamHeaders?.get('x-ratelimit-reset');
    if (retryAfter) outHeaders['Retry-After'] = retryAfter;
    else if (waitSeconds !== undefined) outHeaders['Retry-After'] = String(waitSeconds);
    if (rateReset) outHeaders['X-RateLimit-Reset'] = rateReset;

    const message = waitSeconds !== undefined
      ? `Too many requests right now. Please wait about ${formatWaitDuration(waitSeconds)} and try again.`
      : 'Too many requests right now. Please wait a moment and try again.';

    return { status: 429, message, headers: outHeaders };
  }

  if (upstreamStatus === 401 || upstreamStatus === 403) {
    return {
      status: 502,
      message: 'AI service authentication failed. Please try again later or contact support.',
      headers: {},
    };
  }

  if (upstreamStatus === 400) {
    return {
      status: 400,
      message: 'The request could not be processed. Please check your input and try again.',
      headers: {},
    };
  }

  if (upstreamStatus === 413) {
    return {
      status: 413,
      message: 'The message or attachment is too large. Please shorten your input or use a smaller file.',
      headers: {},
    };
  }

  if (upstreamStatus === 504 || upstreamStatus === 408) {
    return {
      status: 504,
      message: 'The AI service took too long to respond. Please try again.',
      headers: {},
    };
  }

  if (upstreamStatus === 502) {
    return {
      status: 502,
      message: 'The AI service is temporarily unavailable. Please try again in a moment.',
      headers: {},
    };
  }

  return {
    status: 502,
    message: 'Could not reach the AI service right now. Please try again in a bit.',
    headers: {},
  };
};

export const relayErrorResponse = (upstreamStatus: number, upstreamHeaders?: Headers) => {
  const formatted = formatRelayError(upstreamStatus, upstreamHeaders);
  return NextResponse.json(
    { error: formatted.message },
    { status: formatted.status, headers: formatted.headers }
  );
};

// Live connections always include baseUrl
type LiveConnection = Omit<LlmConnection, 'baseUrl'> & { baseUrl: string };

export const getLiveChatConnection = (): LiveConnection | null => {
  const relay = getAiRelayConfig();
  if (!relay) return null;
  return {
    id: LIVE_CHAT_CONNECTION_ID,
    provider: LIVE_PROVIDER,
    name: 'Live',
    apiKey: relay.clientSecret,
    baseUrl: relay.baseUrl,
    model: splitModelEnv(getModelListConfigValue('LIVE_MODEL'))[0]?.id || '',
  };
};

export const getLiveLiteConnection = (): LiveConnection | null => {
  const relay = getAiRelayConfig();
  if (!relay) return null;
  return {
    id: LIVE_LITE_CONNECTION_ID,
    provider: LIVE_LITE_PROVIDER,
    name: 'Live Lite',
    apiKey: relay.clientSecret,
    baseUrl: relay.baseUrl,
    model: splitModelEnv(getModelListConfigValue('LITE_MODEL'))[0]?.id || '',
  };
};

export interface LiveImageConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  fastModel: string;
}

export const getLiveImageConfig = (): LiveImageConfig | null => {
  const relay = getAiRelayConfig();
  if (!relay) return null;
  return {
    baseUrl: relay.baseUrl,
    apiKey: relay.clientSecret,
    model: getModelConfigValue('IMAGE_MODEL') || 'gpt-image-2.5-sunburst',
    fastModel: getModelConfigValue('IMAGE_MODEL_FAST') || 'gpt-image-2.5-flare',
  };
};

export const getLiveConnections = (): LlmConnection[] => {
  const live: LlmConnection[] = [];
  const chat = getLiveChatConnection();
  const lite = getLiveLiteConnection();
  if (chat) live.push(chat);
  if (lite) live.push(lite);
  return live;
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

  const parseModels = (val: string | readonly string[], badge?: string): LiveModelItem[] => {
    return splitModelEnv(val).map((e) => {
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

  add(parseModels(getModelListConfigValue('LIVE_MODEL'), 'Default'));
  add(parseModels(getModelListConfigValue('LITE_MODEL'), 'Lite'));

  return models;
};

export const getEnvModelIds = (): string[] => [
  ...splitModelEnv(getModelListConfigValue('LIVE_MODEL')),
  ...splitModelEnv(getModelListConfigValue('LITE_MODEL')),
].map((e) => e.id);

interface RelayModelPayload {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  tier?: unknown;
  max_effort?: unknown;
}

interface RelayModelsCache {
  models: LiveModelItem[];
  fetchedAt: number;
}

const RELAY_MODELS_CACHE_TTL_MS = 30_000;
let relayModelsCache: RelayModelsCache | null = null;

export interface FetchRelayModelsResult {
  ok: true;
  models: LiveModelItem[];
  defaultId: string;
}

export interface FetchRelayModelsError {
  ok: false;
  status: number;
  headers: Headers;
}

export const fetchRelayModels = async (
  clientId?: string,
  options?: { bypassCache?: boolean }
): Promise<FetchRelayModelsResult | FetchRelayModelsError> => {
  const relay = getAiRelayConfig();
  if (!relay) {
    return {
      ok: false,
      status: 502,
      headers: new Headers(),
    };
  }

  const localModels = getLiveModels();
  const localById = new Map(localModels.map((m) => [m.id, m]));
  const effortConfig = parseModelMaxEffortEnv(getModelConfigValue('MODEL_MAX_EFFORT'));
  const defaultId = splitModelEnv(getModelListConfigValue('LIVE_MODEL'))[0]?.id || localModels[0]?.id || '';

  if (!options?.bypassCache && relayModelsCache && Date.now() - relayModelsCache.fetchedAt < RELAY_MODELS_CACHE_TTL_MS) {
    return {
      ok: true,
      models: relayModelsCache.models,
      defaultId: defaultId || relayModelsCache.models[0]?.id || '',
    };
  }

  const res = await fetch(`${relay.baseUrl}/v1/models`, {
    method: 'GET',
    headers: buildRelayHeaders({
      clientSecret: relay.clientSecret,
      clientId,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      headers: res.headers,
    };
  }

  const payload = (await res.json()) as { data?: RelayModelPayload[]; models?: RelayModelPayload[] } | RelayModelPayload[];
  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.models)
        ? payload.models
        : [];

  const merged: LiveModelItem[] = [];
  const seen = new Set<string>();

  for (const entry of rawList) {
    const id = typeof entry?.id === 'string' ? entry.id.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const localMeta = localById.get(id);
    const remoteName = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const remoteDesc = typeof entry?.description === 'string' ? entry.description.trim() : '';
    const remoteTier = typeof entry?.tier === 'string' ? entry.tier.trim().toLowerCase() : '';
    const remoteMaxEffort = typeof entry?.max_effort === 'string' ? entry.max_effort.trim() : undefined;

    const remoteBadge =
      remoteTier === 'image'
        ? 'Image'
        : remoteTier === 'lite'
          ? 'Lite'
          : remoteTier === 'live'
            ? 'Default'
            : undefined;

    merged.push({
      id,
      name: localMeta?.name || remoteName || formatFrontendModelName(id),
      badge: localMeta?.badge || remoteBadge,
      description: localMeta?.description || remoteDesc || undefined,
      maxTierIndex: localMeta?.maxTierIndex ?? resolveMaxEffortIndex(id, remoteMaxEffort, effortConfig),
    });
  }

  const models = merged.length > 0 ? merged : localModels;
  relayModelsCache = {
    models,
    fetchedAt: Date.now(),
  };

  return {
    ok: true,
    models,
    defaultId: (defaultId && models.some((m) => m.id === defaultId) ? defaultId : models[0]?.id) || '',
  };
};
