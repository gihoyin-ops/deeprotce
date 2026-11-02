const COOLDOWN_MS = 15000;
const MAX_COOLDOWN_MS = 5 * 60000;
const CACHE_TTL_MS = 10 * 60000;
const CACHE_MAX_ENTRIES = 500;

interface CacheEntry {
  at: number;
  value: string;
}
interface State {
  cooldownUntil: number;
  failures: number;
}

const cache = new Map<string, CacheEntry>();
const states = new Map<string, State>();

// short-lived responses keep repeat deep research queries off rate limited endpoints
export const cacheGet = (key: string): string | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

export const cacheSet = (key: string, value: string) => {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { at: Date.now(), value });
};

export const isCoolingDown = (key: string): boolean => {
  const state = states.get(key);
  return Boolean(state && state.cooldownUntil > Date.now());
};

// exponential backoff after failures, capped; steady wins reset the provider
export const markFailure = (key: string) => {
  const failures = (states.get(key)?.failures || 0) + 1;
  const cooldownUntil = Date.now() + Math.min(MAX_COOLDOWN_MS, COOLDOWN_MS * Math.pow(2, failures - 1));
  states.set(key, { cooldownUntil, failures });
};

export const markSuccess = (key: string) => {
  states.delete(key);
};
