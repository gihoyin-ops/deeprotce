import { NextResponse } from 'next/server';
import { getPersona } from '@/app/persona';
import {
  getChatCompletionsUrl,
  getCleanBaseUrl,
  normalizeProvider,
  type LlmConnection
} from '@/lib/ai/llm';
import {
  applyOpenAICompatibleReasoning,
  readLLMSettings
} from '@/lib/settings/llm-settings';
import { isAiLogEnabled, logAiExchange, streamWithAiLog } from '@/lib/ai/ai-logs';
import {
  buildRelayHeaders,
  fetchRelayModels,
  formatRelayError,
  getEnvModelIds,
  getLiveChatConnection,
  getLiveLiteConnection,
  getLiveImageConfig,
  getLiveModels,
  LIVE_CHAT_CONNECTION_ID,
  LIVE_LITE_CONNECTION_ID,
  relayErrorResponse,
  resolveRelayClientId
} from '@/lib/ai/live';
import {
  buildDynamicSearchSystemPrompt,
  buildSearchSystemPrompt,
  collectSearchRuntimeContext,
  executeDynamicReadPage,
  executeDynamicWebSearch,
  normalizeChatTools
} from '@/lib/search/runtime';
import type { SearchSource } from '@/lib/search';
import { normalizeSourceUrl } from '@/lib/search/source-display';
import { assertEgressUrl } from '@/lib/security/url-guard';
import { MAX_ATTACHMENT_BYTES, MAX_MESSAGE_CHARS, validateChatBody } from '@/lib/security/limits';
import { checkUsageBudget, recordTokens } from '@/lib/security/usage';
import { checkAccountUsageBudget } from '@/backend/meter/turso-usage';
import { recordAccountModelUsage } from '@/backend/profile/stats';
import { completeChatTokens, estimateChatPromptTokens, meterSseBody } from '@/lib/security/usage-meter';
import { getClientIp } from '@/lib/security/rate-limit';
import { getVerifiedAccount } from '@/lib/security/auth';
import { checkGuestChatRateLimit, GUEST_LIMITS } from '@/lib/security/guest-rate-limit';
import { getModelConfigValue } from '@/lib/ai/models';
import { isImageGenerationModel } from '@/lib/images/image-generation';
import { normalizeImageAspectRatio, type ImageAspectRatio } from '@/lib/images/image-aspect-ratio';
import { TEMP_FILE_DIR as TEMP_FILE_ROOT } from '@/lib/data-directories';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_OPENAI_COMPATIBLE_IMAGE_BYTES = 8 * 1024 * 1024;

const encoder = new TextEncoder();
const DONE_BYTES = encoder.encode('data: [DONE]\n\n');

type AttachedFileInput = {
  name?: unknown;
  ext?: unknown;
  content?: string;
  dataUrl?: string;
  base64?: string;
  size?: number;
};

type ChatMessage = {
  role: string;
  content?: string;
  attachedFiles?: AttachedFileInput[];
  imageGenerationEnabled?: boolean;
  imageAspectRatio?: ImageAspectRatio;
  [key: string]: unknown;
};

type OpenAICompatibleContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: string | { url: string } };

type OpenAICompatibleMessage = {
  role: string;
  content: string | OpenAICompatibleContentPart[] | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

const OPENAI_SEARCH_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the web for current facts, news, people, prices, releases, or information you are not certain about. Correct any obvious user typos in the query.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Concise, typo-corrected web search query.' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_page',
      description: 'Read the full text content of a specific web page URL from search results or the user message to verify details.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The full https:// URL to read.' }
        },
        required: ['url']
      }
    }
  }
];

const MAX_TOOL_ROUNDS = 6;

type AttachmentPayload =
  | {
      kind: 'text';
      name: string;
      ext: string;
      filePath: string;
      mimeType: string;
      size: number;
      text: string;
      dataUrl?: string;
    }
  | {
      kind: 'binary';
      name: string;
      ext: string;
      filePath: string;
      mimeType: string;
      size: number;
      dataUrl?: string;
    }
  | {
      kind: 'missing';
      name: string;
      ext: string;
      mimeType: string;
      size: number;
      error: string;
      dataUrl?: string;
    };

const MIME_BY_EXT: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  js: 'text/javascript',
  jsx: 'text/javascript',
  ts: 'text/typescript',
  tsx: 'text/typescript',
  html: 'text/html',
  css: 'text/css',
  xml: 'application/xml',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska'
};

const TEXT_EXTS: Record<string, true> = {
  txt: true, md: true, csv: true, json: true, js: true, jsx: true, ts: true, tsx: true, html: true, css: true, xml: true,
  yml: true, yaml: true, log: true, env: true, ini: true, toml: true, sql: true, py: true, java: true, c: true, cpp: true,
  cs: true, go: true, rs: true, php: true, rb: true, sh: true, bat: true, ps1: true
};

const OPENAI_COMPATIBLE_IMAGE_MIME_TYPES: Record<string, true> = {
  'image/png': true,
  'image/jpeg': true,
  'image/webp': true,
  'image/gif': true
};

const streamHeaders = (provider: string) => ({
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
  'x-provider': provider
});

