import { searchFetchText } from '../http';
import { assertEgressUrl } from '@/lib/security/url-guard';

const JINA_TIMEOUT_MS = 10000;

// free tier, no key; returns markdown-ish text for any public URL
export const jinaExtract = async (rawUrl: string, signal?: AbortSignal): Promise<{ url: string; text: string }> => {
  const url = await assertEgressUrl(rawUrl);
  const text = await searchFetchText(`https://r.jina.ai/${url}`, { signal, timeoutMs: JINA_TIMEOUT_MS });
  // Jina prepends a Title/URL Source metadata block; keep only the page body
  const bodyIndex = text.indexOf('Markdown Content:');
  return { url, text: (bodyIndex >= 0 ? text.slice(bodyIndex + 'Markdown Content:'.length) : text).trim() };
};
