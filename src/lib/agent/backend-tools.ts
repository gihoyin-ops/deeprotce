'use client';

import { shouldUseSmartSearch } from '@/lib/settings/tool-settings';
import { parseAgentClarification } from '@/lib/agent/agent-clarification';
import { type ImageAspectRatio } from '@/lib/images/image-aspect-ratio';

export interface BackendChatMessage {
  id?: string;
  role: string;
  content?: string;
  attachedFiles?: unknown;
  webSearchEnabled?: boolean;
  imageGenerationEnabled?: boolean;
  imageAspectRatio?: ImageAspectRatio;
  [key: string]: unknown;
}

export interface BackendSelectedConnection {
  connectionId?: string;
  id?: string;
}

export interface BackendToolDecision {
  useSearch: boolean;
  reason?: string;
  source: 'manual' | 'ai' | 'heuristic';
}

const CURRENT_MARKET_ANALYSIS_PATTERN = /((stock|stocks|ticker|market|crypto|coin|forex|exchange rate|price|prices|saham|bursa|emiten|kripto|koin|kurs|harga).*(visuali[sz]e|visualization|chart|plot|grafik|forecast|predict|prediction|projection|trend|outlook|analy[sz]e|analysis|prediksi|proyeksi|tren|analisis|kedepan|ke depan|mendatang))|((visuali[sz]e|visualization|chart|plot|grafik|forecast|predict|prediction|projection|trend|outlook|analy[sz]e|analysis|prediksi|proyeksi|tren|analisis).*(stock|stocks|ticker|market|crypto|coin|forex|exchange rate|price|prices|saham|bursa|emiten|kripto|koin|kurs|harga))/i;
const CURRENT_SEARCH_PATTERN = /\b(harga|kurs|rupiah|dollar|dolar|usd|idr|rate|nilai tukar|exchange rate|market|pasar|saham|crypto|kripto|bitcoin|emas|oil|minyak|terbaru|terkini|sekarang|saat ini|hari ini|latest|current|today|now|live|real[-\s]?time)\b/i;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object');
const getString = (value: unknown) => typeof value === 'string' ? value : '';

export const getLatestUserMessage = (messages: BackendChatMessage[]) => [...messages].reverse().find(message => message.role === 'user');

export const shouldRequestImageGeneration = (message: BackendChatMessage | undefined) => message?.imageGenerationEnabled === true;

const shouldRequestWebSearch = (message: BackendChatMessage | undefined) => {
  if (!message) return false;
  if (message.webSearchEnabled === true) return true;
  const content = message.content || '';
  if (CURRENT_SEARCH_PATTERN.test(content)) return true;
  if (CURRENT_MARKET_ANALYSIS_PATTERN.test(content)) return true;
  return shouldUseSmartSearch(content);
};

const getHeuristicToolDecision = (message: BackendChatMessage | undefined): BackendToolDecision => ({
  useSearch: shouldRequestWebSearch(message),
  source: message?.webSearchEnabled === true ? 'manual' : 'heuristic'
});

const getRecentConversationContext = (messages: BackendChatMessage[]) => messages.slice(-6).map(message => {
  const role = message.role === 'assistant' ? 'Assistant' : message.role === 'user' ? 'User' : 'System';
  const content = parseAgentClarification(message.content || '').visibleContent.replace(/\s+/g, ' ').trim();
  return `${role}: ${content.slice(0, 700)}`;
}).join('\n');

const getToolDecisionInstruction = (manualSearch: boolean) => [
  'You are DeepChat Tool Router. Choose which backend runtime tools should run before the assistant answers.',
  'Return only compact JSON with this exact shape: {"useSearch":boolean,"reason":"short reason"}.',
  'Available tools:',
  'Search: finds fresh web facts and returns source-aware context. Use it for current/latest/recent information, prices, currency exchange rates, Rupiah/USD/IDR, availability, news, public people or organizations, product specs, releases, citations, and facts likely to change.',
  manualSearch ? 'The user manually enabled Search, so useSearch must be true.' : 'If the request can be answered from conversation context or stable general knowledge, do not use Search.',
  'Use Search for questions containing current prices, exchange rates, "harga", "kurs", "rupiah", "sekarang", "hari ini", "terbaru", or "saat ini".',
  'Prefer no tool for greetings, translation, writing, brainstorming, coding help, explanations, or local reasoning unless the user explicitly asks for current external facts.',
  'When the user asks for analysis, visualization, charting, forecasting, or prediction based on current web facts, use Search for the fresh facts.',
  'Never ask the user which tool to use.'
].join('\n');

