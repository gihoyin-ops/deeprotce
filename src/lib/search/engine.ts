import { searchBrave, searchDuckDuckGo, searchWikipedia } from './providers/html';
import { searchParallel } from './providers/mcp';
import {
  searchBraveApi, searchExa, searchGoogleCustom, searchKagi, searchLinkup,
  searchOpenAICompatible, searchPerplexity, searchSerpApi, searchTavily
} from './providers/api';
import { mergeProviderResults } from './merge';
import { SearchTransportError } from './http';
import { cacheGet, cacheSet, failureCount, isCoolingDown, markFailure, markSuccess } from './guard';
import {
  type ProviderFailure, type ProviderNotice, type SearchErrorKind,
  type SearchProviderResult, type SearchRuntimeItem, type SearchSource, type WebSearchOutcome
} from './types';

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
  errorRaw?: unknown;
  errorDetail?: string;
  skipped?: string;
}

// warm-up pass retries each provider once after the budget already expired —
// the retry must never push the merge past the wall, so it becomes a freebie
const WARMUP_RETRY_BUDGET_MS = 2500;

interface ProviderSettleState {
  key: string;
  providerId: string;
  name: string;
  // receives the signal for this attempt: pass 1 uses the shared wall,
  // the rescue pass uses its own fresh controller so an aborted wall
  // cannot cancel the retry requests
  run: (signal: AbortSignal) => Promise<SearchProviderResult>;
}

const WARMUP_ORDER = ['wikipedia', 'brave', 'parallel', 'duckduckgo'];

const readJsonArray = (value: string): SearchSource[] => JSON.parse(value) as SearchSource[];

const cacheKey = (providerId: string, query: string) => `${providerId}:${query}`;

// cooldowns are per provider because free endpoints share one IP
// results stay per query
const settleWithGuard = (state: ProviderSettleState, query: string, signal: AbortSignal, wallMs: number, timeoutMs: number, force = false): Promise<ProviderAttempt> => {
  const key = state.key;
  const cached = cacheGet(key);
  if (cached) {
    return Promise.resolve({ result: { providerId: state.providerId, providerName: state.name, sources: readJsonArray(cached) } });
  }
  // the warm-up pass retries after pass 1 already armed a cooldown on the
  // same provider, so it must bypass the short-circuit with force
  if (!force && isCoolingDown(state.providerId)) {
    // warming up after a recent failure: let the next search in the cooldown
    // line decide, surfacing this as a notice instead of a dead-end error
    return Promise.resolve({ skipped: `${state.name} is warming up after recent failures` });
  }
  return runWithTimeout(state.run(signal), timeoutMs).then(
    sources => {
      markSuccess(state.providerId);
      const limited = sources.sources.slice(0, MAX_SOURCES_PER_PROVIDER);
      if (limited.length > 0) cacheSet(key, JSON.stringify(limited));
      return { result: { ...sources, sources: limited } };
    },
    error => {
      // too slow is a failure too, otherwise a hung provider would drag every
      // query for the full wall budget without ever backing off
      markFailure(state.providerId);
      const detail = signal.aborted
        ? `timed out after the ${Math.max(1, Math.round(wallMs / 1000))}s deadline`
        : (error instanceof Error ? error.message : 'unknown error');
      return { error: `${state.name}: ${detail}`, errorRaw: error, errorDetail: detail };
    }
  );
};

const failureFromError = (providerId: string, name: string, error: unknown): ProviderFailure => {
  const text = error instanceof Error ? error.message : String(error);
  let kind: SearchErrorKind;
  let httpStatus: number | undefined;
  if (error instanceof SearchTransportError) {
    kind = error.kind;
    httpStatus = error.httpStatus;
  } else if (/\brate[- ]?(?:limi?ted|limit)\b|\btoo many requests\b|\b429\b/i.test(text)) {
    kind = 'rate-limited';
  } else if (/\btimed out\b|\btimeout\b/i.test(text)) {
    kind = 'timeout';
  } else {
    kind = 'unavailable';
  }

  if (kind === 'rate-limited') {
    return {
      providerId, providerName: name, status: 'failed', kind, httpStatus,
      statusLabel: 'Rate limited',
      hint: `${name} has reached its rate limit for now. It recovers automatically in a few minutes.`
    };
  }
  if (kind === 'timeout') {
    return {
      providerId, providerName: name, status: 'failed', kind,
      statusLabel: 'Timed out',
      hint: `${name} took too long to respond this time. It will try again on the next search.`
    };
  }
  if (kind === 'unreachable') {
    return {
      providerId, providerName: name, status: 'failed', kind,
      statusLabel: 'Offline',
      hint: `Could not reach ${name}. Check your internet connection and try again.`
    };
  }
  return {
    providerId, providerName: name, status: 'failed', kind,
    statusLabel: 'Unavailable',
    hint: `${name} could not be used for this search. It will try again on the next search.`
  };
};

const noticeForSkipped = (name: string, providerId: string): ProviderNotice => {
  const backoff = failureCount(providerId);
  return {
    providerName: name,
    status: 'resting',
    kind: 'cooling',
    statusLabel: backoff > 0 ? 'Resting after a failure' : 'Paused',
    hint: backoff > 0 ? `${name} had a recent failure and is resting temporarily. It will try again on the next search.` : `${name} is unavailable right now. It will try again on the next search.`
  };
};

