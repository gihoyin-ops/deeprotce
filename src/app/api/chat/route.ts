import { NextResponse } from 'next/server';
import { getConnections } from '@/app/actions';
import { getInjectedSystemPrompt, getPersona } from '@/app/persona';
import {
  getChatCompletionsUrl,
  getCleanBaseUrl,
  normalizeProvider,
  selectLlmConnection,
  type LlmConnection
} from '@/lib/ai/llm';
import {
  applyOpenAICompatibleReasoning,
  readLLMSettings
} from '@/lib/settings/llm-settings';
import { isAiLogEnabled, logAiExchange, streamWithAiLog } from '@/lib/ai/ai-logs';
import {
  getLiveChatConnection,
  getLiveLiteConnection,
  getLiveImageConfig,
  LIVE_CHAT_CONNECTION_ID,
  LIVE_LITE_CONNECTION_ID
} from '@/lib/ai/live';
import {
  buildIntegrationSystemPrompt,
  collectMCPRuntimeContextWithUsage,
  collectToolRuntimeContextWithSources,
  getMCPRuntimeCandidateServers,
  normalizeChatMCPServers,
  normalizeChatTools,
  type ChatMCPRuntimeServer,
  type ChatToolRuntimeItem,
  type SearchSource,
  type MCPRuntimeUsageItem
} from '@/lib/mcp/mcp-runtime';
import { buildClarificationInstruction, parseAgentClarification } from '@/lib/agent/agent-clarification';
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
  content: string | OpenAICompatibleContentPart[];
};

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
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
  'x-provider': provider
});

