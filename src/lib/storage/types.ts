export type StoredAttachment = {
  name?: unknown;
  ext?: unknown;
  dataUrl?: string;
  content?: string;
  size?: number;
  previewUrl?: string;
  [key: string]: unknown;
};

export type StoredMessageVersion = {
  content?: unknown;
  reasoning?: unknown;
  reasoningDuration?: unknown;
  versionIndex?: unknown;
  mcpNotice?: unknown;
  mcpUsage?: unknown;
  mcpContentOffset?: unknown;
  searchSources?: unknown;
  clarification?: unknown;
  clarificationAnswer?: unknown;
  generationMode?: unknown;
  [key: string]: unknown;
};

export type StoredMessage = {
  id?: unknown;
  chatId?: unknown;
  role?: unknown;
  content?: unknown;
  reasoning?: unknown;
  reasoningDuration?: unknown;
  versions?: StoredMessageVersion[];
  currentVersionIndex?: unknown;
  chatIndex?: unknown;
  createdAt?: unknown;
  isStreaming?: unknown;
  isError?: unknown;
  isStopped?: unknown;
  attachedFiles?: StoredAttachment[];
  attachedFile?: StoredAttachment;
  mcpNotice?: unknown;
  mcpUsage?: unknown;
  mcpContentOffset?: unknown;
  searchSources?: unknown;
  clarification?: unknown;
  clarificationAnswer?: unknown;
  generationMode?: unknown;
  [key: string]: unknown;
};

export type UserProfileData = {
  id?: string;
  name: string;
  avatar: string;
  plan: string;
};

export type StoredChat = {
  id?: string;
  title?: string;
  createdAt?: string;
  archived?: boolean;
  isShared?: boolean;
  pinned?: boolean;
  shareId?: unknown;
  folder?: string;
  tags?: string[];
  ownerProfile?: UserProfileData;
  messages?: StoredMessage[];
  pendingAttachedFiles?: StoredAttachment[];
  extra?: Record<string, unknown>;
  [key: string]: unknown;
};

export type SavedMemoryRecord = {
  id: string;
  content: string;
  category: string;
  importance?: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
  sourceProvider?: string;
  sourceModel?: string;
  sourceConnectionId?: string;
  sourceChatId?: string;
  vector?: number[];
};

export type ChatHistoryMemoryRecord = {
  id: string;
  chatId?: string;
  userMessage: string;
  assistantMessage: string;
  createdAt: string;
  sourceProvider?: string;
  sourceModel?: string;
  sourceConnectionId?: string;
  sourceUserMessageId?: string;
  vector?: number[];
};
