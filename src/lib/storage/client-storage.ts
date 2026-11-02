import type {
  StoredAttachment,
  StoredChat,
  StoredMessage,
  StoredMessageVersion,
  UserProfileData,
  SavedMemoryRecord,
  ChatHistoryMemoryRecord
} from './types';
import type { PersonaData } from '@/app/persona';
import type { LLMSettings } from '@/lib/settings/llm-settings';

export type {
  StoredAttachment,
  StoredChat,
  StoredMessage,
  StoredMessageVersion,
  UserProfileData,
  SavedMemoryRecord,
  ChatHistoryMemoryRecord,
  PersonaData,
  LLMSettings
};

export interface ExportDataPayload {
  exportedAt: string;
  chats: StoredChat[];
  sharedChats: unknown[];
  profile: UserProfileData;
  persona: PersonaData;
  memories: {
    saved: SavedMemoryRecord[];
    chatHistory: ChatHistoryMemoryRecord[];
  };
  connections: unknown[];
}

export interface ConnectionData {
  id?: string;
  provider?: string;
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  projectId?: string;
  location?: string;
  model?: string;
}

const DB_NAME = 'deepchat_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const getIndexedDB = (): Promise<IDBDatabase> => {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported'));
  }
  if (!dbPromise) {
    const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>();
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('chats')) {
        const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
        chatStore.createIndex('createdAt', 'createdAt', { unique: false });
        chatStore.createIndex('archived', 'archived', { unique: false });
        chatStore.createIndex('pinned', 'pinned', { unique: false });
      }
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('memories')) {
        const memStore = db.createObjectStore('memories', { keyPath: 'id' });
        memStore.createIndex('type', 'type', { unique: false });
        memStore.createIndex('chatId', 'chatId', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('shared_chats')) {
        db.createObjectStore('shared_chats', { keyPath: 'shareId' });
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    dbPromise = promise;
  }
  return dbPromise;
};

const idbGet = async <T>(storeName: string, key: IDBValidKey): Promise<T | null> => {
  try {
    const db = await getIndexedDB();
    const { promise, resolve, reject } = Promise.withResolvers<T | null>();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
    return await promise;
  } catch {
    return null;
  }
};

const idbSet = async <T>(storeName: string, value: T): Promise<void> => {
  try {
    const db = await getIndexedDB();
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    await promise;
  } catch {}
};

const idbDelete = async (storeName: string, key: IDBValidKey): Promise<void> => {
  try {
    const db = await getIndexedDB();
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    await promise;
  } catch {}
};

const idbGetAll = async <T>(storeName: string): Promise<T[]> => {
  try {
    const db = await getIndexedDB();
    const { promise, resolve, reject } = Promise.withResolvers<T[]>();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
    return await promise;
  } catch {
    return [];
  }
};

const idbClear = async (storeName: string): Promise<void> => {
  try {
    const db = await getIndexedDB();
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    await promise;
  } catch {}
};

const idbGetByIndex = async <T>(storeName: string, indexName: string, key: IDBValidKey): Promise<T[]> => {
  try {
    const db = await getIndexedDB();
    const { promise, resolve, reject } = Promise.withResolvers<T[]>();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(key);
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
    return await promise;
  } catch {
    return [];
  }
};

