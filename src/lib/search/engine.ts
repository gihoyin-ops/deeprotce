import { searchBrave, searchDuckDuckGo, searchWikipedia } from './providers/html';
import { searchParallel } from './providers/mcp';
import {
  searchBraveApi, searchExa, searchGoogleCustom, searchKagi, searchLinkup,
  searchOpenAICompatible, searchPerplexity, searchSerpApi, searchTavily
} from './providers/api';
import { mergeProviderResults } from './merge';
import { cacheGet, cacheSet, isCoolingDown, markFailure, markSuccess } from './guard';
import { type SearchProviderResult, type SearchRuntimeItem, type SearchSource, type WebSearchOutcome } from './types';

export const MAX_SEARCH_RESULTS = 12;
export const MAX_SEARCH_CONTEXT_CHARS = 9000;
const PROVIDER_TIMEOUT_MS = 15000;
// live free providers answer in 1.5-2s; 6s is 3x headroom while a hung endpoint
// can never hold the merge past the cap
const WALL_BUDGET_MS = 6000;
const MAX_SOURCES_PER_PROVIDER = 8;

interface FreeProvider {
  id: string;
  name: string;
  run: (query: string, signal?: AbortSignal) => Promise<SearchProviderResult>;
}

const FREE_PROVIDERS: FreeProvider[] = [
  { id: 'parallel', name: 'Parallel Search', run: searchParallel },
  { id: 'brave', name: 'Brave Search', run: searchBrave },
  { id: 'duckduckgo', name: 'DuckDuckGo', run: searchDuckDuckGo },
  { id: 'wikipedia', name: 'Wikipedia', run: searchWikipedia }
];

export interface WebSearchOptions {
  maxResults?: number;
  providerTimeoutMs?: number;
  wallTimeMs?: number;
}

const runWithTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const { promise: timeout, reject } = Promise.withResolvers<never>();
  const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  const settled = promise.catch(error => {
    throw error instanceof Error ? error : new Error(String(error));
  });
  try {
    return await Promise.race([settled, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

interface ProviderAttempt {
  result?: SearchProviderResult;
  error?: string;
  skipped?: string;
}

const readJsonArray = (value: string): SearchSource[] => JSON.parse(value) as SearchSource[];

const cacheKey = (providerId: string, query: string) => `${providerId}:${query}`;

// cooldowns are per provider because free endpoints share one IP
// results stay per query
const settleWithGuard = (providerId: string, name: string, query: string, run: () => Promise<SearchProviderResult>, signal: AbortSignal, wallMs: number, timeoutMs: number): Promise<ProviderAttempt> => {
  const key = cacheKey(providerId, query);
  const cached = cacheGet(key);
  if (cached) {
    return Promise.resolve({ result: { providerId, providerName: name, sources: readJsonArray(cached) } });
  }
  if (isCoolingDown(providerId)) {
    return Promise.resolve({ skipped: `${name} is cooling down after failures` });
  }
  return runWithTimeout(run(), timeoutMs).then(
    sources => {
      markSuccess(providerId);
      const limited = sources.sources.slice(0, MAX_SOURCES_PER_PROVIDER);
      if (limited.length > 0) cacheSet(key, JSON.stringify(limited));
      return { result: { ...sources, sources: limited } };
    },
    error => {
      // too slow is a failure too, otherwise a hung provider would drag every
      // query for the full wall budget without ever backing off
      markFailure(providerId);
      const detail = signal.aborted ? `took longer than the ${wallMs}ms wall budget` : (error instanceof Error ? error.message : 'unknown error');
      return { error: `${name}: ${detail}` };
    }
  );
};

export const runWebSearch = async (tools: SearchRuntimeItem[], prompt: string, options?: WebSearchOptions): Promise<WebSearchOutcome> => {
  const query = prompt.replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!query) return { context: '', sources: [], providersUsed: [], providerErrors: [] };
  const timeoutMs = options?.providerTimeoutMs ?? PROVIDER_TIMEOUT_MS;
  const wallMs = Math.min(options?.wallTimeMs ?? WALL_BUDGET_MS, 30000);
  const maxResults = Math.min(options?.maxResults ?? MAX_SEARCH_RESULTS, 40);

  const runApi = (tool: SearchRuntimeItem, signal?: AbortSignal) => {
    switch (tool.toolId) {
      case 'brave-search': return searchBraveApi(query, tool, signal);
      case 'tavily': return searchTavily(query, tool, signal);
      case 'perplexity': return searchPerplexity(query, tool, signal);
      case 'serpapi': return searchSerpApi(query, tool, signal);
      case 'google-custom-search': return searchGoogleCustom(query, tool, signal);
      case 'exa': return searchExa(query, tool, signal);
      case 'kagi': return searchKagi(query, tool, signal);
      case 'linkup': return searchLinkup(query, tool, signal);
      case 'openai-compatible-search': return searchOpenAICompatible(query, tool, signal);
      default: return Promise.resolve({ providerId: tool.toolId, providerName: tool.name, sources: [] });
    }
  };

  const apiTools = tools.filter(tool => tool.toolId !== 'url-context' && tool.toolId !== 'duckduckgo' && tool.toolId !== 'wikipedia' && tool.configured);
  // one shared wall clock aborts stragglers so a dead provider cannot hold the merge
  const budget = new AbortController();
  const budgetTimer = setTimeout(() => budget.abort(), wallMs);
  // runs are lazy so cached or cooling-down providers never start a network call
  const attempts = [
    ...apiTools.map(tool => settleWithGuard(tool.toolId, tool.name, query, () => runApi(tool, budget.signal), budget.signal, wallMs, timeoutMs)),
    ...FREE_PROVIDERS.map(provider => settleWithGuard(provider.id, provider.name, query, () => provider.run(query, budget.signal), budget.signal, wallMs, timeoutMs))
  ];
  const settled = await Promise.all(attempts);
  clearTimeout(budgetTimer);
  const { results, errors, skipped } = settled.reduce<{ results: SearchProviderResult[]; errors: string[]; skipped: string[] }>((acc, attempt) => {
    if (attempt.result && attempt.result.sources.length > 0) acc.results.push(attempt.result);
    if (attempt.error) acc.errors.push(attempt.error);
    if (attempt.skipped) acc.skipped.push(attempt.skipped);
    return acc;
  }, { results: [], errors: [], skipped: [] });

  if (results.length === 0) {
    const detail = errors.length > 0 ? errors.slice(0, 5) : skipped.slice(0, 2);
    return {
      context: `Web Search unavailable\n${detail.join('\n')}`,
      sources: [],
      providersUsed: [],
      providerErrors: errors
    };
  }

  const sources = mergeProviderResults(results, maxResults);
  return {
    context: [
      formatSearchContext(results, sources),
      'Search instructions: treat these sources as current external context, prefer the most relevant and recent sources, and cite source numbers inline only for factual claims that are supported by the listed sources. Do not cite unsupported claims, do not invent source titles or URLs, and do not expose raw search diagnostics to the user.'
    ].join('\n\n').slice(0, MAX_SEARCH_CONTEXT_CHARS),
    sources,
    providersUsed: results.map(result => result.providerName),
    providerErrors: errors
  };
};

const formatSearchContext = (results: SearchProviderResult[], merged: SearchSource[]): string => [
  `Web Search Sources from ${results.map(result => result.providerName).join(', ')} (${results.length} provider${results.length === 1 ? '' : 's'} in parallel)`,
  merged.map((source, index) => [
    `[${index + 1}] ${source.title}`,
    `URL: ${source.url}`,
    source.snippet ? `Snippet: ${source.snippet}` : ''
  ].filter(Boolean).join('\n')).join('\n\n')
].join('\n\n');
