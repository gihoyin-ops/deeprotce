import { assertEgressUrl } from '@/lib/security/url-guard';
import { searchFetch } from '../http';

const STRIP_TAGS = ['script', 'style', 'noscript', 'svg', 'nav', 'header', 'footer', 'form', 'aside', 'button', 'iframe'];
const REDIRECT_CODES = [301, 302, 303, 307, 308];
const MAX_REDIRECTS = 3;
const LOCAL_TIMEOUT_MS = 9000;
const LOCAL_ACCEPT = 'text/html, text/plain, text/markdown, application/json, application/xhtml+xml;q=0.9, */*;q=0.1';

// strip self-closing icons before paired bodies so document tails survive
const stripTagBodies = (html: string) => STRIP_TAGS.reduce((markup, tag) => {
  let text = markup;
  text = text.replace(new RegExp(`<${tag}\\b[^>]*?/\\s*>`, 'gi'), ' ');
  text = text.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), ' ');
  return text.replace(new RegExp(`<${tag}\\b[^>]*>`, 'gi'), ' ');
}, html);

// prefer the main or article root when present
const pickBody = (html: string) => {
  const lower = html.toLowerCase();
  const starts = [lower.indexOf('<main'), lower.indexOf('<article')].filter(i => i >= 0);
  if (starts.length === 0) return html;
  const start = starts.reduce((a, b) => Math.min(a, b));
  return html.slice(start);
};

const cleanHtml = (html: string) =>
  stripTagBodies(pickBody(html))
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>(?![^>]*)/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, '\n')
    .replace(/<(li)[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n\n')
    .trim();

// re-assert each redirect target to prevent SSRF via open redirects
const fetchReadable = async (rawUrl: string, redirects = 0) => {
  const url = await assertEgressUrl(rawUrl);
  const response = await searchFetch(url, {
    method: 'GET',
    redirect: 'manual',
    timeoutMs: LOCAL_TIMEOUT_MS,
    headers: { Accept: LOCAL_ACCEPT }
  });
  if (REDIRECT_CODES.includes(response.status)) {
    if (redirects >= MAX_REDIRECTS) throw new Error('Too many redirects');
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirect missing location');
    return fetchReadable(new URL(location, url).toString(), redirects + 1);
  }
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!/(text\/|application\/json|application\/xhtml\+xml)/i.test(contentType)) {
    throw new Error('URL did not return readable text');
  }
  return { finalUrl: response.url || url, contentType, text: await response.text() };
};

export const localExtract = async (rawUrl: string): Promise<{ url: string; text: string }> => {
  const { finalUrl, contentType, text: raw } = await fetchReadable(rawUrl);
  const text = contentType.includes('json') ? raw : cleanHtml(raw);
  return { url: finalUrl, text };
};
