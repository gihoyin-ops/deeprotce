type BucketEntry = {
  tokens: number;
  updatedAt: number;
  strikes: number[];
};

type RateState = {
  entries: Record<string, BucketEntry>;
  banned: Set<string>;
};

const CAPACITY = 120;
const REFILL_PER_SECOND = 2;
const STRIKE_WINDOW_MS = 600_000;
const STRIKE_LIMIT = 3;

type RateCheckResult = {
  status: 'ok' | 'retry' | 'banned';
  retryAfterSeconds?: number;
};

const getState = (): RateState => {
  // warm serverless invocations share globalThis; a cold start resets the buckets
  const g = globalThis as { __dcRateState?: RateState };
  return (g.__dcRateState ??= { entries: {}, banned: new Set() });
};

export const getClientIp = (req: Request | { headers: Headers }): string => {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded !== null) {
    const first = forwarded.split(',')[0]?.trim();
    if (first !== undefined && first !== '') return first;
  }
  return req.headers.get('x-real-ip') ?? '__direct__';
};

export const isBanned = (ip: string): boolean => getState().banned.has(ip);

export const checkApiRateLimits = (ip: string): RateCheckResult => {
  const state = getState();
  if (state.banned.has(ip)) return { status: 'banned' };

  const now = Date.now();
  let entry = state.entries[ip];
  if (entry === undefined) {
    entry = { tokens: CAPACITY, updatedAt: now, strikes: [] };
    state.entries[ip] = entry;
  }

  const elapsedSeconds = Math.max(0, (now - entry.updatedAt) / 1000);
  // capacity 120 at 2/s refill: a full bucket is a 60s burst
  entry.tokens = Math.min(CAPACITY, entry.tokens + elapsedSeconds * REFILL_PER_SECOND);
  entry.updatedAt = now;

  if (entry.tokens >= 1) {
    entry.tokens -= 1;
    return { status: 'ok' };
  }

  entry.strikes.push(now);
  while (entry.strikes.length > 0 && now - entry.strikes[0] > STRIKE_WINDOW_MS) {
    entry.strikes.shift();
  }
  if (entry.strikes.length >= STRIKE_LIMIT) {
    // permanent for this instance: a repeat offender stays locked until restart
    state.banned.add(ip);
    return { status: 'banned' };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((1 - entry.tokens) / REFILL_PER_SECOND));
  return { status: 'retry', retryAfterSeconds };
};
