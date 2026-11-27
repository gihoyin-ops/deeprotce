import {
  createChatRecord,
  getChatRecord,
  listChatRecords,
  listSharedLinkRecords,
  saveMessageRecord,
  updateChatRecord,
  deleteChatRecord,
  deleteAllChatRecords,
  saveSharedSnapshot,
  getSharedSnapshot,
  deleteSharedSnapshot,
  getUserProfileClient,
  saveUserProfileClient,
  getLLMSettingsClient,
  saveLLMSettingsClient,
  getConnectionsClient,
  saveConnectionClient,
  deleteConnectionClient,
  deleteAllConnectionsClient,
  uploadFileClient,
  exportDataClient,
  type StoredAttachment,
  type StoredChat,
  type StoredMessage,
  type UserProfileData,
  type LLMSettings,
  type ConnectionData
} from '@/lib/storage/client-storage';
import { clearChatHistory, deleteChatReferences } from './memory';
import { DEFAULT_GUEST_AVATAR } from '@/lib/avatar';
import { convertImageToWebp } from '@/lib/images/client-webp';

export type UploadFileResult = {
  success: boolean;
  fileName?: string;
  ext?: string;
  previewUrl?: string;
  storageKey?: string;
  dataUrl?: string;
  content?: string;
  size?: number;
  error?: string;
};

export type {
  StoredAttachment,
  StoredChat,
  StoredMessage,
  UserProfileData,
  LLMSettings
};

const serverMemoryChats = new Map<string, StoredChat>();
const serverSharedSnapshots = new Map<string, StoredChat>();

export async function ensureChatDir() {}

export async function createChat(title = 'New Chat', attachedFiles?: StoredAttachment[]): Promise<string> {
  if (typeof window !== 'undefined') {
    const chat = await createChatRecord(title, attachedFiles);
    return chat.id as string;
  }
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
  serverMemoryChats.set(id, chat);
  return id;
}

export async function getChats() {
  if (typeof window !== 'undefined') {
    return listChatRecords(false);
  }
  return Array.from(serverMemoryChats.values()).filter(c => !c.archived);
}
export async function getArchivedChats() {
  if (typeof window !== 'undefined') {
    const list = await listChatRecords(true);
    return list
      .filter((chat): chat is StoredChat & { id: string } => typeof chat.id === 'string')
      .map(chat => ({
        ...chat,
        id: chat.id,
        title: chat.title || 'New Chat',
        createdAt: chat.createdAt || new Date().toISOString()
      }));
  }
  return Array.from(serverMemoryChats.values())
    .filter((c): c is StoredChat & { id: string } => Boolean(c.archived) && typeof c.id === 'string')
    .map(chat => ({
      ...chat,
      id: chat.id,
      title: chat.title || 'New Chat',
      createdAt: chat.createdAt || new Date().toISOString()
    }));
}
export async function getSharedLinks() {
  if (typeof window !== 'undefined') {
    return listSharedLinkRecords();
  }
  return Array.from(serverMemoryChats.values())
    .filter(c => typeof c.shareId === 'string' && c.shareId.length > 0)
    .map(c => ({
      id: c.id || '',
      shareId: c.shareId as string,
      title: c.title || 'New Chat',
      createdAt: c.createdAt || new Date().toISOString(),
      messageCount: Array.isArray(c.messages) ? c.messages.length : 0
    }));
}

export async function getChat(id: string): Promise<StoredChat | null> {
  if (typeof window !== 'undefined') {
    return getChatRecord(id);
  }
  return serverMemoryChats.get(id) || null;
}

export async function shareChat(chatId: string) {
  if (typeof window !== 'undefined') {
    const chat = await getChatRecord(chatId);
    if (!chat) return null;
    let shareId = typeof chat.shareId === 'string' && chat.shareId ? chat.shareId : '';
    const ownerProfile = await getUserProfile();
    if (!shareId) {
      shareId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      chat.isShared = true;
      chat.shareId = shareId;
    }
    chat.ownerProfile = {
      id: ownerProfile?.id || 'default',
      name: ownerProfile?.name || 'Guest',
      avatar: ownerProfile?.avatar || DEFAULT_GUEST_AVATAR,
      plan: ownerProfile?.plan || ''
    };
    await updateChatRecord(chatId, chat);
    await saveSharedSnapshot(shareId, chatId, chat);
    serverSharedSnapshots.set(shareId, chat);
    return shareId;
  }
  const chat = serverMemoryChats.get(chatId);
  if (!chat) return null;
  const shareId = typeof chat.shareId === 'string' && chat.shareId
    ? chat.shareId
    : `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  chat.isShared = true;
  chat.shareId = shareId;
  serverSharedSnapshots.set(shareId, chat);
  return shareId;
}

export async function getSharedChat(shareId: string): Promise<StoredChat | null> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/chats/share/${encodeURIComponent(shareId)}`, {
        credentials: 'same-origin'
      });
      if (res.ok) {
        const data = (await res.json()) as { chat?: StoredChat };
        if (data.chat) return data.chat;
      }
    } catch {
      // Network is dead or guest-only, fall back to the local snapshot
    }
    const localShared = await getSharedSnapshot(shareId);
    if (localShared) return localShared;
  }
  return serverSharedSnapshots.get(shareId) || null;
}

