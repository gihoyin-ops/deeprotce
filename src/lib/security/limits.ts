export const MAX_CHAT_MESSAGES = 100;
export const MAX_MESSAGE_CHARS = 50_000;
export const MAX_TOTAL_CONTENT_CHARS = 200_000;
export const MAX_ATTACHMENTS = 4;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_MCP_SERVERS = 3;
export const MAX_TOOLS = 5;
export const MAX_BODY_BYTES = 12 * 1024 * 1024;
export const MAX_TITLE_PROMPT_CHARS = 5_000;
export const MAX_EXTRACT_MESSAGE_CHARS = 10_000;

const getMessageContent = (message: unknown): string => {
  if (message !== null && typeof message === 'object' && 'content' in message) {
    return typeof message.content === 'string' ? message.content : '';
  }
  return '';
};

const getMessageAttachedFiles = (message: unknown): unknown[] => {
  if (message !== null && typeof message === 'object' && 'attachedFiles' in message) {
    return Array.isArray(message.attachedFiles) ? message.attachedFiles : [];
  }
  return [];
};

const getAttachmentBase64 = (file: unknown): string => {
  if (file !== null && typeof file === 'object') {
    if ('dataUrl' in file && typeof file.dataUrl === 'string') return file.dataUrl;
    if ('base64' in file && typeof file.base64 === 'string') return file.base64;
  }
  return '';
};

type ChatBodyPayload = {
  messages?: unknown;
  mcpServers?: unknown;
  tools?: unknown;
};

const isChatBodyPayload = (value: unknown): value is ChatBodyPayload =>
  value !== null && typeof value === 'object';

export const validateChatBody = (payload: unknown): string | null => {
  if (!isChatBodyPayload(payload)) return 'invalid payload';

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (messages.length > MAX_CHAT_MESSAGES) return 'too many messages';

  let totalChars = 0;
  for (const message of messages) {
    const content = getMessageContent(message);
    if (content.length > MAX_MESSAGE_CHARS) return 'message too long';
    totalChars += content.length;

    const files = getMessageAttachedFiles(message);
    if (files.length > MAX_ATTACHMENTS) return 'too many attachments';
    for (const file of files) {
      const raw = getAttachmentBase64(file);
      if (raw === '') continue;
      // base64 encodes 3 source bytes per 4 characters
      const body = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
      if (Math.ceil(body.length * 3 / 4) > MAX_ATTACHMENT_BYTES) return 'attachment too large';
    }
  }
  if (totalChars > MAX_TOTAL_CONTENT_CHARS) return 'content too long';

  const mcpServers = Array.isArray(payload.mcpServers) ? payload.mcpServers : [];
  if (mcpServers.length > MAX_MCP_SERVERS) return 'too many mcp servers';

  const tools = Array.isArray(payload.tools) ? payload.tools : [];
  if (tools.length > MAX_TOOLS) return 'too many tools';

  return null;
};
