import { searchFetch } from '../http';
import { getHost, normalizeSearchSource } from '../merge';
import { type SearchProviderResult, type SearchSource } from '../types';

// hosted streamable HTTP endpoint, free tier, no key
const PARALLEL_MCP_ENDPOINT = 'https://search.parallel.ai/mcp';

interface JsonRpcResult {
  content?: Array<{ type?: unknown; text?: unknown }>;
  isError?: boolean;
}
interface JsonRpcBody {
  result?: JsonRpcResult;
  error?: { code?: unknown; message?: unknown };
}
interface ParallelSearchResult {
  url?: unknown;
  title?: unknown;
  excerpts?: Array<unknown>;
}
interface ParallelResponse {
  results?: Array<ParallelSearchResult>;
}

const rpcRequest = async (request: object, signal?: AbortSignal): Promise<JsonRpcBody> => {
  const response = await searchFetch(PARALLEL_MCP_ENDPOINT, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify(request)
  });
  const body = (await response.json()) as JsonRpcBody;
  if (body.error) {
    throw new Error(`MCP error: ${typeof body.error.message === 'string' ? body.error.message : 'unknown'}`);
  }
  return body;
};

const extractText = (body: JsonRpcBody) => (body.result?.content || [])
  .filter(item => item.type === 'text' && typeof item.text === 'string')
  .map(item => item.text as string)
  .join('');

const parseParallelSources = (text: string): SearchSource[] => {
  const data = JSON.parse(text) as ParallelResponse;
  const results = Array.isArray(data.results) ? data.results : [];
  return results.flatMap(result => {
    const url = typeof result.url === 'string' ? result.url : '';
    const title = typeof result.title === 'string' ? result.title : '';
    const excerpt = Array.isArray(result.excerpts)
      ? result.excerpts.filter((item): item is string => typeof item === 'string').join(' ').slice(0, 420)
      : '';
    return url
      ? [normalizeSearchSource({
          url,
          title: title || getHost(url),
          snippet: excerpt
        })]
      : [];
  }).filter((source): source is SearchSource => Boolean(source));
};

// stateless single request keeps each search at one call against the free rate limit
export const searchParallel = async (query: string, signal?: AbortSignal): Promise<SearchProviderResult> => {
  const cleanQuery = query.replace(/\s+/g, ' ').trim();
  const objective = `Find fresh, factual web sources answering: ${cleanQuery}`;
  const result = await rpcRequest(
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'web_search',
        arguments: {
          objective,
          search_queries: [cleanQuery],
          max_results: 6
        }
      }
    },
    signal
  );
  if (result.result?.isError) {
    throw new Error('Parallel web_search returned an error');
  }
  return { providerId: 'parallel', providerName: 'Parallel Search', sources: parseParallelSources(extractText(result)) };
};
