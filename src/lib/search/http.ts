import { type SearchErrorKind } from './types';

const SEARCH_TIMEOUT_MS = 15000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 DeepChat/1.0';

/**
 * Typed transport error so the engine can classify failures (rate limit vs
 * offline vs timeout) instead of parsing English messages.
 */
export class SearchTransportError extends Error {
  readonly kind: SearchErrorKind;
  readonly httpStatus?: number;

  constructor(message: string, kind: SearchErrorKind = 'unavailable', httpStatus?: number) {
    super(message);
    this.name = 'SearchTransportError';
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}

const statusToKind = (status: number): SearchErrorKind => {
  if (status === 403 || status === 429) return 'rate-limited';
  if (status === 408 || status === 504) return 'timeout';
  if (status >= 500) return 'unavailable';
  return 'unavailable';
};

const ABORT_MARKERS: ReadonlyArray<readonly [RegExp, SearchErrorKind]> = [
  [/timed out|timeout|deadline/i, 'timeout'],
  [/(aborted|abort)/i, 'timeout'],
  // fetch network failures: 'fetch failed', 'ECONNREFUSED', 'ENOTFOUND', 'network error', HTTPS tunnels...
  [/fetch failed|network|connection|econn|enotfound|eai_again|etimedout|socket|tls|handshake/i, 'unreachable']
];

const errorText = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error ?? 'unknown error');
};

const classifyUnknown = (error: unknown): { kind: SearchErrorKind, detail: string } => {
  if (error instanceof SearchTransportError) {
    return { kind: error.kind, detail: error.message };
  }
  const raw = errorText(error);
  for (const [pattern, kind] of ABORT_MARKERS) {
    if (pattern.test(raw)) return { kind, detail: raw };
  }
  return { kind: 'unavailable', detail: raw };
};

export interface SearchRequestInit {
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  redirect?: 'manual' | 'follow' | 'error';
  timeoutMs?: number;
  signal?: AbortSignal;
}

const mergeHeaders = (extra: Record<string, string> = {}): RequestInit['headers'] => ({
  'User-Agent': USER_AGENT,
  'Accept-Language': 'en-US,en;q=0.9',
  ...extra
});

export const searchFetch = async (url: string, init?: SearchRequestInit) => {
  const signals: AbortSignal[] = [AbortSignal.timeout(init?.timeoutMs ?? SEARCH_TIMEOUT_MS)];
  if (init?.signal) signals.push(init.signal);
  let response: Response;
  try {
    response = await fetch(url, {
      method: init?.method ?? 'GET',
      body: init?.body,
      redirect: init?.redirect,
      cache: 'no-store',
      signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0],
      headers: mergeHeaders(init?.headers)
    });
  } catch (error) {
    const { kind, detail } = classifyUnknown(error);
    throw new SearchTransportError(detail, kind);
  }
  if (!response.ok && !init?.redirect) {
    throw new SearchTransportError(`search request failed with ${response.status}`, statusToKind(response.status), response.status);
  }
  return response;
};

export const searchFetchText = async (url: string, init?: SearchRequestInit) =>
  searchFetch(url, init).then(response => response.text());

export const searchFetchJson = async <T>(url: string, init?: SearchRequestInit): Promise<T> =>
  searchFetch(url, { ...init, headers: { ...init?.headers, Accept: 'application/json' } }).then(response => response.json() as Promise<T>);
