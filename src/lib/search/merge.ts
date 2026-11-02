import { type SearchProviderResult, type SearchSource } from './types';

export const normalizeSearchSource = (source: Partial<SearchSource>): SearchSource | null => {
  const url = typeof source.url === 'string' ? source.url.trim() : '';
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const host = getHost(url);
  const title = (typeof source.title === 'string' && source.title.trim() ? source.title : host || url).replace(/\s+/g, ' ').trim().slice(0, 120);
  const snippet = typeof source.snippet === 'string' ? source.snippet.replace(/\s+/g, ' ').trim().slice(0, 420) : '';
  return {
    title,
    url,
    ...(snippet ? { snippet } : {}),
    displayUrl: typeof source.displayUrl === 'string' && source.displayUrl.trim() ? source.displayUrl.replace(/\s+/g, ' ').trim().slice(0, 160) : host
  };
};

export const getHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const sourceKey = (url: string) => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return url.replace(/[#?].*$/, '').toLowerCase();
  }
};

const dedupeByHost = (sources: SearchSource[], maxPerHost = 2) => {
  const counts = new Map<string, number>();
  return sources.filter(source => {
    const host = getHost(source.url) || source.url;
    const seen = counts.get(host) || 0;
    counts.set(host, seen + 1);
    return seen < maxPerHost;
  });
};

/**
 * Round-robin interleave, one result per provider per round
 * keeps the merged context diverse even if one provider returns many near-duplicates
 */
const interleave = (lists: SearchSource[][]) => {
  const output: SearchSource[] = [];
  const longest = Math.max(0, ...lists.map(list => list.length));
  for (let index = 0; index < longest; index += 1) {
    for (const list of lists) {
      if (list[index]) output.push(list[index]);
    }
  }
  return output;
};

export const mergeProviderResults = (results: SearchProviderResult[], maxSources: number): SearchSource[] => {
  const byProvider: SearchSource[][] = results
    .map(result => dedupeByHost(result.sources.filter(Boolean)))
    .filter(list => list.length > 0);
  const merged = interleave(byProvider);
  const seen = new Set<string>();
  const unique: SearchSource[] = [];
  for (const source of merged) {
    const key = sourceKey(source.url);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(source);
    if (unique.length >= maxSources) break;
  }
  return unique;
};
