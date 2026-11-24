export interface SearchSource {
  title: string;
  url: string;
  snippet?: string;
  displayUrl?: string;
  siteName?: string;
  publishedDate?: string;
}

export type SearchStatus = 'idle' | 'searching' | 'completed';

export type ThinkingStep =
  | { type: 'thought'; text: string }
  | { type: 'search'; query?: string; status: 'searching' | 'completed'; count?: number }
  | { type: 'read'; status?: 'reading' | 'completed'; count?: number; sources: SearchSource[] };

const KNOWN_SITE_NAMES: Array<[string, string]> = [
  ['wikipedia.org', 'Wikipedia'],
  ['bbc.co.uk', 'BBC'],
  ['bbc.com', 'BBC'],
  ['reuters.com', 'Reuters'],
  ['kompas.com', 'Kompas'],
  ['detik.com', 'Detik'],
  ['tempo.co', 'Tempo'],
  ['cnnindonesia.com', 'CNN Indonesia'],
  ['cnbcindonesia.com', 'CNBC Indonesia'],
  ['antaranews.com', 'Antara'],
  ['theguardian.com', 'The Guardian'],
  ['nytimes.com', 'New York Times'],
  ['amnesty.org', 'Amnesty International'],
  ['idf.il', 'IDF'],
  ['eastasiaforum.org', 'East Asia Forum'],
  ['github.com', 'GitHub'],
  ['reddit.com', 'Reddit'],
  ['youtube.com', 'YouTube'],
  ['yna.co.kr', '연합뉴스'],
  ['komdigi.go.id', 'Komdigi']
];

export const getSourceHost = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export const getSourceFaviconUrl = (source: SearchSource): string => {
  const host = getSourceHost(source.url) || source.displayUrl || source.url;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
};

const matchKnownSiteName = (host: string): string => {
  const normalized = host.toLowerCase().replace(/^www\./, '');
  if (!normalized) return '';
  for (const [domain, label] of KNOWN_SITE_NAMES) {
    if (normalized === domain || normalized.endsWith(`.${domain}`)) {
      return label;
    }
  }
  return '';
};

const extractTitleSiteSuffix = (title: string): string => {
  const parts = title.split(/\s+[|\-–—]\s+/).map(part => part.trim()).filter(Boolean);
  if (parts.length < 2) return '';
  const tail = parts[parts.length - 1];
  if (tail.length >= 2 && tail.length <= 28 && !/^\d+$/.test(tail)) {
    return tail;
  }
  return '';
};

export const getSourceSiteName = (source: SearchSource): string => {
  const explicit = source.siteName?.trim();
  if (explicit) return explicit;

  const host = getSourceHost(source.url);
  const known = matchKnownSiteName(host);
  if (known) return known;

  const fromTitle = source.title ? extractTitleSiteSuffix(source.title) : '';
  if (fromTitle) return fromTitle;

  const cleanDisplay = source.displayUrl?.trim().replace(/^www\./, '');
  return cleanDisplay || host || source.title || 'source';
};

export const formatSourceDate = (date?: string): string => {
  const raw = date?.trim() || '';
  if (!raw) return '';

  // Avoid parsing bare 4-digit numbers or purely numeric strings as Unix/epoch dates
  if (/[a-zA-Z]|[-/]/.test(raw) && !/\bago\b/i.test(raw)) {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      const d = new Date(parsed);
      const year = d.getUTCFullYear();
      if (year >= 1990 && year <= 2100) {
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
      }
    }
  }

  return raw.slice(0, 24);
};

export const normalizeSourceUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();
  }
};

export const getSourceByUrl = (url: string, sources: SearchSource[]): SearchSource | null => {
  const normalized = normalizeSourceUrl(url);
  return sources.find(source => normalizeSourceUrl(source.url) === normalized) || null;
};

const normalizeCitationText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.(com|co\.id|id|net|org|io)$/i, '')
    .replace(/[^a-z0-9]+/g, '');

export const getSourceIndex = (label: string, sources: SearchSource[]): number => {
  const normalized = normalizeCitationText(label);
  if (!normalized) return -1;
  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= sources.length) {
    return numeric - 1;
  }
  return sources.findIndex(source => {
    const host = getSourceHost(source.url);
    const sourceValues = [
      source.title,
      source.siteName,
      source.displayUrl,
      host,
      host.split('.')[0]
    ]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map(normalizeCitationText)
      .filter(Boolean);
    return sourceValues.some(
      value => value === normalized || value.includes(normalized) || normalized.includes(value)
    );
  });
};

