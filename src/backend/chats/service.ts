import crypto from 'node:crypto';
import type { DbPool } from '@/backend/db/connection';
import type {
  StoredAttachment,
  StoredChat,
  StoredMessage,
  StoredMessageVersion,
} from '@/lib/storage/types';

interface ChatRow {
  id: string;
  account_id: string;
  title: string;
  folder: string | null;
  tags_json: string | null;
  pinned: number;
  archived: number;
  is_shared: number;
  share_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  chat_id: string;
  role: string;
  chat_index: number;
  current_version_index: number;
  created_at: string;
}

interface MessageVersionRow {
  id: string;
  message_id: string;
  version_index: number;
  content: string;
  reasoning: string | null;
  reasoning_duration: number | null;
  search_sources_json: string | null;
  generation_mode: string | null;
}

interface AttachmentRow {
  id: string;
  message_id: string;
  file_name: string;
  ext: string | null;
  size_bytes: number | null;
  storage_key: string;
  public_url: string;
  created_at: string;
}

function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function unpackSearchSourcesAndMeta(raw: string | null): {
  searchSources: unknown;
  meta: Record<string, unknown>;
} {
  if (!raw) return { searchSources: undefined, meta: {} };
  const parsed = parseJsonSafe<unknown>(raw, null);
  if (Array.isArray(parsed)) {
    return { searchSources: parsed, meta: {} };
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as { sources?: unknown; meta?: Record<string, unknown> };
    return {
      searchSources: obj.sources,
      meta: obj.meta && typeof obj.meta === 'object' ? obj.meta : {},
    };
  }
  return { searchSources: undefined, meta: {} };
}

function packSearchSourcesAndMeta(
  sources: unknown,
  meta: Record<string, unknown>
): string | null {
  const hasSources = Array.isArray(sources) && sources.length > 0;
  const cleanMeta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v !== undefined) cleanMeta[k] = v;
  }
  const hasMeta = Object.keys(cleanMeta).length > 0;
  if (!hasSources && !hasMeta) return null;
  return JSON.stringify({
    ...(hasSources ? { sources } : {}),
    ...(hasMeta ? { meta: cleanMeta } : {}),
  });
}