const generateRandomId = (prefix = 'c'): string => {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${time}_${random}`;
};

const notifyChatUpdated = (chatId?: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { chatId } }));
  }
};

const notifyProfileUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('profileUpdated'));
  }
};

const normalizeVersions = (message: StoredMessage): StoredMessage => {
  if (!Array.isArray(message?.versions) || message.versions.length === 0) return message;
  const versions = message.versions.map((version, index) => ({
    ...version,
    versionIndex: typeof version?.versionIndex === 'number' ? version.versionIndex : index + 1
  }));
  const requestedIndex = typeof message.currentVersionIndex === 'number' && Number.isInteger(message.currentVersionIndex)
    ? message.currentVersionIndex
    : versions.length - 1;
  const currentVersionIndex = Math.min(Math.max(requestedIndex, 0), versions.length - 1);
  const selectedVersion = versions[currentVersionIndex] || versions[versions.length - 1];
  return {
    ...message,
    versions,
    currentVersionIndex,
    content: typeof selectedVersion?.content === 'string' ? selectedVersion.content : message.content,
    reasoning: typeof selectedVersion?.reasoning === 'string' ? selectedVersion.reasoning : message.reasoning,
    reasoningDuration: selectedVersion?.reasoningDuration ?? message.reasoningDuration
  };
};

export const createChatRecord = async (title = 'New Chat', attachedFiles?: StoredAttachment[]): Promise<StoredChat> => {
  const id = generateRandomId('chat');
  const now = new Date().toISOString();
  const chat: StoredChat = {
    id,
    title,
    createdAt: now,
    archived: false,
    isShared: false,
    pinned: false,
    messages: [],
    pendingAttachedFiles: attachedFiles || [],
    tags: []
  };
  await idbSet('chats', chat);
  notifyChatUpdated(id);
  return chat;
};

export const getChatRecord = async (id: string): Promise<StoredChat | null> => {
  const chat = await idbGet<StoredChat>('chats', id);
  if (!chat) return null;
  return {
    ...chat,
    messages: Array.isArray(chat.messages) ? chat.messages : []
  };
};

export const listChatRecords = async (archived = false): Promise<StoredChat[]> => {
  const allChats = await idbGetAll<StoredChat>('chats');
  return allChats
    .filter(chat => Boolean(chat.archived) === archived)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
};

export const listSharedLinkRecords = async () => {
  const allChats = await idbGetAll<StoredChat>('chats');
  return allChats
    .filter(chat => typeof chat.shareId === 'string' && chat.shareId.length > 0)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .map(chat => ({
      id: chat.id || '',
      shareId: chat.shareId as string,
      title: chat.title || 'New Chat',
      createdAt: chat.createdAt || new Date().toISOString(),
      messageCount: Array.isArray(chat.messages) ? chat.messages.length : 0
    }));
};

export const saveMessageRecord = async (id: string, message: StoredMessage): Promise<StoredChat | null> => {
  const chat = await getChatRecord(id);
  if (!chat) return null;
  const messages = Array.isArray(chat.messages) ? [...chat.messages] : [];
  const normalized = normalizeVersions(message);
  const existingIndex = messages.findIndex(m => m.id === message.id);
  if (existingIndex >= 0) {
    messages[existingIndex] = {
      ...messages[existingIndex],
      ...normalized
    };
  } else {
    messages.push({
      ...normalized,
      chatIndex: typeof normalized.chatIndex === 'number' ? normalized.chatIndex : messages.length
    });
  }
  const updated: StoredChat = {
    ...chat,
    messages
  };
  await idbSet('chats', updated);
  notifyChatUpdated(id);
  return updated;
};

export const updateChatRecord = async (id: string, patch: Partial<StoredChat>): Promise<StoredChat | null> => {
  const chat = await getChatRecord(id);
  if (!chat) return null;
  const updated: StoredChat = {
    ...chat,
    ...patch
  };
  await idbSet('chats', updated);
  notifyChatUpdated(id);
  return updated;
};

export const deleteChatRecord = async (id: string): Promise<boolean> => {
  await idbDelete('chats', id);
  await deleteChatReferencesClient(id);
  notifyChatUpdated(id);
  return true;
};

export const deleteAllChatRecords = async (): Promise<boolean> => {
  await idbClear('chats');
  await idbClear('shared_chats');
  await clearChatHistoryClient();
  notifyChatUpdated();
  return true;
};

export const saveSharedSnapshot = async (shareId: string, chatId: string, chat: StoredChat) => {
  await idbSet('shared_chats', {
    shareId,
    chatId,
    snapshot: chat,
    createdAt: new Date().toISOString()
  });
};

export const getSharedSnapshot = async (shareId: string): Promise<StoredChat | null> => {
  const shared = await idbGet<{ shareId: string; snapshot: StoredChat }>('shared_chats', shareId);
  if (shared?.snapshot) return shared.snapshot;
  const all = await idbGetAll<StoredChat>('chats');
  return all.find(c => c.shareId === shareId) || null;
};

export const deleteSharedSnapshot = async (shareId: string): Promise<void> => {
  await idbDelete('shared_chats', shareId);
};

export const getUserProfileClient = async (): Promise<UserProfileData> => {
  if (typeof window !== 'undefined') {
    try {
      const fromDb = await idbGet<{ key: string; value: UserProfileData }>('settings', 'user_profile');
      if (fromDb?.value) {
        return {
          id: fromDb.value.id || 'default',
          name: fromDb.value.name || 'Guest',
          avatar: fromDb.value.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
          plan: fromDb.value.plan || ''
        };
      }
      const fromLs = localStorage.getItem('deepchat-user-profile');
      if (fromLs) {
        const parsed = JSON.parse(fromLs);
        const normalized = {
          id: parsed.id || 'default',
          name: parsed.name || 'Guest',
          avatar: parsed.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
          plan: parsed.plan || ''
        };
        await idbSet('settings', { key: 'user_profile', value: normalized });
        return normalized;
      }
    } catch {}
  }
  return {
    id: 'default',
    name: 'Guest',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    plan: ''
  };
};

export const saveUserProfileClient = async (profile: UserProfileData): Promise<UserProfileData> => {
  if (typeof window !== 'undefined') {
    try {
      await idbSet('settings', { key: 'user_profile', value: profile });
      localStorage.setItem('deepchat-user-profile', JSON.stringify(profile));
      notifyProfileUpdated();
    } catch {}
  }
  return profile;
};

export const getPersonaClient = async (): Promise<PersonaData> => {
  const defaultPersona: PersonaData = {
    instructions: '',
    styleTone: 'Normal',
    charWarm: 'Normal',
    charEnthusiastic: 'Normal',
    charHeaders: 'Normal',
    charEmoji: 'Normal',
    aboutName: '',
    aboutOccupation: '',
    aboutMore: '',
    memoryReferenceSaved: true,
    memoryReferenceHistory: true
  };
  if (typeof window !== 'undefined') {
    try {
      const fromDb = await idbGet<{ key: string; value: PersonaData }>('settings', 'persona');
      if (fromDb?.value) return { ...defaultPersona, ...fromDb.value };
      const fromLs = localStorage.getItem('deepchat-persona');
      if (fromLs) {
        const parsed = JSON.parse(fromLs);
        await idbSet('settings', { key: 'persona', value: parsed });
        return { ...defaultPersona, ...parsed };
      }
    } catch {}
  }
  return defaultPersona;
};

export const savePersonaClient = async (persona: PersonaData): Promise<boolean> => {
  if (typeof window !== 'undefined') {
    try {
      await idbSet('settings', { key: 'persona', value: persona });
      localStorage.setItem('deepchat-persona', JSON.stringify(persona));
      return true;
    } catch {}
  }
  return false;
};

export const getLLMSettingsClient = async (): Promise<LLMSettings> => {
  const defaultSettings: LLMSettings = {
    streamingResponse: true,
    reasoning: false,
    reasoningLevel: 'medium'
  };
  if (typeof window !== 'undefined') {
    try {
      const fromDb = await idbGet<{ key: string; value: LLMSettings }>('settings', 'llm_settings');
      if (fromDb?.value) return { ...defaultSettings, ...fromDb.value };
    } catch {}
  }
  return defaultSettings;
};

export const saveLLMSettingsClient = async (settings: Partial<LLMSettings>): Promise<LLMSettings> => {
  const current = await getLLMSettingsClient();
  const updated: LLMSettings = { ...current, ...settings };
  if (typeof window !== 'undefined') {
    try {
      await idbSet('settings', { key: 'llm_settings', value: updated });
    } catch {}
  }
  return updated;
};

export const getConnectionsClient = async (): Promise<ConnectionData[]> => {
  if (typeof window !== 'undefined') {
    try {
      const fromDb = await idbGet<{ key: string; value: ConnectionData[] }>('settings', 'connections');
      if (Array.isArray(fromDb?.value)) return fromDb.value;
    } catch {}
  }
  return [];
};

export const saveConnectionClient = async (connection: ConnectionData): Promise<ConnectionData> => {
  const current = await getConnectionsClient();
  const id = connection.id || generateRandomId('conn');
  const normalized = { ...connection, id };
  const index = current.findIndex(c => c.id === id);
  const updated = index >= 0 ? [...current] : [...current, normalized];
  if (index >= 0) updated[index] = normalized;
  if (typeof window !== 'undefined') {
    try {
      await idbSet('settings', { key: 'connections', value: updated });
    } catch {}
  }
  return normalized;
};

export const deleteConnectionClient = async (id: string): Promise<boolean> => {
  const current = await getConnectionsClient();
  const updated = current.filter(c => c.id !== id);
  if (typeof window !== 'undefined') {
    try {
      await idbSet('settings', { key: 'connections', value: updated });
      return true;
    } catch {}
  }
  return false;
};

export const deleteAllConnectionsClient = async (): Promise<boolean> => {
  if (typeof window !== 'undefined') {
    try {
      await idbSet('settings', { key: 'connections', value: [] });
      return true;
    } catch {}
  }
  return false;
};

type MemoryEntity = (SavedMemoryRecord | ChatHistoryMemoryRecord) & {
  type?: 'saved' | 'history';
};

export const listSavedMemoriesClient = async (): Promise<SavedMemoryRecord[]> => {
  const all = await idbGetByIndex<MemoryEntity>('memories', 'type', 'saved');
  return all.map(item => {
    const record: MemoryEntity = { ...item };
    delete record.type;
    return record as SavedMemoryRecord;
  });
};

export const upsertSavedMemoryClient = async (memory: SavedMemoryRecord): Promise<void> => {
  await idbSet('memories', {
    ...memory,
    type: 'saved'
  } as MemoryEntity);
};

export const deleteSavedMemoryClient = async (id: string): Promise<boolean> => {
  await idbDelete('memories', id);
  return true;
};

export const clearSavedMemoriesClient = async (): Promise<boolean> => {
  const memories = await idbGetByIndex<MemoryEntity>('memories', 'type', 'saved');
  for (const m of memories) {
    await idbDelete('memories', m.id);
  }
  return true;
};

export const listChatHistoryMemoriesClient = async (): Promise<ChatHistoryMemoryRecord[]> => {
  const all = await idbGetByIndex<MemoryEntity>('memories', 'type', 'history');
  return all.map(item => {
    const record: MemoryEntity = { ...item };
    delete record.type;
    return record as ChatHistoryMemoryRecord;
  });
};

export const upsertChatHistoryMemoryClient = async (memory: ChatHistoryMemoryRecord): Promise<void> => {
  await idbSet('memories', {
    ...memory,
    type: 'history'
  } as MemoryEntity);
};

export const deleteChatReferencesClient = async (chatId: string): Promise<boolean> => {
  const all = await idbGetByIndex<MemoryEntity>('memories', 'chatId', chatId);
  for (const item of all) {
    await idbDelete('memories', item.id);
  }
  return true;
};

export const clearChatHistoryClient = async (): Promise<boolean> => {
  const memories = await idbGetByIndex<MemoryEntity>('memories', 'type', 'history');
  for (const m of memories) {
    await idbDelete('memories', m.id);
  }
  return true;
};

export const uploadFileClient = async (file: File): Promise<{
  success: boolean;
  fileName?: string;
  ext?: string;
  dataUrl?: string;
  content?: string;
  size?: number;
  error?: string;
}> => {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'other';
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const textExts: Record<string, true> = {
      txt: true, md: true, csv: true, json: true, js: true, jsx: true, ts: true, tsx: true,
      html: true, css: true, py: true, sql: true, xml: true, yaml: true, yml: true
    };
    let content: string | undefined;
    if (textExts[ext]) {
      try {
        content = await file.text();
      } catch {}
    }
    const { promise: dataUrlPromise, resolve: resolveDataUrl, reject: rejectDataUrl } = Promise.withResolvers<string>();
    const reader = new FileReader();
    reader.onload = () => resolveDataUrl(reader.result as string);
    reader.onerror = rejectDataUrl;
    reader.readAsDataURL(file);
    const dataUrl = await dataUrlPromise;

    await idbSet('files', {
      id: safeName,
      name: file.name,
      ext,
      size: file.size,
      type: file.type,
      dataUrl,
      content,
      createdAt: new Date().toISOString()
    });

    return {
      success: true,
      fileName: safeName,
      ext,
      dataUrl,
      content,
      size: file.size
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
};

export const exportDataClient = async (): Promise<ExportDataPayload> => {
  const [chats, shared, profile, persona, savedMemories, chatHistory, connections] = await Promise.all([
    idbGetAll<StoredChat>('chats'),
    idbGetAll<{ shareId: string; snapshot: StoredChat }>('shared_chats'),
    getUserProfileClient(),
    getPersonaClient(),
    listSavedMemoriesClient(),
    listChatHistoryMemoriesClient(),
    getConnectionsClient()
  ]);

  return {
    exportedAt: new Date().toISOString(),
    chats,
    sharedChats: shared.map(s => s.snapshot),
    profile,
    persona,
    memories: {
      saved: savedMemories,
      chatHistory
    },
    connections
  };
};
