const SEARCH_TIMEOUT_MS = 15000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 DeepChat/1.0';

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
  const response = await fetch(url, {
    method: init?.method ?? 'GET',
    body: init?.body,
    redirect: init?.redirect,
    cache: 'no-store',
    signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0],
    headers: mergeHeaders(init?.headers)
  });
  if (!response.ok && !init?.redirect) {
    throw new Error(`search request failed with ${response.status}`);
  }
  return response;
};

export const searchFetchText = async (url: string, init?: SearchRequestInit) =>
  searchFetch(url, init).then(response => response.text());

export const searchFetchJson = async <T>(url: string, init?: SearchRequestInit): Promise<T> =>
  searchFetch(url, { ...init, headers: { ...init?.headers, Accept: 'application/json' } }).then(response => response.json() as Promise<T>);