async function hydrateChats(pool: DbPool, rows: ChatRow[]): Promise<StoredChat[]> {
  if (rows.length === 0) return [];

  const chatIds = rows.map(r => r.id);
  const chatPlaceholders = chatIds.map(() => '?').join(', ');

  const messageRows = await pool.query<MessageRow>(
    `SELECT id, chat_id, role, chat_index, current_version_index, created_at
     FROM messages
     WHERE chat_id IN (${chatPlaceholders})
     ORDER BY chat_index ASC, created_at ASC`,
    chatIds
  );

  const msgIds = messageRows.map(m => m.id);
  let versionRows: MessageVersionRow[] = [];
  let attachmentRows: AttachmentRow[] = [];

  if (msgIds.length > 0) {
    const msgPlaceholders = msgIds.map(() => '?').join(', ');
    [versionRows, attachmentRows] = await Promise.all([
      pool.query<MessageVersionRow>(
        `SELECT id, message_id, version_index, content, reasoning, reasoning_duration, search_sources_json, generation_mode
         FROM message_versions
         WHERE message_id IN (${msgPlaceholders})
         ORDER BY version_index ASC`,
        msgIds
      ),
      pool.query<AttachmentRow>(
        `SELECT id, message_id, file_name, ext, size_bytes, storage_key, public_url, created_at
         FROM attachments
         WHERE message_id IN (${msgPlaceholders})
         ORDER BY created_at ASC`,
        msgIds
      ),
    ]);
  }

  const versionsByMsg = new Map<string, StoredMessageVersion[]>();
  for (const v of versionRows) {
    const { searchSources, meta } = unpackSearchSourcesAndMeta(v.search_sources_json);
    const list = versionsByMsg.get(v.message_id) || [];
    list.push({
      content: v.content,
      ...(v.reasoning !== null ? { reasoning: v.reasoning } : {}),
      ...(v.reasoning_duration !== null ? { reasoningDuration: v.reasoning_duration } : {}),
      versionIndex: v.version_index,
      ...(searchSources !== undefined ? { searchSources } : {}),
      ...(v.generation_mode ? { generationMode: v.generation_mode } : {}),
      ...meta,
    });
    versionsByMsg.set(v.message_id, list);
  }

  const attachmentsByMsg = new Map<string, StoredAttachment[]>();
  for (const a of attachmentRows) {
    const list = attachmentsByMsg.get(a.message_id) || [];
    const isDataUrl = a.public_url.startsWith('data:');
    list.push({
      name: a.file_name,
      ...(a.ext ? { ext: a.ext } : {}),
      ...(a.size_bytes !== null ? { size: a.size_bytes } : {}),
      ...(isDataUrl ? { dataUrl: a.public_url } : a.public_url ? { previewUrl: a.public_url } : {}),
    });
    attachmentsByMsg.set(a.message_id, list);
  }

  const messagesByChat = new Map<string, StoredMessage[]>();
  for (const m of messageRows) {
    const versions = versionsByMsg.get(m.id) || [];
    const activeVersion =
      versions[Math.min(Math.max(m.current_version_index, 0), Math.max(0, versions.length - 1))] ||
      versions[0];
    const attachedFiles = attachmentsByMsg.get(m.id);

    const msg: StoredMessage = {
      id: m.id,
      chatId: m.chat_id,
      role: m.role,
      chatIndex: m.chat_index,
      currentVersionIndex: m.current_version_index,
      createdAt: m.created_at,
      content: activeVersion?.content ?? '',
      ...(activeVersion?.reasoning !== undefined ? { reasoning: activeVersion.reasoning } : {}),
      ...(activeVersion?.reasoningDuration !== undefined
        ? { reasoningDuration: activeVersion.reasoningDuration }
        : {}),
      ...(activeVersion?.searchSources !== undefined
        ? { searchSources: activeVersion.searchSources }
        : {}),
      ...(activeVersion?.readSources !== undefined ? { readSources: activeVersion.readSources } : {}),
      ...(activeVersion?.thinkingSteps !== undefined
        ? { thinkingSteps: activeVersion.thinkingSteps }
        : {}),
      ...(activeVersion?.searchStatus !== undefined
        ? { searchStatus: activeVersion.searchStatus }
        : {}),
      ...(activeVersion?.clarification !== undefined
        ? { clarification: activeVersion.clarification }
        : {}),
      ...(activeVersion?.clarificationAnswer !== undefined
        ? { clarificationAnswer: activeVersion.clarificationAnswer }
        : {}),
      ...(activeVersion?.generationMode !== undefined
        ? { generationMode: activeVersion.generationMode }
        : {}),
      ...(activeVersion?.imageAspectRatio !== undefined
        ? { imageAspectRatio: activeVersion.imageAspectRatio }
        : {}),
      ...(activeVersion?.isError !== undefined ? { isError: activeVersion.isError } : {}),
      ...(activeVersion?.isStopped !== undefined ? { isStopped: activeVersion.isStopped } : {}),
      ...(activeVersion?.memoriesSaved !== undefined
        ? { memoriesSaved: activeVersion.memoriesSaved }
        : {}),
      ...(activeVersion?.memoriesSavedCount !== undefined
        ? { memoriesSavedCount: activeVersion.memoriesSavedCount }
        : {}),
      ...(versions.length > 0 ? { versions } : {}),
      ...(attachedFiles && attachedFiles.length > 0 ? { attachedFiles } : {}),
    };

    const list = messagesByChat.get(m.chat_id) || [];
    list.push(msg);
    messagesByChat.set(m.chat_id, list);
  }

  return rows.map(row => ({
    id: row.id,
    title: row.title || 'New Chat',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    folder: row.folder || undefined,
    tags: parseJsonSafe<string[]>(row.tags_json, []),
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    isShared: Boolean(row.is_shared),
    shareId: row.share_id || undefined,
    messages: messagesByChat.get(row.id) || [],
  }));
}

export async function listAccountChatSummaries(
  pool: DbPool,
  accountId: string,
  archived = false
): Promise<StoredChat[]> {
  const rows = await pool.query<ChatRow>(
    `SELECT id, account_id, title, folder, tags_json, pinned, archived, is_shared, share_id, created_at, updated_at
     FROM chats
     WHERE account_id = ? AND archived = ?
     ORDER BY pinned DESC, updated_at DESC, created_at DESC`,
    [accountId, archived ? 1 : 0]
  );
  return rows.map(row => ({
    id: row.id,
    title: row.title || 'New Chat',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    folder: row.folder || undefined,
    tags: parseJsonSafe<string[]>(row.tags_json, []),
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    isShared: Boolean(row.is_shared),
    shareId: row.share_id || undefined,
    messages: [],
  }));
}