export const runWebSearch = async (tools: SearchRuntimeItem[], prompt: string, options?: WebSearchOptions): Promise<WebSearchOutcome> => {
  const query = prompt.replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!query) return { context: '', sources: [], providersUsed: [], providerFailures: [], providerNotices: [] };
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
  const states: ProviderSettleState[] = [
    ...apiTools.map(tool => ({ key: cacheKey(tool.toolId, query), providerId: tool.toolId, name: tool.name, run: (signal: AbortSignal) => runApi(tool, signal) })),
    ...FREE_PROVIDERS.map(provider => ({ key: cacheKey(provider.id, query), providerId: provider.id, name: provider.name, run: (signal: AbortSignal) => provider.run(query, signal) }))
  ];
  const settled = await Promise.all(states.map(state => settleWithGuard(state, query, budget.signal, wallMs, timeoutMs)));
  clearTimeout(budgetTimer);

  const results: SearchProviderResult[] = [];
  let failures: ProviderFailure[] = [];
  const notices: ProviderNotice[] = [];
  for (let index = 0; index < settled.length; index++) {
    const attempt = settled[index];
    const state = states[index];
    if (attempt.result && attempt.result.sources.length > 0) results.push(attempt.result);
    else if (attempt.error) failures.push(failureFromError(state.providerId, state.name, attempt.errorRaw ?? new Error(attempt.errorDetail || attempt.error)));
    else if (attempt.skipped) notices.push(noticeForSkipped(state.name, state.providerId));
  }

  // first pass empty: rescue path, retry the down engines one by one
  // (wikipedia first — the lightest, least-blocked endpoint) each under a
  // fresh 2.5s controller so the aborted share wall cannot cancel the retry;
  // rate-limited engines are skipped — an immediate re-hit cannot clear an
  // IP quota and would only double the backoff
  if (results.length === 0) {
    const rescueable = new Set(failures.filter(failure => failure.kind !== 'rate-limited').map(failure => failure.providerId));
    const retries = WARMUP_ORDER
      .map(providerId => {
        const index = states.findIndex(state => state.providerId === providerId);
        return index === -1 ? null : { state: states[index], attempt: settled[index] };
      })
      .filter((entry): entry is { state: ProviderSettleState, attempt: ProviderAttempt } =>
        Boolean(entry && entry.attempt.error && !entry.attempt.skipped && rescueable.has(entry.state.providerId)));
    if (retries.length > 0) {
      const rescueBudget = new AbortController();
      const rescueTimer = setTimeout(() => rescueBudget.abort(), WARMUP_RETRY_BUDGET_MS);
      try {
        for (const { state } of retries) {
          const retry = await settleWithGuard(state, query, rescueBudget.signal, WARMUP_RETRY_BUDGET_MS, timeoutMs, true);
          if (retry.result && retry.result.sources.length > 0) {
            failures = failures.filter(failure => failure.providerId !== state.providerId);
            results.push(retry.result);
            break;
          }
        }
      } finally {
        clearTimeout(rescueTimer);
      }
    }
    // rescued answer still lists the engines that stayed down, so the card
    // can explain the partial degradation instead of a silent success
  }

  const providerNotice = buildProviderNotice(failures, notices);
  if (results.length === 0) {
    const lines = buildFailureLines(failures.length > 0 ? failures : notices);
    return {
      context: [
        'Web Search unavailable',
        'The search engines could not return results for this query.',
        ...lines,
        'Answer from your own knowledge without claiming you searched the web or quoting sources. If the topic is time-sensitive, tell the user web search is temporarily unavailable.'
      ].join('\n'),
      sources: [],
      providersUsed: [],
      providerFailures: failures,
      providerNotices: notices,
      providerNotice
    };
  }

  const sources = mergeProviderResults(results, maxResults);
  return {
    context: [
      formatSearchContext(results, sources),
      providerNotice,
      'Search instructions: treat these sources as current external context, prefer the most relevant and recent sources, and cite source numbers inline only for factual claims that are supported by the listed sources. Do not cite unsupported claims, do not invent source titles or URLs, and do not expose raw search diagnostics to the user.'
    ].filter(Boolean).join('\n\n').slice(0, MAX_SEARCH_CONTEXT_CHARS),
    sources,
    providersUsed: results.map(result => result.providerName),
    providerFailures: failures,
    providerNotices: notices,
    providerNotice
  };
};

const friendlyFailure = (kind: SearchErrorKind, name: string): string => {
  if (kind === 'rate-limited') return `${name} hit its rate limit`;
  if (kind === 'timeout') return `${name} timed out`;
  if (kind === 'unreachable') return `${name} could not be reached`;
  return `${name} was unavailable`;
};

type ProviderLine = ProviderFailure | ProviderNotice;

const buildFailureLines = (lines: ProviderLine[]): string[] =>
  lines.slice(0, 6).map(line =>
    line.status === 'failed' ? friendlyFailure(line.kind, line.providerName) : `${line.providerName} paused for this search`);

// partial outage stays one quiet line so the model does not open the answer
// with search apologies; the full card details reach the user directly
const buildProviderNotice = (failures: ProviderFailure[], notices: ProviderNotice[]): string => {
  const failed = failures.slice(0, 3).map(failure => friendlyFailure(failure.kind, failure.providerName));
  const resting = notices.slice(0, 3).map(notice => `${notice.providerName} could not be used`);
  const lines = [...failed, ...resting];
  if (lines.length === 0) return '';
  return `Search note: ${lines.join('; ')}. Answer from the sources provided for this query.`;
};

const formatSearchContext = (results: SearchProviderResult[], merged: SearchSource[]): string => [
  `Web Search Sources from ${results.map(result => result.providerName).join(', ')} (${results.length} provider${results.length === 1 ? '' : 's'} in parallel)`,
  merged.map((source, index) => [
    `[${index + 1}] ${source.title}`,
    `URL: ${source.url}`,
    source.snippet ? `Snippet: ${source.snippet}` : ''
  ].filter(Boolean).join('\n')).join('\n\n')
].join('\n\n');
