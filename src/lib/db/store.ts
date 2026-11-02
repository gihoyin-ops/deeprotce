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

const memoryChats = new Map<string, StoredChat>();
const memoryShared = new Map<string, StoredChat>();
let memorySaved: SavedMemoryRecord[] = [];
let memoryHistory: ChatHistoryMemoryRecord[] = [];

export const ensureDataStore = () => {};

export const createChatRecord = (title = 'New Chat', attachedFiles?: StoredAttachment[]): StoredChat => {
  const id = `c_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const chat: StoredChat = {
    id,
    title,
    createdAt: new Date().toISOString(),
    archived: false,
    isShared: false,
    pinned: false,
    messages: [],
    pendingAttachedFiles: attachedFiles || [],
    tags: []
  };
  memoryChats.set(id, chat);
  return chat;
};

export const getChatRecord = (id: string): StoredChat | null => memoryChats.get(id) || null;

export const listChatRecords = (archived: boolean): StoredChat[] => {
  return Array.from(memoryChats.values()).filter(c => Boolean(c.archived) === archived);
};

export const listSharedLinkRecords = () => {
  return Array.from(memoryChats.values())
    .filter(c => typeof c.shareId === 'string' && c.shareId.length > 0)
    .map(c => ({
      id: c.id || '',
      shareId: c.shareId as string,
      title: c.title || 'New Chat',
      createdAt: c.createdAt || new Date().toISOString(),
      messageCount: Array.isArray(c.messages) ? c.messages.length : 0
    }));
};
export const saveMessageRecord = (id: string, message: StoredMessage): StoredChat | null => {
  const chat = memoryChats.get(id);
  if (!chat) return null;
  const messages = Array.isArray(chat.messages) ? [...chat.messages] : [];
  const existingIndex = messages.findIndex(m => m.id === message.id);
  if (existingIndex >= 0) {
    messages[existingIndex] = { ...messages[existingIndex], ...message };
  } else {
    messages.push(message);
  }
  chat.messages = messages;
  memoryChats.set(id, chat);
  return chat;
};

export const updateChatRecord = (id: string, patch: Partial<StoredChat>): StoredChat | null => {
  const chat = memoryChats.get(id);
  if (!chat) return null;
  const updated = { ...chat, ...patch };
  memoryChats.set(id, updated);
  return updated;
};

export const deleteChatRecord = (id: string) => {
  memoryChats.delete(id);
};

export const deleteAllChatRecords = () => {
  memoryChats.clear();
  memoryShared.clear();
};

export const saveSharedSnapshot = (shareId: string, chatId: string, chat: StoredChat) => {
  memoryShared.set(shareId, chat);
};

export const getSharedSnapshot = (shareId: string): StoredChat | null => {
  return memoryShared.get(shareId) || null;
};

export const deleteSharedSnapshot = (shareId: string) => {
  memoryShared.delete(shareId);
};

export const listSavedMemories = (): SavedMemoryRecord[] => memorySaved;

export const upsertSavedMemory = (memory: SavedMemoryRecord) => {
  const idx = memorySaved.findIndex(m => m.id === memory.id);
  if (idx >= 0) memorySaved[idx] = memory;
  else memorySaved.unshift(memory);
};

export const replaceSavedMemories = (memories: SavedMemoryRecord[]) => {
  memorySaved = [...memories];
};

export const deleteSavedMemoryRecord = (id: string) => {
  memorySaved = memorySaved.filter(m => m.id !== id);
};

export const listChatHistoryMemories = (): ChatHistoryMemoryRecord[] => memoryHistory;

export const upsertChatHistoryMemory = (memory: ChatHistoryMemoryRecord) => {
  const idx = memoryHistory.findIndex(m => m.id === memory.id);
  if (idx >= 0) memoryHistory[idx] = memory;
  else memoryHistory.unshift(memory);
};

export const replaceChatHistoryMemories = (memories: ChatHistoryMemoryRecord[]) => {
  memoryHistory = [...memories];
};

export const deleteChatHistoryForChat = (chatId: string) => {
  memoryHistory = memoryHistory.filter(m => m.chatId !== chatId);
};

export const clearChatHistoryRecords = () => {
  memoryHistory = [];
};

export const listExportData = () => {
  return {
    chats: Array.from(memoryChats.values()),
    sharedChats: Array.from(memoryShared.values()),
    savedMemories: memorySaved,
    chatHistory: memoryHistory
  };
};