export async function listAccountChats(
  pool: DbPool,
  accountId: string,
  archived = false
): Promise<StoredChat[]> {
  const rows = await pool.query<ChatRow>(
    `SELECT id, account_id, title, folder, tags_json, pinned, archived, is_shared, share_id, created_at, updated_at
     FROM chats
     WHERE account_id = ? AND archived = ?
     ORDER BY pinned DESC, updated_at DESC, created_at DESC`,
    [accountId, archived ? 1 : 0]
  );
  return hydrateChats(pool, rows);
}

export async function listAccountSharedLinks(pool: DbPool, accountId: string) {
  const chats = await pool.query<ChatRow>(
    `SELECT id, account_id, title, folder, tags_json, pinned, archived, is_shared, share_id, created_at, updated_at
     FROM chats
     WHERE account_id = ? AND share_id IS NOT NULL AND share_id != ''
     ORDER BY updated_at DESC`,
    [accountId]
  );
  const hydrated = await hydrateChats(pool, chats);
  return hydrated.map(c => ({
    id: c.id || '',
    shareId: String(c.shareId || ''),
    title: c.title || 'New Chat',
    createdAt: c.createdAt || new Date().toISOString(),
    messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
  }));
}

export async function getAccountChat(
  pool: DbPool,
  accountId: string,
  chatId: string
): Promise<StoredChat | null> {
  const rows = await pool.query<ChatRow>(
    `SELECT id, account_id, title, folder, tags_json, pinned, archived, is_shared, share_id, created_at, updated_at
     FROM chats
     WHERE id = ? AND account_id = ?
     LIMIT 1`,
    [chatId, accountId]
  );
  if (rows.length === 0) return null;
  const hydrated = await hydrateChats(pool, rows);
  return hydrated[0] || null;
}

export async function getSharedAccountChat(
  pool: DbPool,
  shareId: string
): Promise<StoredChat | null> {
  const rows = await pool.query<ChatRow>(
    `SELECT id, account_id, title, folder, tags_json, pinned, archived, is_shared, share_id, created_at, updated_at
     FROM chats
     WHERE share_id = ? AND is_shared = 1
     LIMIT 1`,
    [shareId]
  );
  if (rows.length === 0) return null;
  const hydrated = await hydrateChats(pool, rows);
  const chat = hydrated[0];
  if (!chat) return null;

  const ownerRows = await pool.query<{
    id: string;
    display_name: string;
    avatar_url: string | null;
    plan: string;
    role: string | null;
  }>(
    'SELECT id, display_name, avatar_url, plan, role FROM accounts WHERE id = ? LIMIT 1',
    [rows[0].account_id]
  );
  const owner = ownerRows[0];
  if (owner) {
    const ownerRole = (owner.role || '').trim().toLowerCase();
    const isStaff = ownerRole === 'staff' || ownerRole === 'manager_staff';
    chat.ownerProfile = {
      id: owner.id,
      name: owner.display_name,
      avatar: owner.avatar_url || '',
      plan: isStaff ? 'staff' : owner.plan || 'free'
    };
  }

  return chat;
}

export async function createAccountChat(
  pool: DbPool,
  accountId: string,
  input: { id?: string; title?: string; attachedFiles?: StoredAttachment[] }
): Promise<StoredChat> {
  const id = input.id?.trim() || `c_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const title = (input.title || 'New Chat').trim().slice(0, 200) || 'New Chat';
  const nowIso = new Date().toISOString();

  await pool.exec(
    `INSERT INTO chats (id, account_id, title, folder, tags_json, pinned, archived, is_shared, share_id, created_at, updated_at)
     VALUES (?, ?, ?, NULL, '[]', 0, 0, 0, NULL, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [id, accountId, title, nowIso, nowIso]
  );

  return {
    id,
    title,
    createdAt: nowIso,
    updatedAt: nowIso,
    archived: false,
    isShared: false,
    pinned: false,
    messages: [],
    pendingAttachedFiles: input.attachedFiles || [],
    tags: [],
  };
}