export const getSourceReferences = (label: string, sources: SearchSource[]): number[] => {
  const tokens = label.split(/[,;]+/).map(item => item.trim()).filter(Boolean);
  const candidates = tokens.length > 1 ? tokens : [label.trim()];
  const seen = new Set<number>();
  const indices: number[] = [];

  for (const candidate of candidates) {
    const index = getSourceIndex(candidate, sources);
    if (index >= 0 && !seen.has(index)) {
      seen.add(index);
      indices.push(index);
    }
  }

  return indices;
};

const stripCodeFromMarkdown = (markdown: string): string =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]+`/g, ' ');

export const extractCitedSourceIndices = (markdown: string, sources: SearchSource[]): number[] => {
  if (!markdown || sources.length === 0) return [];
  const plain = stripCodeFromMarkdown(markdown);
  const seen = new Set<number>();
  const ordered: number[] = [];

  const pushIndex = (index: number) => {
    if (index >= 0 && index < sources.length && !seen.has(index)) {
      seen.add(index);
      ordered.push(index);
    }
  };

  // Match bracketed citations such as [1], [1, 2], [Wikipedia]
  const bracketPattern = /\[([^\[\]\n]{1,64})\](?:\(([^)\s]+)\))?/g;
  let match: RegExpExecArray | null;
  while ((match = bracketPattern.exec(plain)) !== null) {
    const href = match[2];
    if (href) {
      const byUrlIndex = sources.findIndex(source => normalizeSourceUrl(source.url) === normalizeSourceUrl(href));
      if (byUrlIndex >= 0) {
        pushIndex(byUrlIndex);
      }
      continue;
    }
    const refs = getSourceReferences(match[1], sources);
    for (const index of refs) {
      pushIndex(index);
    }
  }

  return ordered;
};

export type CitationToken =
  | { type: 'text'; text: string }
  | { type: 'citation'; sources: SearchSource[] };

export const tokenizeTextWithCitations = (text: string, sources: SearchSource[]): CitationToken[] => {
  if (!text || sources.length === 0) {
    return text ? [{ type: 'text', text }] : [];
  }

  const adjacentCitationsPattern = /(\[[^\[\]\n]{1,64}\](?!\())(?:\s*,?\s*\[[^\[\]\n]{1,64}\](?!\())*/g;
  const singleBracketPattern = /\[([^\[\]\n]{1,64})\](?!\()/g;
  const tokens: CitationToken[] = [];
  let cursor = 0;

  const pushText = (chunk: string) => {
    if (!chunk) return;
    const prev = tokens[tokens.length - 1];
    if (prev && prev.type === 'text') {
      prev.text += chunk;
    } else {
      tokens.push({ type: 'text', text: chunk });
    }
  };

  for (const runMatch of text.matchAll(adjacentCitationsPattern)) {
    const runStart = runMatch.index ?? 0;
    const runText = runMatch[0];
    if (runStart > cursor) {
      pushText(text.slice(cursor, runStart));
    }

    const bracketMatches = [...runText.matchAll(singleBracketPattern)];
    const resolvedPerBracket = bracketMatches.map(match => ({
      raw: match[0],
      index: match.index ?? 0,
      indices: getSourceReferences(match[1], sources)
    }));

    if (resolvedPerBracket.length > 0 && resolvedPerBracket.every(item => item.indices.length > 0)) {
      const seen = new Set<number>();
      const group: SearchSource[] = [];
      for (const item of resolvedPerBracket) {
        for (const sourceIndex of item.indices) {
          if (!seen.has(sourceIndex) && sources[sourceIndex]) {
            seen.add(sourceIndex);
            group.push(sources[sourceIndex]);
          }
        }
      }
      if (group.length > 0) {
        tokens.push({ type: 'citation', sources: group });
      } else {
        pushText(runText);
      }
    } else {
      let innerCursor = 0;
      for (const item of resolvedPerBracket) {
        if (item.index > innerCursor) {
          pushText(runText.slice(innerCursor, item.index));
        }
        if (item.indices.length > 0) {
          const group = item.indices.map(idx => sources[idx]).filter(Boolean);
          if (group.length > 0) {
            tokens.push({ type: 'citation', sources: group });
          } else {
            pushText(item.raw);
          }
        } else {
          pushText(item.raw);
        }
        innerCursor = item.index + item.raw.length;
      }
      if (innerCursor < runText.length) {
        pushText(runText.slice(innerCursor));
      }
    }

    cursor = runStart + runText.length;
  }

  if (cursor < text.length) {
    pushText(text.slice(cursor));
  }

  return tokens;
};