const getToolDecisionUserPrompt = (messages: BackendChatMessage[], latestUserMessage: BackendChatMessage) => [
  `Latest user message: ${latestUserMessage.content || ''}`,
  `Manual Search toggle: ${latestUserMessage.webSearchEnabled === true ? 'on' : 'off'}`,
  'Recent conversation:',
  getRecentConversationContext(messages)
].join('\n\n');

const extractJsonObject = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const readRouterResponseText = async (res: Response) => {
  if (!res.ok) return '';
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  const provider = res.headers.get('x-provider') || '';
  let text = '';
  let buffer = '';
  if (!reader) return '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim() || line.startsWith(':')) continue;
      const data = line.replace(/^data:\s*/, '').trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as unknown;
        if (!isRecord(parsed) || parsed.error) continue;
        if (typeof parsed.text === 'string') text += parsed.text;
        if (parsed.type === 'deepchat_content') text += getString(parsed.text);
        if (provider === 'anthropic' && parsed.type === 'content_block_delta' && isRecord(parsed.delta)) text += getString(parsed.delta.text);
        if ((provider === 'gemini' || provider === 'vertexai') && Array.isArray(parsed.candidates)) {
          const candidate = isRecord(parsed.candidates[0]) ? parsed.candidates[0] : null;
          const content = candidate && isRecord(candidate.content) ? candidate.content : null;
          const parts = content && Array.isArray(content.parts) ? content.parts : [];
          text += parts.map(part => isRecord(part) ? getString(part.text) : '').join('');
        }
        if (Array.isArray(parsed.choices)) {
          const choice = isRecord(parsed.choices[0]) ? parsed.choices[0] : null;
          const delta = choice && isRecord(choice.delta) ? choice.delta : isRecord(choice?.message) ? choice.message : null;
          text += getString(delta?.content);
        }
      } catch {
      }
    }
  }
  return text.trim();
};

const mergeToolDecision = (fallback: BackendToolDecision, value: Record<string, unknown> | null, manualSearch: boolean): BackendToolDecision => {
  const aiSearch = value?.useSearch === true;
  const useSearch = manualSearch || fallback.useSearch || aiSearch;
  const source: BackendToolDecision['source'] = manualSearch ? 'manual' : aiSearch ? 'ai' : fallback.source;
  return {
    useSearch,
    source,
    reason: getString(value?.reason).slice(0, 240) || fallback.reason
  };
};

export const decideBackendTools = async (messages: BackendChatMessage[], latestUserMessage: BackendChatMessage | undefined, selectedConnection: BackendSelectedConnection | null, signal?: AbortSignal): Promise<BackendToolDecision> => {
  const fallback = getHeuristicToolDecision(latestUserMessage);
  if (!latestUserMessage) return fallback;
  const manualSearch = latestUserMessage.webSearchEnabled === true;
  if (!selectedConnection?.connectionId && !selectedConnection?.id) return fallback;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: getToolDecisionInstruction(manualSearch) },
          { role: 'user', content: getToolDecisionUserPrompt(messages, latestUserMessage) }
        ],
        connectionId: selectedConnection.connectionId,
        modelId: selectedConnection.id,
        mcpServers: [],
        tools: [],
        skipAgentLoop: true,
        skipRuntimeIntegrations: true
      }),
      signal
    });
    const parsed = extractJsonObject(await readRouterResponseText(res));
    return mergeToolDecision(fallback, parsed, manualSearch);
  } catch {
    return fallback;
  }
};