export async function updateAccountChat(
  pool: DbPool,
  accountId: string,
  chatId: string,
  updates: Partial<StoredChat>
): Promise<StoredChat | null> {
  const existing = await pool.query<ChatRow>(
    `SELECT id, account_id, title, folder, tags_json, pinned, archived, is_shared, share_id, created_at, updated_at
     FROM chats
     WHERE id = ? AND account_id = ?
     LIMIT 1`,
    [chatId, accountId]
  );
  if (existing.length === 0) return null;

  const cur = existing[0];
  const nextTitle =
    typeof updates.title === 'string' ? updates.title.trim().slice(0, 200) || 'New Chat' : cur.title;
  const nextFolder = updates.folder !== undefined ? updates.folder || null : cur.folder;
  const nextTagsJson =
    updates.tags !== undefined ? JSON.stringify(Array.isArray(updates.tags) ? updates.tags : []) : cur.tags_json;
  const nextPinned = updates.pinned !== undefined ? (updates.pinned ? 1 : 0) : cur.pinned;
  const nextArchived = updates.archived !== undefined ? (updates.archived ? 1 : 0) : cur.archived;
  const nextIsShared = updates.isShared !== undefined ? (updates.isShared ? 1 : 0) : cur.is_shared;
  const nextShareId =
    updates.shareId !== undefined
      ? typeof updates.shareId === 'string' && updates.shareId
        ? updates.shareId
        : null
      : cur.share_id;
  const nowIso = new Date().toISOString();

  await pool.exec(
    `UPDATE chats
     SET title = ?, folder = ?, tags_json = ?, pinned = ?, archived = ?, is_shared = ?, share_id = ?, updated_at = ?
     WHERE id = ? AND account_id = ?`,
    [
      nextTitle,
      nextFolder,
      nextTagsJson,
      nextPinned,
      nextArchived,
      nextIsShared,
      nextShareId,
      nowIso,
      chatId,
      accountId,
    ]
  );

  return getAccountChat(pool, accountId, chatId);
}