const sse = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`;

const prependSseEvents = (body: ReadableStream<Uint8Array> | null, events: unknown[]) => {
  if (events.length === 0 && body) {
    return body;
  }
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

const getMCPStreamEvents = (usage: MCPRuntimeUsageItem[]) => {
  if (usage.length === 0) return [];
  return usage.map(item => ({
    type: 'deepchat_mcp',
    id: item.id,
    name: item.name,
    status: item.status,
    details: item.details
  }));
};

type GeneratedImageOutput = {
  mimeType: string;
  base64?: string;
  url?: string;
  prompt?: string;
};

const getSearchSourceEvents = (sources: SearchSource[]) => {
  if (sources.length === 0) return [];
  return [{
    type: 'deepchat_sources',
    sources
  }];
};

const getToolRuntimeEvents = (tools: ChatToolRuntimeItem[], result: { context: string; sources: SearchSource[] }) => {
  const searchTools = tools.filter(tool => tool.toolId !== 'url-context');
  if (searchTools.length === 0) return [];
  if (result.sources.length > 0) {
    return [{
      type: 'deepchat_mcp',
      id: 'web-search',
      name: 'Search',
      status: 'completed',
      details: `${result.sources.length} source${result.sources.length === 1 ? '' : 's'} found via ${searchTools.map(tool => tool.name).join(', ')}`
    }];
  }
  if (/Web Search unavailable/i.test(result.context)) {
    return [{
      type: 'deepchat_mcp',
      id: 'web-search',
      name: 'Search',
      status: 'error',
      details: result.context.replace(/^Web Search unavailable\s*/i, '').trim() || 'Search did not return usable sources.'
    }];
  }
  return [{
    type: 'deepchat_mcp',
    id: 'web-search',
    name: 'Search',
    status: 'completed',
    details: 'Search was requested but no source context was returned.'
  }];
};

const getMCPWorkingEvents = (servers: { serverId: string; name: string }[]) => {
  return servers.map(server => ({
    type: 'deepchat_mcp',
    id: server.serverId,
    name: server.name,
    status: 'running',
    details: 'Working...'
  }));
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

const materializeGeneratedImages = async (images: GeneratedImageOutput[]) => {
  const materialized: GeneratedImageOutput[] = [];
  for (const image of images) {
    if (image.url) {
      materialized.push(image);
      continue;
    }
    if (image.base64) {
      materialized.push({
        ...image,
        url: `data:${image.mimeType || 'image/png'};base64,${image.base64}`
      });
      continue;
    }
    materialized.push(image);
  }
  return materialized;
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

const inlineRemoteGeneratedImages = async (images: GeneratedImageOutput[]) => {
  const inlined: GeneratedImageOutput[] = [];
  for (const image of images) {
    if (image.base64 || !image.url) {
      inlined.push(image);
      continue;
    }
    try {
      const response = await fetch(image.url);
      if (!response.ok) {
        inlined.push(image);
        continue;
      }
      const mimeType = response.headers.get('content-type')?.split(';')[0] || image.mimeType || 'image/png';
      if (!mimeType.startsWith('image/')) {
        inlined.push(image);
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer()).toString('base64');
      inlined.push({ ...image, mimeType, base64: bytes, url: undefined });
    } catch {
      inlined.push(image);
    }
  }
  return inlined;
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
  const filePath = path.normalize(path.join(TEMP_FILE_ROOT, ext, name));

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

const withSystemInstruction = (messages: ChatMessage[], instruction: string): ChatMessage[] => {
  const nextMessages = messages.map(message => ({ ...message }));
  const systemIndex = nextMessages.findIndex(message => message.role === 'system');
  if (systemIndex !== -1) {
    nextMessages[systemIndex] = {
      ...nextMessages[systemIndex],
      content: [nextMessages[systemIndex].content, instruction].filter(Boolean).join('\n\n')
    };
    return nextMessages;
  }
  return [{ role: 'system', content: instruction }, ...nextMessages];
};

const buildPlatformCapabilityPrompt = () => [
  'DeepChat platform capabilities:',
  '- Search can gather fresh web facts and source-aware context when enabled by the router or user.',
  '- Code Execution can run isolated Python for data analysis, calculations, forecasts, charts, downloadable Excel workbooks, spreadsheet previews, and generated artifacts.',
  '- If runtime context or tool orchestration is active, do not say the platform cannot create downloadable Excel files, charts, or artifacts.',
  '- Do not ask the user which internal tool to use. Continue naturally and let DeepChat route tools.',
  '- If a task needs an artifact and the relevant runtime tool is active, speak as if the platform will produce it, not as if the user must manually build it.'
].join('\n');

const pipeSseResponse = async (controller: ReadableStreamDefaultController<Uint8Array>, response: Response) => {
  if (!response.ok || !response.body) {
    controller.enqueue(encoder.encode(sse({ error: await getRouteResponseError(response) })));
    return;
  }
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    controller.enqueue(value);
  }
};

const createAgenticMCPResponse = (requestUrl: string, provider: string, payload: Record<string, unknown>, originalMessages: ChatMessage[], mcpServers: ChatMCPRuntimeServer[], tools: ChatToolRuntimeItem[], latestUserMessage: string) => {
  const candidateServers = getMCPRuntimeCandidateServers(mcpServers, latestUserMessage);
  const preludeMessages = withSystemInstruction(originalMessages, [
    'Before using any MCP context, give a short natural first response to the user.',
    'State your initial approach or what you are about to verify.',
    'Keep it concise and do not provide the full final answer yet.',
    'Do not ask what tool to use, do not ask for confirmation, and do not say the platform cannot perform a runtime action when tools are available.',
    buildClarificationInstruction()
  ].join('\n'));
  const callDirect = (phaseMessages: ChatMessage[]) => fetch(requestUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      messages: phaseMessages,
      mcpServers: [],
      tools: [],
      skipAgentLoop: true,
      skipRuntimeIntegrations: true
    })
  });
  const getStreamText = async (response: Response) => {
    if (!response.ok || !response.body) throw new Error(await getRouteResponseError(response));
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue;
        const data = line.replace(/^data:\s*/, '').trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data) as unknown;
          if (!parsed || typeof parsed !== 'object') continue;
          const json = parsed as Record<string, unknown>;
          if (json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Provider returned an error.');
          const choices = Array.isArray(json.choices) ? json.choices : [];
          const choice = choices[0] && typeof choices[0] === 'object' ? choices[0] as Record<string, unknown> : null;
          const delta = choice?.delta && typeof choice.delta === 'object' ? choice.delta as Record<string, unknown> : null;
          if (typeof delta?.content === 'string') {
            text += delta.content;
          } else if (typeof json.text === 'string') {
            text += json.text;
          }
        } catch (error) {
          throw new Error(getErrorMessage(error));
        }
      }
    }
    return text;
  };
  return new Response(new ReadableStream({
    async start(controller) {
      try {
        const preludeText = await getStreamText(await callDirect(preludeMessages));
        const clarificationResult = parseAgentClarification(preludeText);
        if (clarificationResult.visibleContent) {
          controller.enqueue(encoder.encode(sse({
            type: 'deepchat_content',
            text: clarificationResult.visibleContent
          })));
        }
        if (clarificationResult.clarification) {
          controller.enqueue(encoder.encode(sse({
            type: 'deepchat_clarification',
            clarification: clarificationResult.clarification
          })));
          controller.enqueue(DONE_BYTES);
          controller.close();
          return;
        }
        for (const event of getMCPWorkingEvents(candidateServers)) {
          controller.enqueue(encoder.encode(sse(event)));
        }
        const [mcpRuntimeResult, toolRuntimeResult] = await Promise.all([
          collectMCPRuntimeContextWithUsage(candidateServers, latestUserMessage),
          collectToolRuntimeContextWithSources(tools, latestUserMessage)
        ]);
        const runtimeContext = [mcpRuntimeResult.context, toolRuntimeResult.context].filter(Boolean).join('\n\n');
        const finalMessages = withSystemInstruction(originalMessages, [
          'Continue after MCP usage.',
          'Use the MCP runtime context below as the authoritative external context for the final answer.',
          'Do not claim unavailable tool actions. If the MCP context is capability-only, use it to decide approach and say what must be verified.',
          runtimeContext
        ].filter(Boolean).join('\n\n'));
        for (const event of getMCPStreamEvents(mcpRuntimeResult.usage)) {
          controller.enqueue(encoder.encode(sse(event)));
        }
        for (const event of [...getToolRuntimeEvents(tools, toolRuntimeResult), ...getSearchSourceEvents(toolRuntimeResult.sources)]) {
          controller.enqueue(encoder.encode(sse(event)));
        }
        await pipeSseResponse(controller, await callDirect(finalMessages));
        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(sse({ error: getErrorMessage(error) })));
        controller.enqueue(DONE_BYTES);
        controller.close();
      }
    }
  }), { headers: streamHeaders(provider) });
};

export async function POST(req: Request) {
  try {
    const { messages, modelId, connectionId, mcpServers, tools, skipAgentLoop, skipRuntimeIntegrations, imageAspectRatio, injectedPrompt } = await req.json() as {
      messages?: ChatMessage[];
      modelId?: string;
      connectionId?: string;
      mcpServers?: unknown;
      tools?: unknown;
      skipAgentLoop?: boolean;
      skipRuntimeIntegrations?: boolean;
      imageAspectRatio?: ImageAspectRatio;
      injectedPrompt?: string;
    };

    if (!Array.isArray(messages) || (!modelId && !connectionId)) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    let conn: LlmConnection | null = null;
    if (connectionId === LIVE_LITE_CONNECTION_ID) {
      conn = getLiveLiteConnection();
    } else if (connectionId === LIVE_CHAT_CONNECTION_ID || !connectionId) {
      conn = getLiveChatConnection();
    }

    if (!conn) {
      const connections = await getConnections() as LlmConnection[];
      conn = selectLlmConnection(connections, connectionId, modelId);
    }

    if (!conn) {
      return NextResponse.json({ error: 'No API connection found. Please configure in Settings.' }, { status: 400 });
    }

    const p = normalizeProvider(conn.provider);
    const cleanBase = getCleanBaseUrl(p, conn.baseUrl);
    const latestUser = getLatestUserMessage(messages);
    const requestedImageGeneration = latestUser?.imageGenerationEnabled === true;
    const requestedAspectRatio = normalizeImageAspectRatio(imageAspectRatio || latestUser?.imageAspectRatio);
    const selectedRequestModel = modelId || conn.model;

    const liveImageConfig = getLiveImageConfig();
    const defaultImageModel = liveImageConfig?.model || 'gpt-image-2.5-sunburst';
    const imageFallbackModel = requestedImageGeneration && !isImageGenerationModel(selectedRequestModel)
      ? defaultImageModel
      : '';
    const selectedModel = imageFallbackModel || selectedRequestModel;

    if (requestedImageGeneration && !isImageGenerationModel(selectedModel)) {
      return NextResponse.json({ error: 'Create image needs an image generation model or an OpenAI-compatible connection.' }, { status: 400 });
    }

    const [llmSettings, persona] = await Promise.all([
      readLLMSettings(),
      getPersona()
    ]);
    const isStream = llmSettings.streamingResponse;

    const latestUserMessage = getRuntimeMessageText(latestUser);
    const runtimeMCPServers = skipRuntimeIntegrations ? [] : normalizeChatMCPServers(mcpServers);
    const runtimeTools = skipRuntimeIntegrations ? [] : normalizeChatTools(tools);

    if (!skipAgentLoop && runtimeMCPServers.length > 0 && getMCPRuntimeCandidateServers(runtimeMCPServers, latestUserMessage).length > 0) {
      return createAgenticMCPResponse(req.url, p, { modelId, connectionId }, messages, runtimeMCPServers, runtimeTools, latestUserMessage);
    }

    const [mcpRuntimeResult, toolRuntimeResult] = await Promise.all([
      skipRuntimeIntegrations ? Promise.resolve({ context: '', usage: [] as MCPRuntimeUsageItem[] }) : collectMCPRuntimeContextWithUsage(runtimeMCPServers, latestUserMessage),
      skipRuntimeIntegrations ? Promise.resolve({ context: '', sources: [] as SearchSource[] }) : collectToolRuntimeContextWithSources(runtimeTools, latestUserMessage)
    ]);
    const mcpRuntimeContext = mcpRuntimeResult.context;
    const runtimeContext = [mcpRuntimeContext, toolRuntimeResult.context].filter(Boolean).join('\n\n');
    const integrationEvents = [...getMCPStreamEvents(mcpRuntimeResult.usage), ...getToolRuntimeEvents(runtimeTools, toolRuntimeResult), ...getSearchSourceEvents(toolRuntimeResult.sources)];
    const usedMCPIds = new Set(mcpRuntimeResult.usage.map(item => item.id));
    const promptMCPServers = runtimeMCPServers.filter(server => usedMCPIds.has(server.serverId));

    const integrationPrompt = [buildPlatformCapabilityPrompt(), buildIntegrationSystemPrompt(promptMCPServers, runtimeTools, runtimeContext)].filter(Boolean).join('\n\n');
    const systemIndex = messages.findIndex((m: unknown) => isChatMessageLike(m) && m.role === 'system');
    const promptToInject = injectedPrompt || await getInjectedSystemPrompt('', latestUserMessage);
    if (systemIndex !== -1) {
      const baseSystemPrompt = [persona.memoryReferenceHistory === false ? '' : messages[systemIndex].content, integrationPrompt].filter(Boolean).join('\n\n');
      messages[systemIndex].content = [promptToInject, baseSystemPrompt].filter(Boolean).join('\n\n');
    } else {
      const combined = [promptToInject, integrationPrompt].filter(Boolean).join('\n\n');
      if (combined) {
        messages.unshift({ role: 'system', content: combined });
      }
    }

    const aiLogPayload = {
      route: 'chat',
      provider: conn.provider,
      model: selectedModel,
      input: latestUserMessage
    };

    if (requestedImageGeneration || isImageGenerationModel(selectedModel)) {
      const liveImage = getLiveImageConfig();
      const useLiveImage = Boolean(liveImage && (!conn || conn.id === LIVE_CHAT_CONNECTION_ID || conn.id === LIVE_LITE_CONNECTION_ID || !cleanBase));
      const imageBase = useLiveImage && liveImage ? liveImage.baseUrl : (cleanBase || liveImage?.baseUrl || '');
      const imageKey = useLiveImage && liveImage ? liveImage.apiKey : (conn.apiKey || liveImage?.apiKey || '');
      const prompt = getImageGenerationPrompt(messages);
      const imageModel = selectedModel && isImageGenerationModel(selectedModel) ? selectedModel : (liveImage?.model || 'gpt-image-2.5-sunburst');
      const body = getOpenAIImageRequestBody(imageModel, prompt, requestedAspectRatio);
      const res = await fetch(`${imageBase}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${imageKey}`
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await getRouteResponseError(res));
      const data = await res.json();
      const images = await inlineRemoteGeneratedImages(getOpenAIGeneratedImages(data));
      if (images.length === 0) {
        throw new Error('Image generation did not return an image. The model may have blocked the request or returned an unsupported response.');
      }
      const output = imageOutputToMarkdown(await materializeGeneratedImages(images));
      logAiExchange({ ...aiLogPayload, output });
      return singleSseResponse(p, { choices: [{ delta: { content: output } }] }, integrationEvents);
    }

    const url = getChatCompletionsUrl(p, cleanBase);
    const openAICompatibleMessages = await buildOpenAICompatibleMessages(messages, conn.provider, isMistralChatCompletionsTarget(conn, cleanBase, p));
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      Authorization: `Bearer ${conn.apiKey}`
    };
    const body = applyOpenAICompatibleReasoning({
      model: selectedModel || modelId || conn.model,
      messages: openAICompatibleMessages,
      stream: isStream
    }, llmSettings);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `API Error: ${res.status} ${errText}` }, { status: res.status });
    }

    if (!isStream) {
      const data = await res.json();
      const message = getOpenAiCompatibleMessage(data);
      logAiExchange({ ...aiLogPayload, output: [message.reasoning_content, message.content].filter(Boolean).join('\n') });
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
    return new Response(prependSseEvents(streamBody, integrationEvents), {
      headers: streamHeaders(p)
    });

  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
