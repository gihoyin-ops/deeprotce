import { searchFetch } from '../http';
import { assertEgressUrl } from '@/lib/security/url-guard';

interface JsonRpcBody {
  result?: { content?: Array<{ type?: unknown; text?: unknown }>; isError?: boolean };
  error?: { message?: unknown };
}
interface ParallelExtractResult {
  url?: unknown;
  title?: unknown;
  excerpts?: Array<unknown>;
}
interface ParallelExtractResponse {
  results?: Array<ParallelExtractResult>;
}

const PARALLEL_MCP_ENDPOINT = 'https://search.parallel.ai/mcp';

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

// free hosted extraction, no key; one request per call, no session handshake
export const parallelExtract = async (rawUrl: string, signal?: AbortSignal): Promise<{ url: string; text: string }> => {
  const url = await assertEgressUrl(rawUrl);
  const result = await rpcRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'web_fetch', arguments: { urls: [url] } }
  }, signal);
  if (result.result?.isError) {
    throw new Error('Parallel web_fetch returned an error');
  }
  const text = (result.result?.content || [])
    .filter(item => item.type === 'text' && typeof item.text === 'string')
    .map(item => item.text as string)
    .join('');
  const data = text ? JSON.parse(text) as ParallelExtractResponse : {};
  const entry = Array.isArray(data.results) ? data.results[0] : null;
  const excerpt = entry && Array.isArray(entry.excerpts)
    ? entry.excerpts.filter((item): item is string => typeof item === 'string').join('\n')
    : '';
  if (!excerpt) throw new Error('Parallel web_fetch returned no content');
  return { url, text: excerpt };
};
