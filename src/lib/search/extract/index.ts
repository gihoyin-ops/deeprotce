import { localExtract } from './local';
import { jinaExtract } from './jina';
import { parallelExtract } from './parallel';
import { isCoolingDown, markFailure, markSuccess } from '../guard';

const MAX_EXTRACT_CHARS = 6000;
const MIN_LOCAL_CHARS = 400;
const MIN_HOSTED_CHARS = 80;
const CACHE_TTL_MS = 30 * 60000;
const CACHE_MAX_ENTRIES = 200;
// one wall clock across the whole pipeline, local first then hosted, so a chat
// turn never stalls longer than this on a dead URL
const WALL_BUDGET_MS = 15000;

type ExtractResult = { url: string; text: string };

interface CacheEntry {
  at: number;
  value: ExtractResult;
}

const cache = new Map<string, CacheEntry>();

// pages rarely change mid-session; repeated deep research fetches skip the network
const cachedGet = (url: string): ExtractResult | null => {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(url);
    return null;
  }
  return entry.value;
};
const cachedSet = (url: string, value: ExtractResult) => {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(url, { at: Date.now(), value });
};

const normalizeUrl = (raw: string) => raw.replace(/[)\],.;!?]+$/g, '');
const length = (value: ExtractResult) => value.text.replace(/\s+/g, '').length;
const truncate = (result: ExtractResult): ExtractResult => ({ url: result.url, text: result.text.slice(0, MAX_EXTRACT_CHARS) });

// local first to keep egress private
// hosted engines run in parallel, failing ones back off automatically
export const extractUrlContent = async (rawUrl: string): Promise<ExtractResult> => {
  const url = normalizeUrl(rawUrl);
  const cached = cachedGet(url);
  if (cached) return cached;

  // aborting the shared controller cancels the local and hosted fetches at the cap
  const budget = new AbortController();
  const budgetTimer = setTimeout(() => budget.abort(), WALL_BUDGET_MS);

  // http.ts already aborts on its own 9s timeout, so a hung local page cannot
  // outlive the whole extraction pipeline
  let localError: string | null = null;
  try {
    const local = await localExtract(url);
    if (length(local) >= MIN_LOCAL_CHARS) {
      const done = truncate(local);
      clearTimeout(budgetTimer);
      cachedSet(url, done);
      return done;
    }
    localError = 'local extraction returned too little text';
  } catch (error) {
    localError = `local: ${error instanceof Error ? error.message : 'unknown error'}`;
  }
  if (budget.signal.aborted) {
    clearTimeout(budgetTimer);
    throw new Error(`Web extraction failed: timed out after ${WALL_BUDGET_MS}ms`);
  }

  // host engines run in parallel
  // the shared signal cancels any still in flight at the cap
  const attempt = (key: string, run: (signal?: AbortSignal) => Promise<ExtractResult>) => {
    if (isCoolingDown(key)) {
      return Promise.resolve({ error: `${key} is cooling down after failures`, value: null });
    }
    return run(budget.signal)
      .then(value => { markSuccess(key); return { error: null as string | null, value } })
      .catch(error => {
        // unlike search, a wall abort here is our own cancellation because a
        // slow local leg burned the budget. Only endpoint errors mark failure
        const detail = error instanceof Error ? error.message : 'unknown error';
        if (!budget.signal.aborted) markFailure(key);
        return { error: `${key}: ${budget.signal.aborted ? 'stopped by the extraction wall budget' : detail}`, value: null };
      });
  };

  const settle = await Promise.all([
    attempt('jina', signal => jinaExtract(url, signal)),
    attempt('parallel', signal => parallelExtract(url, signal))
  ]);
  clearTimeout(budgetTimer);

  const failures: string[] = [];
  const candidates: ExtractResult[] = [];
  for (const outcome of settle) {
    if (outcome.error) failures.push(outcome.error);
    else if (outcome.value && length(outcome.value) >= MIN_HOSTED_CHARS) candidates.push(outcome.value);
  }
  const best = candidates.sort((a, b) => length(b) - length(a))[0];
  if (!best) {
    const reasons = localError ? [localError, ...failures] : failures;
    throw new Error(reasons.length > 0 ? `Web extraction failed: ${reasons.join('; ')}` : 'Web extraction returned no content');
  }
  const done = truncate(best);
  cachedSet(url, done);
  return done;
};