const sse = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`;

const prependSseEvents = (body: ReadableStream<Uint8Array> | null, events: unknown[]) => {
  return new ReadableStream({
    async start(controller) {
      try {
        for (const event of events) {
          controller.enqueue(encoder.encode(sse(event)));
        }
        if (!body) {
          controller.enqueue(DONE_BYTES);
          controller.close();
          return;
        }
        const reader = body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(sse({ error: getErrorMessage(error) })));
        controller.enqueue(DONE_BYTES);
        controller.close();
      }
    }
  });
};

type GeneratedImageOutput = {
  mimeType: string;
  base64?: string;
  url?: string;
  prompt?: string;
};

const buildSearchCompletionEvents = (sources: SearchSource[], readSources: SearchSource[], searched: boolean, hasReasoning: boolean) => {
  const events: unknown[] = [];
  if (sources.length > 0 || readSources.length > 0) {
    events.push({
      type: 'deepchat_sources',
      sources,
      readSources
    });
  }
  if (searched) {
    events.push({
      type: 'deepchat_search',
      status: 'completed',
      sourceCount: sources.length,
      hasReasoning
    });
  }
  return events;
};

const singleSseResponse = (provider: string, data: unknown, events: unknown[] = []) => {
  const readableStream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(sse(event)));
      }
      controller.enqueue(encoder.encode(sse(data)));
      controller.enqueue(DONE_BYTES);
      controller.close();
    }
  });
  return new Response(readableStream, { headers: streamHeaders(provider) });
};

const getOpenAiCompatibleMessage = (data: unknown) => {
  const choices = data && typeof data === 'object' && 'choices' in data && Array.isArray(data.choices) ? data.choices : [];
  const message = choices[0] && typeof choices[0] === 'object' && 'message' in choices[0] ? choices[0].message : undefined;
  if (!message || typeof message !== 'object') return { content: '', reasoning_content: '' };
  return {
    content: 'content' in message && typeof message.content === 'string' ? message.content : '',
    reasoning_content: 'reasoning_content' in message && typeof message.reasoning_content === 'string' ? message.reasoning_content : ''
  };
};

const getImageGenerationPrompt = (messages: ChatMessage[]) => {
  const latest = [...messages].reverse().find((m: unknown) => isChatMessageLike(m) && m.role === 'user');
  const latestText = getRuntimeMessageText(latest);
  if (latestText.trim()) return latestText.trim();
  return messages
    .filter(message => message.role === 'user' && typeof message.content === 'string')
    .map(message => message.content)
    .filter(Boolean)
    .join('\n\n')
    .trim();
};

const imageOutputToMarkdown = (images: GeneratedImageOutput[], text = '') => [
  text.trim(),
  ...images.map((image, index) => {
    const src = image.base64 ? `data:${image.mimeType};base64,${image.base64}` : image.url || '';
    return src ? `![image_${index + 1}](${src})` : '';
  })
].filter(Boolean).join('\n\n');

const combineAbortSignals = (signal: AbortSignal | undefined, timeoutMs: number): AbortSignal => {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeoutSignal;
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([signal, timeoutSignal]);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted || timeoutSignal.aborted) {
    controller.abort();
  } else {
    signal.addEventListener('abort', abort, { once: true });
    timeoutSignal.addEventListener('abort', abort, { once: true });
  }
  return controller.signal;
};

const isAbortLikeError = (err: unknown, signal?: AbortSignal): boolean => {
  if (signal?.aborted) return true;
  return err instanceof Error && err.name === 'AbortError';
};

const getOpenAIImageSize = (model: string, aspectRatio: ImageAspectRatio) => {
  const isGptImage = /\bgpt-image\b/i.test(model);
  if (aspectRatio === 'auto') return isGptImage ? 'auto' : '1024x1024';
  if (aspectRatio === '1:1') return '1024x1024';
  if (aspectRatio === '3:4' || aspectRatio === '9:16') return isGptImage ? '1024x1536' : '1024x1792';
  return isGptImage ? '1536x1024' : '1792x1024';
};

const getOpenAIImageRequestBody = (model: string, prompt: string, aspectRatio: ImageAspectRatio) => {
  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size: getOpenAIImageSize(model, aspectRatio)
  };
  if (!/\bgpt-image\b/i.test(model)) {
    body.response_format = 'b64_json';
  }
  return body;
};

const getOpenAIGeneratedImages = (data: unknown): GeneratedImageOutput[] => {
  if (!data || typeof data !== 'object' || !('data' in data) || !Array.isArray(data.data)) return [];
  return data.data.map((item): GeneratedImageOutput | null => {
    if (!item || typeof item !== 'object') return null;
    const base64 = 'b64_json' in item && typeof item.b64_json === 'string' ? item.b64_json : '';
    const url = 'url' in item && typeof item.url === 'string' ? item.url : '';
    const prompt = 'revised_prompt' in item && typeof item.revised_prompt === 'string' ? item.revised_prompt : undefined;
    if (!base64 && !url) return null;
    return { mimeType: 'image/png', base64, url, prompt };
  }).filter((item): item is GeneratedImageOutput => Boolean(item));
};

const inlineRemoteGeneratedImages = async (
  images: GeneratedImageOutput[],
  signal?: AbortSignal
) => {
  const inlined: GeneratedImageOutput[] = [];
  for (const image of images) {
    if (signal?.aborted) break;
    if (image.base64 || !image.url) {
      inlined.push(image);
      continue;
    }
    try {
      // provider-supplied URL; refuse private/metadata targets before fetching
      await assertEgressUrl(image.url);
      if (signal?.aborted) break;
      const response = await fetch(image.url, { signal: combineAbortSignals(signal, 15000) });
      if (!response.ok) {
        inlined.push(image);
        continue;
      }
      const mimeType = response.headers.get('content-type')?.split(';')[0] || image.mimeType || 'image/png';
      if (!mimeType.startsWith('image/')) {
        inlined.push(image);
        continue;
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 15 * 1024 * 1024) {
        inlined.push(image);
        continue;
      }
      const bytes = Buffer.from(buffer).toString('base64');
      inlined.push({ ...image, mimeType, base64: bytes, url: undefined });
    } catch {
      inlined.push(image);
    }
  }
  return inlined;
};

const DATA_URL_IMAGE_PATTERN = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-z0-9+/=\s]+)$/i;

type ValidImageEditPayload = {
  mode: 'edit' | 'annotate' | 'resize' | 'remove';
  prompt: string;
  sourceImageDataUrl: string;
  maskDataUrl?: string;
  annotatedDataUrl?: string;
};

const isValidImageEditDataUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const match = value.trim().match(DATA_URL_IMAGE_PATTERN);
  if (!match) return false;
  const estimatedBytes = Math.ceil((match[2].replace(/\s+/g, '').length * 3) / 4);
  return estimatedBytes > 0 && estimatedBytes <= MAX_ATTACHMENT_BYTES;
};

const normalizeImageEditPayload = (value: unknown): ValidImageEditPayload | null => {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const mode = obj.mode;
  if (mode !== 'edit' && mode !== 'annotate' && mode !== 'resize' && mode !== 'remove') {
    return null;
  }
  if (!isValidImageEditDataUrl(obj.sourceImageDataUrl)) return null;
  if (obj.maskDataUrl !== undefined && !isValidImageEditDataUrl(obj.maskDataUrl)) return null;
  if (obj.annotatedDataUrl !== undefined && !isValidImageEditDataUrl(obj.annotatedDataUrl)) return null;
  const prompt = typeof obj.prompt === 'string' ? obj.prompt.trim().slice(0, MAX_MESSAGE_CHARS) : '';
  return {
    mode,
    prompt,
    sourceImageDataUrl: obj.sourceImageDataUrl.trim(),
    maskDataUrl: typeof obj.maskDataUrl === 'string' ? obj.maskDataUrl.trim() : undefined,
    annotatedDataUrl: typeof obj.annotatedDataUrl === 'string' ? obj.annotatedDataUrl.trim() : undefined,
  };
};

const dataUrlToImageBlob = (dataUrl: string): { blob: Blob; filename: string } | null => {
  const match = dataUrl.trim().match(DATA_URL_IMAGE_PATTERN);
  if (!match) return null;
  const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const base64Body = match[2].replace(/\s+/g, '');
  const bytes = Buffer.from(base64Body, 'base64');
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ATTACHMENT_BYTES) return null;
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
  return {
    blob: new Blob([bytes], { type: mime }),
    filename: `image.${ext}`,
  };
};

const parseProviderError = (message: string): string | null => {
  try {
    const parsed = JSON.parse(message);
    const providerMessage = parsed?.error?.message || parsed?.message;
    if (typeof providerMessage === 'string' && providerMessage !== message) {
      return parseProviderError(providerMessage) || providerMessage;
    }
  } catch {
  }
  return null;
};

const getErrorMessage = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim()) {
    return parseProviderError(error.message) || error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return parseProviderError(error) || error;
  }
  return 'Unknown API error.';
};

const normalizeExt = (file: AttachedFileInput) => {
  const fromExt = typeof file?.ext === 'string' ? file.ext.toLowerCase().replace(/^\./, '') : '';
  if (fromExt && fromExt !== 'other') return fromExt;
  const name = typeof file?.name === 'string' ? file.name : '';
  return path.extname(name).slice(1).toLowerCase() || 'other';
};

const isTextAttachment = (ext: string, mimeType: string) => {
  return TEXT_EXTS[ext] === true || mimeType.startsWith('text/');
};

const canOpenAICompatibleInspectNatively = (mimeType: string) => {
  return OPENAI_COMPATIBLE_IMAGE_MIME_TYPES[mimeType] === true;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const resolveAttachedFilePath = (file: AttachedFileInput) => {
  const name = typeof file?.name === 'string' ? file.name : '';
  if (!name) {
    throw new Error('Attached file is missing a filename.');
  }

  const ext = normalizeExt(file);
  const root = path.normalize(TEMP_FILE_ROOT + path.sep);
  const filePath = path.normalize(path.join(/*turbopackIgnore: true*/ TEMP_FILE_ROOT, ext, name));

  if (!filePath.toLowerCase().startsWith(root.toLowerCase())) {
    throw new Error(`Invalid attached file path: ${name}`);
  }

  return { name, ext, filePath };
};

const readAttachment = async (file: AttachedFileInput): Promise<AttachmentPayload> => {
  const name = typeof file?.name === 'string' ? file.name : 'attachment';
  const ext = normalizeExt(file);
  const mimeType = MIME_BY_EXT[ext] || 'application/octet-stream';
  const isText = isTextAttachment(ext, mimeType);

  if (typeof file?.content === 'string') {
    return {
      name,
      ext,
      filePath: '',
      mimeType,
      size: typeof file?.size === 'number' ? file.size : Buffer.byteLength(file.content),
      kind: 'text',
      text: file.content
    };
  }

  if (typeof file?.dataUrl === 'string' || typeof file?.base64 === 'string') {
    const dataUrl = file.dataUrl || `data:${mimeType};base64,${file.base64}`;
    return {
      name,
      ext,
      filePath: '',
      mimeType,
      size: typeof file?.size === 'number' ? file.size : 0,
      kind: 'binary',
      dataUrl
    };
  }

  try {
    const { filePath } = resolveAttachedFilePath(file);
    const stat = await fs.stat(filePath);
    if (isText) {
      return {
        name,
        ext,
        filePath,
        mimeType,
        size: stat.size,
        kind: 'text',
        text: await fs.readFile(filePath, 'utf-8')
      };
    }
    return {
      name,
      ext,
      filePath,
      mimeType,
      size: stat.size,
      kind: 'binary'
    };
  } catch (err) {
    return {
      name,
      ext,
      mimeType,
      size: 0,
      kind: 'missing',
      error: getErrorMessage(err)
    };
  }
};

const getMessageAttachments = async (message: ChatMessage): Promise<AttachmentPayload[]> => {
  if (!Array.isArray(message.attachedFiles) || message.attachedFiles.length === 0) {
    return [];
  }

  const attachments: AttachmentPayload[] = [];
  for (const file of message.attachedFiles) {
    try {
      attachments.push(await readAttachment(file));
    } catch (e) {
      console.error(`Failed to read attached file: ${file?.name || 'unknown'}`, e);
      attachments.push({
        name: typeof file?.name === 'string' ? file.name : 'unknown',
        ext: typeof file?.ext === 'string' ? file.ext : 'other',
        mimeType: 'application/octet-stream',
        size: 0,
        kind: 'missing',
        error: getErrorMessage(e)
      });
    }
  }
  return attachments;
};

const isMistralChatCompletionsTarget = (conn: LlmConnection, cleanBase: string, provider: string) => {
  const text = `${conn.provider || ''} ${conn.baseUrl || ''} ${cleanBase || ''} ${provider || ''}`.toLowerCase();
  return text.includes('mistral');
};



const buildOpenAICompatibleMessages = async (messages: ChatMessage[], providerName: string, mistralTarget: boolean): Promise<OpenAICompatibleMessage[]> => {
  const prepared: OpenAICompatibleMessage[] = [];

  for (const message of messages) {
    if (!Array.isArray(message.attachedFiles) || message.attachedFiles.length === 0) {
      prepared.push({ role: message.role, content: message.content || '' });
      continue;
    }

    const attachments = await getMessageAttachments(message);
    const parts: OpenAICompatibleContentPart[] = [];
    const textParts: string[] = [];
    if (message.content) textParts.push(message.content);

    const unsupportedFiles: string[] = [];

    for (const attachment of attachments) {
      if (attachment.kind === 'text') {
        textParts.push(`--- Attached Text File (${attachment.name}) ---\n${attachment.text}\n--- End of attached file ---`);
        continue;
      }

      if (attachment.kind === 'missing') {
        textParts.push(`[Attachment notice: ${attachment.name} could not be read: ${attachment.error}.]`);
        continue;
      }

      if (!canOpenAICompatibleInspectNatively(attachment.mimeType)) {
        unsupportedFiles.push(`${attachment.name} (${attachment.mimeType}, ${formatBytes(attachment.size)})`);
        continue;
      }

      if (attachment.size > MAX_OPENAI_COMPATIBLE_IMAGE_BYTES) {
        textParts.push(`[Attachment notice: ${attachment.name} is ${formatBytes(attachment.size)} and is too large to send inline to this ${providerName} chat-completions connection.]`);
        continue;
      }

      let dataUrl = attachment.dataUrl || '';
      if (!dataUrl && attachment.filePath) {
        try {
          const base64 = await fs.readFile(attachment.filePath);
          dataUrl = `data:${attachment.mimeType};base64,${base64.toString('base64')}`;
        } catch {}
      }
      if (dataUrl) {
        parts.push({
          type: 'image_url',
          image_url: mistralTarget ? dataUrl : { url: dataUrl }
        });
      }
    }

    if (unsupportedFiles.length > 0) {
      textParts.push(`[Attachment notice: The user attached ${unsupportedFiles.join(', ')}. This ${providerName} chat-completions connection can only receive text and supported image attachments from DeepChat.]`);
    }

    const text = textParts.join('\n\n');
    if (text || parts.length === 0) {
      parts.unshift({ type: 'text', text });
    }

    prepared.push({
      role: message.role,
      content: parts.length > 0 ? parts : text
    });
  }

  return prepared;
};

const isChatMessageLike = (message: unknown): message is { role?: string; content?: string; runtimePromptContent?: string } => {
  return Boolean(message && typeof message === 'object' && 'role' in message);
};

const getRuntimeMessageText = (message: { content?: string; runtimePromptContent?: string } | undefined) => (
  typeof message?.runtimePromptContent === 'string' && message.runtimePromptContent.trim()
    ? message.runtimePromptContent
    : (typeof message?.content === 'string' ? message.content : '')
);
const getLatestUserMessage = (messages: ChatMessage[]) => [...messages].reverse().find((m: unknown) => isChatMessageLike(m) && m.role === 'user') as ChatMessage | undefined;

const getRouteResponseError = async (response: Response) => {
  try {
    const data = await response.clone().json();
    if (data?.error) return String(data.error);
  } catch {
    try {
      const text = await response.text();
      if (text) return text;
    } catch {
    }
  }
  return `Request failed with status ${response.status}`;
};

// upstream body text must never reach the client; map status classes to sanitized constants
const upstreamSseError = (status: number, headers?: Headers) => formatRelayError(status, headers).message;

const upstreamErrorResponse = (status: number, headers?: Headers) => relayErrorResponse(status, headers);

const logUpstreamFailure = (status: number, detail: string) => {
  console.error(`[chat] upstream ${status}: ${detail.slice(0, 500)}`);
};

const buildPlatformCapabilityPrompt = () => [
  'DeepChat platform capabilities:',
  '- Search can gather fresh web facts and source-aware context when enabled by the router or user.',
  '- Do not ask the user which internal tool to use. Continue naturally and let DeepChat continue seamlessly.'
].join('\n');

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as {
      messages?: ChatMessage[];
      modelId?: string;
      connectionId?: string;
      tools?: unknown;
      manualSearch?: boolean;
      skipRuntimeIntegrations?: boolean;
      imageAspectRatio?: ImageAspectRatio;
      imageEdit?: unknown;
      injectedPrompt?: string;
    };
    const { messages, modelId, connectionId, tools, manualSearch, skipRuntimeIntegrations, imageAspectRatio, imageEdit, injectedPrompt } = payload;

    const validImageEdit = imageEdit !== undefined ? normalizeImageEditPayload(imageEdit) : null;
    if (imageEdit !== undefined && !validImageEdit) {
      return NextResponse.json({ error: 'Invalid image edit payload.' }, { status: 400 });
    }

    const violation = validateChatBody(payload);
    if (violation) {
      return NextResponse.json({ error: violation }, { status: 400 });
    }

    if (!Array.isArray(messages) || (!modelId && !connectionId)) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const clientIp = getClientIp(req).slice(0, 128);
    const verifiedAccount = getVerifiedAccount(req.headers);
    const isGuest = verifiedAccount === null;

    // budget gate, identity is account_id when signed in, or client IP
    const identityKey = verifiedAccount ? `acc:${verifiedAccount.sub}` : clientIp;
    const gate = verifiedAccount
      ? await checkAccountUsageBudget(verifiedAccount.sub)
      : checkUsageBudget(identityKey);
    if (!gate.allowed) {
      const headers: Record<string, string> = { 'x-usage-expiry': gate.exhaustedWindow as string };
      if (gate.retryAfterMs !== undefined) headers['retry-after'] = String(Math.ceil(gate.retryAfterMs / 1000));
      return NextResponse.json({
        error: 'usage_limit_reached',
        code: 'usage_limit_reached',
        message: `Your ${gate.exhaustedWindow} token limit is reached. This window resets automatically, please try again later.`,
        exhaustedWindow: gate.exhaustedWindow
      }, { status: 402, headers });
    }
    // fallback estimate for image turns, fallback list only
    const imagePromptTokens = estimateChatPromptTokens(messages as { role?: string; content?: unknown }[]);

    const clientId = resolveRelayClientId(req);

    let conn: LlmConnection | null = null;
    if (connectionId === LIVE_LITE_CONNECTION_ID) {
      conn = getLiveLiteConnection();
    } else if (connectionId === LIVE_CHAT_CONNECTION_ID || !connectionId) {
      conn = getLiveChatConnection();
    } else {
      conn = getLiveChatConnection();
    }

    if (!conn) {
      return NextResponse.json({ error: 'AI relay is not configured on the server.' }, { status: 503 });
    }

    const p = normalizeProvider(conn.provider);
    const cleanBase = getCleanBaseUrl(p, conn.baseUrl);
    const latestUser = getLatestUserMessage(messages);
    const latestAttachmentCount =
      (Array.isArray(latestUser?.attachedFiles) ? latestUser.attachedFiles.length : 0) +
      (latestUser?.attachedFile ? 1 : 0);

    if (isGuest && latestAttachmentCount > GUEST_LIMITS.maxAttachmentsPerMessage) {
      return NextResponse.json(
        {
          error: 'guest_max_attachments_exceeded',
          code: 'guest_max_attachments_exceeded',
          message: `Guest mode is limited to ${GUEST_LIMITS.maxAttachmentsPerMessage} attachments per message. Please sign in for more.`
        },
        { status: 400 }
      );
    }

    const requestedImageGeneration = latestUser?.imageGenerationEnabled === true;
    const requestedAspectRatio = normalizeImageAspectRatio(imageAspectRatio || latestUser?.imageAspectRatio);

    // Block image generation and image editing for guests before model resolution
    const requestedModel = typeof modelId === 'string' ? modelId.trim() : '';
    if (
      isGuest &&
      (requestedImageGeneration || Boolean(validImageEdit) || isImageGenerationModel(requestedModel))
    ) {
      return NextResponse.json(
        {
          error: 'login_required_for_image',
          code: 'login_required_for_image',
          message: 'Image generation and editing require an account. Please sign in to continue.'
        },
        { status: 403 }
      );
    }

    if (isGuest) {
      const guestVerdict = await checkGuestChatRateLimit(clientIp);
      if (!guestVerdict.allowed) {
        return NextResponse.json(
          {
            error: 'guest_rate_limit_exceeded',
            code: 'guest_rate_limit_exceeded',
            message: `Guest mode is limited to ${guestVerdict.limit} requests every 2 hours. Please sign in to continue chatting.`,
            retryAfterSeconds: guestVerdict.retryAfterSeconds ?? 60
          },
          {
            status: 429,
            headers: {
              'retry-after': String(guestVerdict.retryAfterSeconds ?? 60),
              'x-ratelimit-limit': String(guestVerdict.limit),
              'x-ratelimit-remaining': '0'
            }
          }
        );
      }
    }

    // Guests cannot pick arbitrary models; lock them to the server-configured guest default
    let selectedRequestModel: string;
    if (isGuest) {
      const guestDefault =
        getModelConfigValue('GUEST_MODEL') ||
        getLiveLiteConnection()?.model ||
        conn.model;
      selectedRequestModel = guestDefault;
    } else {
      // client modelId is untrusted; only env-provisioned or relay-listed models may reach the relay
      const allowedModels = new Set(getLiveModels().map(m => m.id));
      for (const id of getEnvModelIds()) allowedModels.add(id);
      if (requestedModel && !allowedModels.has(requestedModel)) {
        const relayModels = await fetchRelayModels(clientId).catch(() => null);
        if (relayModels?.ok) {
          for (const m of relayModels.models) allowedModels.add(m.id);
        }
      }
      selectedRequestModel = requestedModel && allowedModels.has(requestedModel)
        ? requestedModel
        : (conn.model || requestedModel);
    }

    const liveImageConfig = getLiveImageConfig();
    const defaultImageModel = liveImageConfig?.model || '';
    const imageFallbackModel = requestedImageGeneration && !isImageGenerationModel(selectedRequestModel)
      ? defaultImageModel
      : '';
    const selectedModel = imageFallbackModel || selectedRequestModel;

    if (requestedImageGeneration && !isImageGenerationModel(selectedModel)) {
      return NextResponse.json({ error: 'Image generation needs an image model enabled. Check your settings, then retry.' }, { status: 400 });
    }

    const [llmSettings, persona] = await Promise.all([
      readLLMSettings(),
      getPersona()
    ]);
    const isStream = llmSettings.streamingResponse;

    const latestUserMessage = getRuntimeMessageText(latestUser);
    const runtimeTools = skipRuntimeIntegrations ? [] : normalizeChatTools(tools);
    const hasSearchTools = runtimeTools.some(tool => tool.toolId !== 'url-context');
    const isImageRequest = requestedImageGeneration || isImageGenerationModel(selectedModel) || Boolean(validImageEdit);

    const promptToInject = typeof injectedPrompt === 'string' ? injectedPrompt : '';
    const injectSearchSystemPrompt = (targetMessages: ChatMessage[], context: string, hasSources: boolean) => {
      const runtimePrompt = [
        skipRuntimeIntegrations ? '' : buildPlatformCapabilityPrompt(),
        buildSearchSystemPrompt(context, hasSources)
      ].filter(Boolean).join('\n\n');
      const systemIndex = targetMessages.findIndex((m: unknown) => isChatMessageLike(m) && m.role === 'system');
      if (systemIndex !== -1) {
        const baseSystemPrompt = [persona.memoryReferenceHistory === false ? '' : targetMessages[systemIndex].content, runtimePrompt].filter(Boolean).join('\n\n');
        targetMessages[systemIndex].content = [promptToInject, baseSystemPrompt].filter(Boolean).join('\n\n');
      } else {
        const combined = [promptToInject, runtimePrompt].filter(Boolean).join('\n\n');
        if (combined) {
          targetMessages.unshift({ role: 'system', content: combined });
        }
      }
    };

    const aiLogPayload = {
      route: 'chat',
      provider: conn.provider,
      model: selectedModel,
      input: latestUserMessage
    };

    if (hasSearchTools && isStream && !isImageRequest) {
      const url = getChatCompletionsUrl(p, cleanBase);
      const headers = buildRelayHeaders({
        clientSecret: conn.apiKey,
        clientId,
        contentType: 'application/json',
      });
      const mistralTarget = isMistralChatCompletionsTarget(conn, cleanBase, p);
      const providerName = conn.provider;
      const modelToUse = selectedModel || conn.model;
      const fallbackMessages = messages.map(m => ({ ...m }));
      const urlContextTools = runtimeTools.filter(tool => tool.toolId === 'url-context');

      return new Response(new ReadableStream({
        async start(controller) {
          try {
            if (llmSettings.reasoning) {
              controller.enqueue(encoder.encode(sse({
                type: 'deepchat_reasoning_state',
                hasReasoning: true
              })));
            }

            // Read any explicit URLs pasted in the user message in parallel
            const urlOutcome = urlContextTools.length > 0
              ? await collectSearchRuntimeContext(urlContextTools, latestUserMessage)
              : { context: '', sources: [] as SearchSource[], readSources: [] as SearchSource[], searched: false };

            const allSources: SearchSource[] = [];
            const allReadSources: SearchSource[] = [...urlOutcome.readSources];
            const sourceIndexByUrl = new Map<string, number>();

            const addSources = (incoming: SearchSource[]): Array<{ index: number; source: SearchSource }> => {
              const mapped: Array<{ index: number; source: SearchSource }> = [];
              for (const src of incoming) {
                const key = normalizeSourceUrl(src.url);
                let idx = sourceIndexByUrl.get(key);
                if (idx === undefined) {
                  allSources.push(src);
                  idx = allSources.length;
                  sourceIndexByUrl.set(key, idx);
                }
                mapped.push({ index: idx, source: allSources[idx - 1] });
              }
              return mapped;
            };

            const addReadSource = (src: SearchSource | null) => {
              if (!src) return;
              const key = normalizeSourceUrl(src.url);
              if (!allReadSources.some(item => normalizeSourceUrl(item.url) === key)) {
                allReadSources.push(src);
              }
            };

            if (allReadSources.length > 0) {
              controller.enqueue(encoder.encode(sse({
                type: 'deepchat_sources',
                sources: allSources,
                readSources: allReadSources,
                fromUrlContext: true
              })));
            }

            const dynamicSystemText = [
              buildPlatformCapabilityPrompt(),
              buildDynamicSearchSystemPrompt(manualSearch === true, urlOutcome.context)
            ].filter(Boolean).join('\n\n');

            const dynamicMessages = messages.map(m => ({ ...m }));
            const sysIdx = dynamicMessages.findIndex((m: unknown) => isChatMessageLike(m) && m.role === 'system');
            if (sysIdx !== -1) {
              const base = [persona.memoryReferenceHistory === false ? '' : dynamicMessages[sysIdx].content, dynamicSystemText].filter(Boolean).join('\n\n');
              dynamicMessages[sysIdx].content = [promptToInject, base].filter(Boolean).join('\n\n');
            } else {
              const combined = [promptToInject, dynamicSystemText].filter(Boolean).join('\n\n');
              if (combined) dynamicMessages.unshift({ role: 'system', content: combined });
            }

            const loopMessages: OpenAICompatibleMessage[] = await buildOpenAICompatibleMessages(dynamicMessages, providerName, mistralTarget);

            for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
              const roundPromptTokens = estimateChatPromptTokens(loopMessages as Array<{ role?: string; content?: unknown }>);
              const allowTools = round < MAX_TOOL_ROUNDS - 1;
              const body = applyOpenAICompatibleReasoning({
                model: modelToUse,
                messages: loopMessages,
                stream: true,
                ...(allowTools ? { tools: OPENAI_SEARCH_TOOLS, tool_choice: 'auto' } : {})
              }, llmSettings);

              const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: req.signal
              });

              // Graceful fallback if upstream provider rejects `tools` parameter
              if (round === 0 && !res.ok && (res.status === 400 || res.status === 404 || res.status === 422)) {
                const upstreamBody = await getRouteResponseError(res);
                logUpstreamFailure(res.status, `Tools rejected (${res.status}), falling back: ${upstreamBody}`);
                if (manualSearch) {
                  controller.enqueue(encoder.encode(sse({
                    type: 'deepchat_search',
                    status: 'searching',
                    hasReasoning: llmSettings.reasoning
                  })));
                  const fallbackSearch = await collectSearchRuntimeContext(runtimeTools, latestUserMessage);
                  for (const event of buildSearchCompletionEvents(fallbackSearch.sources, fallbackSearch.readSources, fallbackSearch.searched, llmSettings.reasoning)) {
                    controller.enqueue(encoder.encode(sse(event)));
                  }
                  injectSearchSystemPrompt(fallbackMessages, fallbackSearch.context, fallbackSearch.sources.length > 0);
                } else {
                  injectSearchSystemPrompt(fallbackMessages, urlOutcome.context, false);
                }
                const fbOpenAI = await buildOpenAICompatibleMessages(fallbackMessages, providerName, mistralTarget);
                const fbTokens = estimateChatPromptTokens(fbOpenAI as Array<{ role?: string; content?: unknown }>);
                const fbRes = await fetch(url, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(applyOpenAICompatibleReasoning({ model: modelToUse, messages: fbOpenAI, stream: true }, llmSettings)),
                  signal: req.signal
                });
                if (!fbRes.ok || !fbRes.body) {
                  const fbErr = await getRouteResponseError(fbRes);
                  logUpstreamFailure(fbRes.status, fbErr);
                  controller.enqueue(encoder.encode(sse({ error: upstreamSseError(fbRes.status, fbRes.headers) })));
                  controller.enqueue(DONE_BYTES);
                  controller.close();
                  return;
                }
                const fbStream = isAiLogEnabled() ? streamWithAiLog(fbRes.body, aiLogPayload) : fbRes.body;
                const fbMetered = meterSseBody(fbStream, identityKey, fbTokens);
                if (fbMetered) {
                  const fbReader = fbMetered.getReader();
                  while (true) {
                    const { done, value } = await fbReader.read();
                    if (done) break;
                    controller.enqueue(value);
                  }
                }
                controller.close();
                return;
              }

              if (!res.ok || !res.body) {
                const upstreamBody = await getRouteResponseError(res);
                logUpstreamFailure(res.status, upstreamBody);
                controller.enqueue(encoder.encode(sse({ error: upstreamSseError(res.status, res.headers) })));
                controller.enqueue(DONE_BYTES);
                controller.close();
                return;
              }

              const streamBody = isAiLogEnabled() ? streamWithAiLog(res.body, aiLogPayload) : res.body;
              const meteredBody = meterSseBody(streamBody, identityKey, roundPromptTokens);
              if (!meteredBody) {
                controller.enqueue(DONE_BYTES);
                controller.close();
                return;
              }

              const reader = meteredBody.getReader();
              const decoder = new TextDecoder();
              let sseBuffer = '';
              let roundContent = '';
              const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split('\n');
                sseBuffer = lines.pop() || '';

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || trimmed.startsWith(':')) continue;
                  const dataStr = trimmed.replace(/^data:\s*/, '').trim();
                  if (dataStr === '[DONE]') continue;

                  let parsed: Record<string, unknown>;
                  try {
                    const raw = JSON.parse(dataStr) as unknown;
                    if (!raw || typeof raw !== 'object') continue;
                    parsed = raw as Record<string, unknown>;
                  } catch {
                    continue;
                  }

                  const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
                  const firstChoice = choices[0] && typeof choices[0] === 'object' ? choices[0] as Record<string, unknown> : null;
                  const delta = firstChoice?.delta && typeof firstChoice.delta === 'object' ? firstChoice.delta as Record<string, unknown> : null;

                  if (delta) {
                    if (typeof delta.content === 'string' && delta.content) {
                      roundContent += delta.content;
                    }
                    if (Array.isArray(delta.tool_calls)) {
                      for (const rawTc of delta.tool_calls) {
                        if (!rawTc || typeof rawTc !== 'object') continue;
                        const tc = rawTc as Record<string, unknown>;
                        const tcIdx = typeof tc.index === 'number' ? tc.index : 0;
                        const existing = toolCallsMap.get(tcIdx) || { id: `call_${round}_${tcIdx}`, name: '', arguments: '' };
                        if (typeof tc.id === 'string' && tc.id) existing.id = tc.id;
                        const fn = tc.function && typeof tc.function === 'object' ? tc.function as Record<string, unknown> : null;
                        if (typeof fn?.name === 'string' && fn.name) existing.name += fn.name;
                        if (typeof fn?.arguments === 'string' && fn.arguments) existing.arguments += fn.arguments;
                        toolCallsMap.set(tcIdx, existing);
                      }
                    }

                    const hasTextDelta =
                      (typeof delta.content === 'string' && delta.content.length > 0) ||
                      (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0);
                    if (hasTextDelta) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
                    }
                  } else if (parsed.error) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
                  }
                }
              }

              const toolCalls = [...toolCallsMap.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([, tc]) => tc)
                .filter(tc => tc.name);

              if (toolCalls.length === 0) {
                controller.enqueue(DONE_BYTES);
                controller.close();
                return;
              }

              loopMessages.push({
                role: 'assistant',
                content: roundContent || null,
                tool_calls: toolCalls.map(tc => ({
                  id: tc.id,
                  type: 'function' as const,
                  function: { name: tc.name, arguments: tc.arguments || '{}' }
                }))
              });

              const searchCalls = toolCalls.filter(tc => tc.name === 'web_search');
              const readCalls = toolCalls.filter(tc => tc.name === 'read_page');
              let primaryQuery = '';
              if (searchCalls.length > 0) {
                try {
                  const firstArgs = JSON.parse(searchCalls[0].arguments || '{}') as { query?: unknown };
                  if (typeof firstArgs.query === 'string') primaryQuery = firstArgs.query.trim();
                } catch {}
                controller.enqueue(encoder.encode(sse({
                  type: 'deepchat_search',
                  status: 'searching',
                  query: primaryQuery || undefined,
                  hasReasoning: llmSettings.reasoning
                })));
              }
              if (readCalls.length > 0) {
                controller.enqueue(encoder.encode(sse({
                  type: 'deepchat_read',
                  status: 'reading',
                  count: readCalls.length,
                  hasReasoning: llmSettings.reasoning
                })));
              }

              const roundReadSources: SearchSource[] = [];
              const toolOutputs = await Promise.all(
                toolCalls.map(async tc => {
                  let args: Record<string, unknown> = {};
                  try {
                    const parsedArgs = JSON.parse(tc.arguments || '{}') as unknown;
                    if (parsedArgs && typeof parsedArgs === 'object') args = parsedArgs as Record<string, unknown>;
                  } catch {}

                  if (tc.name === 'web_search') {
                    const query = typeof args.query === 'string' ? args.query.trim() : latestUserMessage;
                    const found = await executeDynamicWebSearch(runtimeTools, query);
                    const mapped = addSources(found);
                    if (mapped.length === 0) {
                      return { id: tc.id, content: 'No web search results found for this query.' };
                    }
                    const formatted = mapped
                      .map(({ index, source }) =>
                        [
                          `[${index}] ${source.title}`,
                          `URL: ${source.url}`,
                          source.publishedDate ? `Date: ${source.publishedDate}` : '',
                          source.snippet ? `Snippet: ${source.snippet}` : ''
                        ]
                          .filter(Boolean)
                          .join('\n')
                      )
                      .join('\n\n');
                    return { id: tc.id, content: formatted };
                  }

                  if (tc.name === 'read_page') {
                    const pageUrl = typeof args.url === 'string' ? args.url.trim() : '';
                    const extracted = await executeDynamicReadPage(pageUrl, allSources);
                    if (extracted.source) {
                      addReadSource(extracted.source);
                      roundReadSources.push(extracted.source);
                    }
                    return {
                      id: tc.id,
                      content: extracted.text || 'Could not extract readable text from this URL.'
                    };
                  }

                  return { id: tc.id, content: 'Unsupported tool.' };
                })
              );

              if (allSources.length > 0 || allReadSources.length > 0) {
                controller.enqueue(encoder.encode(sse({
                  type: 'deepchat_sources',
                  sources: allSources,
                  readSources: allReadSources
                })));
              }
              if (searchCalls.length > 0) {
                controller.enqueue(encoder.encode(sse({
                  type: 'deepchat_search',
                  status: 'completed',
                  sourceCount: allSources.length,
                  query: primaryQuery || undefined,
                  hasReasoning: llmSettings.reasoning
                })));
              }
              if (readCalls.length > 0) {
                controller.enqueue(encoder.encode(sse({
                  type: 'deepchat_read',
                  status: 'completed',
                  sources: roundReadSources,
                  hasReasoning: llmSettings.reasoning
                })));
              }

              for (const out of toolOutputs) {
                loopMessages.push({
                  role: 'tool',
                  tool_call_id: out.id,
                  content: out.content
                });
              }
            }

            controller.enqueue(DONE_BYTES);
            controller.close();
          } catch (error) {
            logUpstreamFailure(502, getErrorMessage(error));
            controller.enqueue(encoder.encode(sse({ error: 'Could not reach the AI service right now. Please try again in a bit.' })));
            controller.enqueue(DONE_BYTES);
            controller.close();
          }
        }
      }), { headers: streamHeaders(p) });
    }

    const searchResult = !skipRuntimeIntegrations && runtimeTools.length > 0
      ? await collectSearchRuntimeContext(runtimeTools, latestUserMessage)
      : { context: '', sources: [] as SearchSource[], readSources: [] as SearchSource[], searched: false };
    const integrationEvents = buildSearchCompletionEvents(searchResult.sources, searchResult.readSources, searchResult.searched, llmSettings.reasoning);
    injectSearchSystemPrompt(messages, searchResult.context, searchResult.sources.length > 0);

    if (isImageRequest) {
      if (req.signal.aborted) {
        return new Response(null, { status: 499 });
      }
      const liveImage = getLiveImageConfig();
      // server image endpoint is env-provisioned only; client strings must not select base or model
      if (!liveImage) {
        return NextResponse.json({ error: 'The image feature is not configured on the server. Everything else is fine, try without an image.' }, { status: 400 });
      }
      const prompt = validImageEdit?.prompt || getImageGenerationPrompt(messages);
      const imageModel = liveImage.model;

      let res: Response | null = null;
      if (validImageEdit) {
        const primaryUrl =
          validImageEdit.mode === 'annotate' && validImageEdit.annotatedDataUrl
            ? validImageEdit.annotatedDataUrl
            : validImageEdit.sourceImageDataUrl;
        const primaryFile = dataUrlToImageBlob(primaryUrl);
        if (primaryFile) {
          const formData = new FormData();
          formData.append('model', imageModel);
          formData.append('prompt', prompt);
          formData.append('n', '1');
          formData.append('size', getOpenAIImageSize(imageModel, requestedAspectRatio));
          formData.append('image', primaryFile.blob, primaryFile.filename);

          if (validImageEdit.maskDataUrl) {
            const maskFile = dataUrlToImageBlob(validImageEdit.maskDataUrl);
            if (maskFile) {
              formData.append('mask', maskFile.blob, 'mask.png');
            }
          }

          if (!/\bgpt-image\b/i.test(imageModel)) {
            formData.append('response_format', 'b64_json');
          }

          const editRes = await fetch(`${liveImage.baseUrl}/v1/images/edits`, {
            method: 'POST',
            headers: buildRelayHeaders({
              clientSecret: liveImage.apiKey,
              clientId,
            }),
            body: formData,
            signal: req.signal
          });

          if (editRes.ok) {
            res = editRes;
          } else if (editRes.status === 404 || editRes.status === 405 || editRes.status === 501) {
            const upstreamBody = await getRouteResponseError(editRes);
            logUpstreamFailure(editRes.status, upstreamBody);
          } else {
            res = editRes;
          }
        }
      }

      if (!res) {
        if (req.signal.aborted) {
          return new Response(null, { status: 499 });
        }
        const body = getOpenAIImageRequestBody(imageModel, prompt, requestedAspectRatio);
        res = await fetch(`${liveImage.baseUrl}/v1/images/generations`, {
          method: 'POST',
          headers: buildRelayHeaders({
            clientSecret: liveImage.apiKey,
            clientId,
            contentType: 'application/json',
          }),
          body: JSON.stringify(body),
          signal: req.signal
        });
      }

      if (req.signal.aborted) {
        return new Response(null, { status: 499 });
      }
      if (!res.ok) {
        const upstreamBody = await getRouteResponseError(res);
        logUpstreamFailure(res.status, upstreamBody);
        return upstreamErrorResponse(res.status, res.headers);
      }
      const data = await res.json();
      if (req.signal.aborted) {
        return new Response(null, { status: 499 });
      }
      const images = await inlineRemoteGeneratedImages(getOpenAIGeneratedImages(data), req.signal);
      if (req.signal.aborted) {
        return new Response(null, { status: 499 });
      }
      if (images.length === 0) {
        throw new Error('The server kept it to itself, no image came back. Try again in a moment.');
      }
      const output = imageOutputToMarkdown(images);
      logAiExchange({ ...aiLogPayload, output });
      // image call still eats a prompt, go with that
      recordTokens(identityKey, imagePromptTokens);
      if (verifiedAccount) {
        void recordAccountModelUsage(verifiedAccount.sub, selectedModel || conn.model || 'image', imagePromptTokens);
      }
      return singleSseResponse(p, { choices: [{ delta: { content: output } }] }, integrationEvents);
    }

    const url = getChatCompletionsUrl(p, cleanBase);
    const openAICompatibleMessages = await buildOpenAICompatibleMessages(messages, conn.provider, isMistralChatCompletionsTarget(conn, cleanBase, p));
    // estimate from the final list, system, persona, and images are included
    const promptTokens = estimateChatPromptTokens(openAICompatibleMessages);
    const headers = buildRelayHeaders({
      clientSecret: conn.apiKey,
      clientId,
      contentType: 'application/json',
    });
    const body = applyOpenAICompatibleReasoning({
      model: selectedModel || conn.model,
      messages: openAICompatibleMessages,
      stream: isStream
    }, llmSettings);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: req.signal
    });

    if (!res.ok) {
      const upstreamBody = await getRouteResponseError(res);
      logUpstreamFailure(res.status, upstreamBody);
      return upstreamErrorResponse(res.status, res.headers);
    }

    if (!isStream) {
      const data = await res.json();
      const message = getOpenAiCompatibleMessage(data);
      logAiExchange({ ...aiLogPayload, output: [message.reasoning_content, message.content].filter(Boolean).join('\n') });
      const totalNonStreamTokens = completeChatTokens(
        data,
        promptTokens,
        [message.reasoning_content, message.content].filter(Boolean).join('\n')
      );
      recordTokens(identityKey, totalNonStreamTokens);
      if (verifiedAccount) {
        void recordAccountModelUsage(verifiedAccount.sub, selectedModel || conn.model, totalNonStreamTokens);
      }
      return singleSseResponse(p, {
        choices: [{
          delta: {
            content: message.content,
            reasoning_content: message.reasoning_content
          }
        }]
      }, integrationEvents);
    }

    const streamBody = isAiLogEnabled() ? streamWithAiLog(res.body, aiLogPayload) : res.body;
    const meteredBody = meterSseBody(streamBody, identityKey, promptTokens);
    if (verifiedAccount) {
      void recordAccountModelUsage(verifiedAccount.sub, selectedModel || conn.model, promptTokens);
    }
    return new Response(prependSseEvents(meteredBody, integrationEvents), {
      headers: streamHeaders(p)
    });

  } catch (err: unknown) {
    if (isAbortLikeError(err, req.signal)) {
      return new Response(null, { status: 499 });
    }
    console.error(`[chat] unexpected error: ${getErrorMessage(err)}`);
    return NextResponse.json({ error: 'Could not complete the request right now. Please try again.' }, { status: 500 });
  }
}