export async function deleteSharedChat(shareId: string) {
  if (typeof window !== 'undefined') {
    await deleteSharedSnapshot(shareId);
  }
  serverSharedSnapshots.delete(shareId);
  return true;
}

export async function forkSharedChat(sharedChat: StoredChat): Promise<string> {
  const title = typeof sharedChat.title === 'string' && sharedChat.title.trim()
    ? sharedChat.title.trim()
    : 'Shared Chat';
  const newChatId = await createChat(title);
  const messages = Array.isArray(sharedChat.messages) ? sharedChat.messages : [];
  const batchToken = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    await saveMessage(newChatId, {
      ...msg,
      id: `fork_${batchToken}_${i}`,
      chatId: newChatId,
      chatIndex: i,
      isStreaming: false,
    });
  }
  return newChatId;
}

export async function saveMessage(id: string, message: StoredMessage) {
  if (typeof window !== 'undefined') {
    return saveMessageRecord(id, message);
  }
  const chat = serverMemoryChats.get(id);
  if (!chat) return null;
  const messages = Array.isArray(chat.messages) ? [...chat.messages] : [];
  const existingIndex = messages.findIndex(m => m.id === message.id);
  if (existingIndex >= 0) {
    messages[existingIndex] = { ...messages[existingIndex], ...message };
  } else {
    messages.push(message);
  }
  chat.messages = messages;
  serverMemoryChats.set(id, chat);
  return chat;
}

export async function updateChatTitle(id: string, title: string) {
  if (typeof window !== 'undefined') {
    return updateChatRecord(id, { title });
  }
  const chat = serverMemoryChats.get(id);
  if (!chat) return null;
  chat.title = title;
  return chat;
}

export async function updateChatTags(id: string, tags: string[]) {
  if (typeof window !== 'undefined') {
    return updateChatRecord(id, { tags });
  }
  const chat = serverMemoryChats.get(id);
  if (!chat) return null;
  chat.tags = tags;
  return chat;
}

export async function togglePinChat(id: string) {
  if (typeof window !== 'undefined') {
    const chat = await getChatRecord(id);
    if (chat) {
      return updateChatRecord(id, { pinned: !chat.pinned });
    }
    return null;
  }
  const chat = serverMemoryChats.get(id);
  if (!chat) return null;
  chat.pinned = !chat.pinned;
  return chat;
}

export async function archiveChat(id: string) {
  if (typeof window !== 'undefined') {
    return updateChatRecord(id, { archived: true });
  }
  const chat = serverMemoryChats.get(id);
  if (!chat) return null;
  chat.archived = true;
  return chat;
}

export async function unarchiveChat(id: string) {
  if (typeof window !== 'undefined') {
    return updateChatRecord(id, { archived: false });
  }
  const chat = serverMemoryChats.get(id);
  if (!chat) return null;
  chat.archived = false;
  return chat;
}

export async function archiveAllChats() {
  if (typeof window !== 'undefined') {
    const chats = await listChatRecords(false);
    let count = 0;
    for (const chat of chats) {
      if (!chat.id) continue;
      await updateChatRecord(chat.id, { archived: true });
      count += 1;
    }
    return { success: true, count };
  }
  let count = 0;
  for (const chat of serverMemoryChats.values()) {
    if (!chat.archived) {
      chat.archived = true;
      count++;
    }
  }
  return { success: true, count };
}

export async function deleteChat(id: string) {
  if (typeof window !== 'undefined') {
    await deleteChatRecord(id);
    await deleteChatReferences(id);
    return true;
  }
  serverMemoryChats.delete(id);
  await deleteChatReferences(id);
  return true;
}

