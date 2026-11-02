import { assertEgressUrl } from '@/lib/security/url-guard';
import { searchFetchJson, type SearchRequestInit } from '../http';
import { getHost, normalizeSearchSource } from '../merge';
import { type SearchProviderResult, type SearchSource, type SearchRuntimeItem } from '../types';

interface SearchApiRecord {
  title?: unknown;
  name?: unknown;
  url?: unknown;
  link?: unknown;
  snippet?: unknown;
  description?: unknown;
  content?: unknown;
  text?: unknown;
}
interface ApiJsonResult {
  results?: Array<unknown>;
  data?: Array<unknown>;
  [key: string]: Array<unknown> | undefined;
}

type OneOfKeys = Array<'results' | 'data' | 'organic_results' | 'items'>;

const asRecordArray = (value: unknown): SearchApiRecord[] => Array.isArray(value)
  ? value.filter((item): item is SearchApiRecord => Boolean(item && typeof item === 'object'))
  : [];

const mapApiSources = (records: SearchApiRecord[]) => records.flatMap(record => {
  const url = typeof record.url === 'string'
    ? record.url
    : (typeof record.link === 'string' ? record.link : '');
  const title = typeof record.title === 'string'
    ? record.title
    : (typeof record.name === 'string' ? record.name : '');
  const snippet = typeof record.snippet === 'string'
    ? record.snippet
    : (typeof record.description === 'string'
      ? record.description
      : (typeof record.content === 'string'
        ? record.content
        : (typeof record.text === 'string' ? record.text : '')));
  return url
    ? [normalizeSearchSource({ url, title, snippet })]
    : [];
}).filter((source): source is SearchSource => Boolean(source));

const apiCall = async (providerId: string, providerName: string, url: string, resultKeys: OneOfKeys, init?: SearchRequestInit, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const data = await searchFetchJson<ApiJsonResult>(url, { ...init, signal });
  const records = resultKeys.flatMap(key => asRecordArray(data[key]));
  return { providerId, providerName, sources: mapApiSources(records) };
};

export const searchBraveApi = async (query: string, tool: SearchRuntimeItem, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const token = tool.config.BRAVE_API_KEY;
  if (!token) throw new Error('BRAVE_API_KEY is missing');
  return apiCall('brave-search', 'Brave Search', `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`, ['results'], {
    headers: { 'X-Subscription-Token': token }
  }, signal);
};

export const searchTavily = async (query: string, tool: SearchRuntimeItem, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const apiKey = tool.config.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY is missing');
  return apiCall('tavily', 'Tavily', 'https://api.tavily.com/search', ['results'], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 6, include_answer: false })
  }, signal);
};

export const searchPerplexity = async (query: string, tool: SearchRuntimeItem, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const apiKey = tool.config.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY is missing');
  const data = await searchFetchJson<{
    citations?: Array<unknown>;
    choices?: Array<{ message?: { content?: unknown } }>;
  }>('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: query }]
    })
  });
  const citations = Array.isArray(data.citations) ? data.citations.filter((item): item is string => typeof item === 'string') : [];
  const firstChoice = Array.isArray(data.choices) ? data.choices[0] : null;
  const answer = firstChoice && typeof firstChoice.message?.content === 'string' ? firstChoice.message.content : '';
  return {
    providerId: 'perplexity',
    providerName: 'Perplexity',
    sources: mapApiSources(citations.map(citation => ({ url: citation, title: getHost(citation), snippet: answer })))
  };
};

export const searchSerpApi = async (query: string, tool: SearchRuntimeItem, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const apiKey = tool.config.SERPAPI_API_KEY;
  if (!apiKey) throw new Error('SERPAPI_API_KEY is missing');
  return apiCall('serpapi', 'SerpAPI', `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}&num=6`, ['organic_results'], undefined, signal);
};

export const searchGoogleCustom = async (query: string, tool: SearchRuntimeItem, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const apiKey = tool.config.GOOGLE_SEARCH_API_KEY;
  const cx = tool.config.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !cx) throw new Error('Google Custom Search configuration is missing');
  return apiCall('google-custom-search', 'Google Custom Search', `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=6`, ['items'], undefined, signal);
};

export const searchExa = async (query: string, tool: SearchRuntimeItem, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const apiKey = tool.config.EXA_API_KEY;
  if (!apiKey) throw new Error('EXA_API_KEY is missing');
  return apiCall('exa', 'Exa', 'https://api.exa.ai/search', ['results'], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ query, numResults: 6, contents: { text: { maxCharacters: 420 } } })
  }, signal);
};

export const searchKagi = async (query: string, tool: SearchRuntimeItem, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const apiKey = tool.config.KAGI_API_KEY;
  if (!apiKey) throw new Error('KAGI_API_KEY is missing');
  const data = await searchFetchJson<{ data?: { results?: Array<unknown> } | Array<unknown> }>(
    `https://kagi.com/api/v0/search?q=${encodeURIComponent(query)}&limit=6`,
    { signal, headers: { Authorization: `Bot ${apiKey}` } }
  );
  const inner = data.data;
  const records = Array.isArray(inner) ? asRecordArray(inner) : asRecordArray(inner?.results);
  return { providerId: 'kagi', providerName: 'Kagi', sources: mapApiSources(records) };
};

export const searchLinkup = async (query: string, tool: SearchRuntimeItem, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const apiKey = tool.config.LINKUP_API_KEY;
  if (!apiKey) throw new Error('LINKUP_API_KEY is missing');
  return apiCall('linkup', 'Linkup', 'https://api.linkup.so/v1/search', ['results'], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ q: query, depth: 'standard', outputType: 'searchResults' })
  }, signal);
};

export const searchOpenAICompatible = async (query: string, tool: SearchRuntimeItem, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const baseUrl = tool.config.OPENAI_COMPATIBLE_SEARCH_BASE_URL?.replace(/\/+$/, '');
  const apiKey = tool.config.OPENAI_COMPATIBLE_SEARCH_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('OpenAI compatible search configuration is missing');
  // client-configured base URL; refuse private/metadata targets before the key is sent
  await assertEgressUrl(baseUrl);
  return apiCall('openai-compatible-search', 'OpenAI Compatible', baseUrl, ['results', 'data'], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, q: query, limit: 6, max_results: 6 })
  }, signal);
};
