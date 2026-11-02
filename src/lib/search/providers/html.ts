import { searchFetchText, searchFetchJson } from '../http';
import { normalizeSearchSource } from '../merge';
import { type SearchProviderResult, type SearchSource } from '../types';

const stripHtml = (value: string | undefined) => (value || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

export const searchDuckDuckGo = async (query: string, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const html = await searchFetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { signal });
  const sources: SearchSource[] = [];
  const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = resultPattern.exec(html)) && sources.length < 10) {
    const rawUrl = stripHtml(match[1]);
    const parsedUrl = rawUrl.includes('/l/?') ? new URL(rawUrl, 'https://duckduckgo.com').searchParams.get('uddg') || rawUrl : rawUrl;
    const source = normalizeSearchSource({
      url: parsedUrl,
      title: stripHtml(match[2]),
      snippet: stripHtml(match[3])
    });
    if (source) sources.push(source);
  }
  return { providerId: 'duckduckgo', providerName: 'DuckDuckGo', sources };
};

interface WikipediaApiResponse {
  query?: { search?: Array<{ title?: unknown; snippet?: unknown }> };
}

export const searchWikipedia = async (query: string, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const data = await searchFetchJson<WikipediaApiResponse>(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=5`, { signal });
  const entries = data.query?.search || [];
  const sources = entries.flatMap(entry => {
    const title = typeof entry.title === 'string' ? entry.title : '';
    return title
      ? [normalizeSearchSource({
          title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`,
          snippet: typeof entry.snippet === 'string' ? entry.snippet : ''
        })]
      : [];
  }).filter((source): source is SearchSource => Boolean(source));
  return { providerId: 'wikipedia', providerName: 'Wikipedia', sources };
};

// title and snippet each have a primary class and a fallback; a missing one
// degrades to empty rather than throwing the whole block away
const DATE_TAIL = /\s*[-–—|]?\s*\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+(?:ago|old)?\s*[-|–—]?/i;

const splitDateTrim = (value: string) => stripHtml(value).split(DATE_TAIL)[0].trim();

export const searchBrave = async (query: string, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const html = await searchFetchText(`https://search.brave.com/search?q=${encodeURIComponent(query)}`, { signal });
  const blocks = html.split('data-type="web"').slice(1);
  const sources: SearchSource[] = [];
  for (const block of blocks) {
    if (sources.length >= 10) break;
    const urlMatch = block.match(/<a[^>]+href="(https?:\/\/(?!imgs\.search\.brave|search\.brave)[^"]+)"/);
    if (!urlMatch) continue;
    const url = urlMatch[1];
    // title: search-snippet-title first, generic "title" class as fallback
    const titleMatch = block.match(/class="[^"]*search[- ]snippet[- ]title[^"]*"[^>]*>([\s\S]*?)(?:<\/span>|<\/div>|<\/a>)/)
      || block.match(/class="[^"]*title[^"]*"[^>]*>([\s\S]*?)(?:<\/span>|<\/div>|<\/a>)/);
    // snippet: generic-snippet first, snippet-content as fallback
    const snippetMatch = block.match(/class="[^"]*generic-snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p)>/)
      || block.match(/class="[^"]*snippet[- ]content[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p)>/);
    const title = splitDateTrim(titleMatch?.[1] || '').split(' | ')[0];
    const source = normalizeSearchSource({
      url,
      title,
      snippet: stripHtml(snippetMatch?.[1] || '').slice(0, 420)
    });
    if (source) sources.push(source);
  }
  return { providerId: 'brave', providerName: 'Brave Search', sources };
};