export async function deleteAllChats() {
  if (typeof window !== 'undefined') {
    await deleteAllChatRecords();
    await clearChatHistory();
    return true;
  }
  serverMemoryChats.clear();
  serverSharedSnapshots.clear();
  await clearChatHistory();
  return true;
}

const RASTER_IMAGE_TO_WEBP_EXTS = new Set([
  'png',
  'jpg',
  'jpeg',
  'bmp',
  'avif',
  'tiff',
  'tif',
  'ico'
]);

const shouldConvertAttachmentToWebp = (file: File): boolean => {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/svg+xml' || type === 'image/gif' || type === 'image/webp') {
    return false;
  }
  if (type.startsWith('image/')) {
    return true;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return RASTER_IMAGE_TO_WEBP_EXTS.has(ext);
};

export async function uploadFile(formData: FormData): Promise<UploadFileResult> {
  if (typeof window !== 'undefined') {
    const rawFile = formData.get('file');
    if (!(rawFile instanceof File)) {
      return { success: false, error: 'No file provided' };
    }

    let file = rawFile;
    if (shouldConvertAttachmentToWebp(rawFile)) {
      try {
        const converted = await convertImageToWebp(rawFile, { quality: 0.88 });
        file = converted.file;
      } catch {
        // Fallback to original file if client-side WebP conversion fails
      }
    }

    const clientResult = await uploadFileClient(file);
    if (!clientResult.success) {
      return clientResult;
    }

    // Upload to R2 storage (and register in Library for signed-in users)
    try {
      const r2Form = new FormData();
      r2Form.append('file', file);
      r2Form.append('folder', 'attachments');

      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: r2Form
      });

      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean;
          url?: string;
          key?: string;
          fileName?: string;
          sizeBytes?: number;
        };
        if (data.ok && data.url) {
          return {
            success: true,
            fileName: file.name || clientResult.fileName,
            ext: clientResult.ext,
            previewUrl: data.url,
            storageKey: data.key,
            content: clientResult.content,
            size: data.sizeBytes ?? clientResult.size
          };
        }
      }
    } catch {
      // Fallback to client-side IndexedDB dataUrl when offline or R2 is unavailable
    }

    return {
      ...clientResult,
      fileName: file.name || clientResult.fileName
    };
  }
  return { success: false, error: 'File upload handled client side' };
}

export async function ensureUserDir() {}

export async function getUserProfile(): Promise<UserProfileData> {
  if (typeof window !== 'undefined') {
    return getUserProfileClient();
  }
  return {
    id: 'default',
    name: 'Guest',
    avatar: DEFAULT_GUEST_AVATAR,
    plan: ''
  };
}

export async function saveUserProfile(profile: UserProfileData) {
  if (typeof window !== 'undefined') {
    return saveUserProfileClient(profile);
  }
  return profile;
}
export async function getLLMSettings(): Promise<LLMSettings> {
  if (typeof window !== 'undefined') {
    return getLLMSettingsClient();
  }
  return {
    streamingResponse: true,
    reasoning: false,
    reasoningLevel: 'medium'
  };
}

export async function saveLLMSettings(settings: Partial<LLMSettings>): Promise<LLMSettings> {
  if (typeof window !== 'undefined') {
    return saveLLMSettingsClient(settings);
  }
  return {
    streamingResponse: true,
    reasoning: false,
    reasoningLevel: 'medium',
    ...settings
  };
}

export async function getConnections(): Promise<ConnectionData[]> {
  if (typeof window !== 'undefined') {
    return getConnectionsClient();
  }
  return [];
}

export async function saveConnection(connection: ConnectionData) {
  if (typeof window !== 'undefined') {
    return saveConnectionClient(connection);
  }
  return connection;
}

export async function deleteConnection(id: string) {
  if (typeof window !== 'undefined') {
    return deleteConnectionClient(id);
  }
  return true;
}

export async function deleteAllConnections() {
  if (typeof window !== 'undefined') {
    return deleteAllConnectionsClient();
  }
  return true;
}

export async function exportData() {
  if (typeof window !== 'undefined') {
    return exportDataClient();
  }
  return {
    exportedAt: new Date().toISOString(),
    chats: Array.from(serverMemoryChats.values()),
    sharedChats: Array.from(serverSharedSnapshots.values()),
    profile: await getUserProfile(),
    persona: { instructions: '' },
    memories: { saved: [], chatHistory: [] },
    connections: []
  };
}