export async function saveAccountMessage(
  pool: DbPool,
  accountId: string,
  chatId: string,
  message: StoredMessage
): Promise<void> {
  const nowIso = new Date().toISOString();
  const msgId =
    typeof message.id === 'string' && message.id
      ? message.id
      : `m_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const role = typeof message.role === 'string' ? message.role : 'user';

  // Make sure the parent chat actually exists for this account before saving messages
  const chatCheck = await pool.query<{ id: string }>(
    'SELECT id FROM chats WHERE id = ? AND account_id = ? LIMIT 1',
    [chatId, accountId]
  );
  if (chatCheck.length === 0) {
    await createAccountChat(pool, accountId, {
      id: chatId,
      title:
        role === 'user' && typeof message.content === 'string'
          ? message.content.trim().slice(0, 60) || 'New Chat'
          : 'New Chat',
    });
  }

  const existingMsg = await pool.query<{ id: string; chat_index: number }>(
    'SELECT id, chat_index FROM messages WHERE id = ? AND chat_id = ? LIMIT 1',
    [msgId, chatId]
  );

  let chatIndex =
    typeof message.chatIndex === 'number' && Number.isFinite(message.chatIndex)
      ? message.chatIndex
      : existingMsg[0]?.chat_index;

  if (chatIndex === undefined) {
    const countRows = await pool.query<{ max_idx: number | null }>(
      'SELECT MAX(chat_index) AS max_idx FROM messages WHERE chat_id = ?',
      [chatId]
    );
    chatIndex = (countRows[0]?.max_idx ?? -1) + 1;
  }

  const currentVersionIndex =
    typeof message.currentVersionIndex === 'number' && Number.isFinite(message.currentVersionIndex)
      ? message.currentVersionIndex
      : 0;
  const createdAt =
    typeof message.createdAt === 'string' && message.createdAt ? message.createdAt : nowIso;

  await pool.exec(
    `INSERT INTO messages (id, chat_id, role, chat_index, current_version_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       role = excluded.role,
       chat_index = excluded.chat_index,
       current_version_index = excluded.current_version_index`,
    [msgId, chatId, role, chatIndex, currentVersionIndex, createdAt]
  );

  // Wipe and rewrite versions so edits and regenerations don't leave stale garbage behind
  await pool.exec('DELETE FROM message_versions WHERE message_id = ?', [msgId]);

  const versions: StoredMessageVersion[] =
    Array.isArray(message.versions) && message.versions.length > 0
      ? message.versions
      : [
          {
            content: message.content ?? '',
            reasoning: message.reasoning,
            reasoningDuration: message.reasoningDuration,
            versionIndex: 0,
            searchSources: message.searchSources,
            readSources: message.readSources,
            thinkingSteps: message.thinkingSteps,
            searchStatus: message.searchStatus,
            clarification: message.clarification,
            clarificationAnswer: message.clarificationAnswer,
            generationMode: message.generationMode,
            imageAspectRatio: message.imageAspectRatio,
            isError: message.isError,
            isStopped: message.isStopped,
            memoriesSaved: message.memoriesSaved,
            memoriesSavedCount: message.memoriesSavedCount,
          },
        ];

  for (let i = 0; i < versions.length; i += 1) {
    const v = versions[i];
    const vIndex = typeof v.versionIndex === 'number' ? v.versionIndex : i;
    const isActive = i === currentVersionIndex || versions.length === 1;
    const packed = packSearchSourcesAndMeta(v.searchSources ?? (isActive ? message.searchSources : undefined), {
      readSources: v.readSources ?? (isActive ? message.readSources : undefined),
      thinkingSteps: v.thinkingSteps ?? (isActive ? message.thinkingSteps : undefined),
      searchStatus: v.searchStatus ?? (isActive ? message.searchStatus : undefined),
      clarification: v.clarification ?? (isActive ? message.clarification : undefined),
      clarificationAnswer: v.clarificationAnswer ?? (isActive ? message.clarificationAnswer : undefined),
      imageAspectRatio: v.imageAspectRatio ?? (isActive ? message.imageAspectRatio : undefined),
      isError: v.isError ?? (isActive ? message.isError : undefined),
      isStopped: v.isStopped ?? (isActive ? message.isStopped : undefined),
      memoriesSaved: v.memoriesSaved ?? (isActive ? message.memoriesSaved : undefined),
      memoriesSavedCount: v.memoriesSavedCount ?? (isActive ? message.memoriesSavedCount : undefined),
    });

    await pool.exec(
      `INSERT INTO message_versions (id, message_id, version_index, content, reasoning, reasoning_duration, search_sources_json, generation_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${msgId}_v${i}`,
        msgId,
        vIndex,
        typeof v.content === 'string' ? v.content : String(v.content ?? ''),
        typeof v.reasoning === 'string' ? v.reasoning : null,
        typeof v.reasoningDuration === 'number' ? v.reasoningDuration : null,
        packed,
        typeof v.generationMode === 'string' ? v.generationMode : null,
      ]
    );
  }

  if (Array.isArray(message.attachedFiles) && message.attachedFiles.length > 0) {
    await pool.exec('DELETE FROM attachments WHERE message_id = ?', [msgId]);
    for (let i = 0; i < message.attachedFiles.length; i += 1) {
      const att = message.attachedFiles[i];
      const fileName = typeof att.name === 'string' ? att.name : `file-${i + 1}`;
      const ext = typeof att.ext === 'string' ? att.ext : null;
      const sizeBytes = typeof att.size === 'number' ? att.size : null;
      const url =
        typeof att.previewUrl === 'string' && att.previewUrl
          ? att.previewUrl
          : typeof att.dataUrl === 'string' && att.dataUrl
            ? att.dataUrl
            : '';
      await pool.exec(
        `INSERT INTO attachments (id, message_id, file_name, ext, size_bytes, storage_key, public_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`${msgId}_att_${i}`, msgId, fileName, ext, sizeBytes, '', url, nowIso]
      );
    }
  }

  await pool.exec('UPDATE chats SET updated_at = ? WHERE id = ? AND account_id = ?', [
    nowIso,
    chatId,
    accountId,
  ]);
}

export async function deleteAccountChat(
  pool: DbPool,
  accountId: string,
  chatId: string
): Promise<boolean> {
  const res = await pool.exec('DELETE FROM chats WHERE id = ? AND account_id = ?', [
    chatId,
    accountId,
  ]);
  return res.changes > 0;
}

export async function deleteAllAccountChats(pool: DbPool, accountId: string): Promise<void> {
  await pool.exec('DELETE FROM chats WHERE account_id = ?', [accountId]);
}
