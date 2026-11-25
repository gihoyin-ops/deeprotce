import crypto from 'node:crypto';
import type { DbPool } from '@/backend/db/connection';
import { deleteFromR2, isR2Configured } from '@/backend/storage/r2';

export const MAX_USER_STORAGE_BYTES = 256 * 1024 * 1024; // 256 MB per user
export const TRASH_RETENTION_MS = 48 * 60 * 60 * 1000; // 2 days auto-purge

export interface LibraryFolderRow {
  id: string;
  account_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface LibraryItemRow {
  id: string;
  account_id: string;
  folder_id: string | null;
  r2_key: string;
  url: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  source: string;
  is_favorite: number;
  metadata_json: string | null;
  trashed_at: number | null;
  created_at: string;
  updated_at: string;
}

export interface LibraryItemDto {
  id: string;
  folderId: string | null;
  r2Key: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  source: 'upload' | 'generated' | 'profile';
  isFavorite: boolean;
  metadata: Record<string, unknown> | null;
  trashedAt: number | null;
  purgeAt: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryFolderDto {
  id: string;
  name: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

const parseMetadata = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const toItemDto = (row: LibraryItemRow): LibraryItemDto => ({
  id: row.id,
  folderId: row.folder_id,
  r2Key: row.r2_key,
  url: row.url,
  fileName: row.file_name,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes) || 0,
  source:
    row.source === 'generated' ? 'generated' : row.source === 'profile' ? 'profile' : 'upload',
  isFavorite: Boolean(row.is_favorite),
  metadata: parseMetadata(row.metadata_json),
  trashedAt: row.trashed_at !== null ? Number(row.trashed_at) : null,
  purgeAt: row.trashed_at !== null ? Number(row.trashed_at) + TRASH_RETENTION_MS : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const cleanupExpiredTrash = async (pool: DbPool, accountId: string): Promise<number> => {
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  const expired = await pool.query<{ id: string; r2_key: string }>(
    'SELECT id, r2_key FROM library_items WHERE account_id = ? AND trashed_at IS NOT NULL AND trashed_at <= ?',
    [accountId, cutoff]
  );

  if (expired.length === 0) return 0;

  if (isR2Configured()) {
    await Promise.all(
      expired.map(row => deleteFromR2(row.r2_key).catch(() => undefined))
    );
  }

  for (const row of expired) {
    await pool.exec('DELETE FROM library_items WHERE id = ? AND account_id = ?', [
      row.id,
      accountId
    ]);
  }

  return expired.length;
};

export const getAccountStorageUsageBytes = async (
  pool: DbPool,
  accountId: string
): Promise<number> => {
  const rows = await pool.query<{ total: number }>(
    'SELECT COALESCE(SUM(size_bytes), 0) AS total FROM library_items WHERE account_id = ?',
    [accountId]
  );
  return Number(rows[0]?.total) || 0;
};

export const checkAccountStorageQuota = async (
  pool: DbPool,
  accountId: string,
  incomingBytes: number
): Promise<{ allowed: boolean; usedBytes: number; limitBytes: number }> => {
  await cleanupExpiredTrash(pool, accountId).catch(() => 0);
  const usedBytes = await getAccountStorageUsageBytes(pool, accountId);
  return {
    allowed: usedBytes + Math.max(0, incomingBytes) <= MAX_USER_STORAGE_BYTES,
    usedBytes,
    limitBytes: MAX_USER_STORAGE_BYTES
  };
};

export const registerLibraryItem = async (
  pool: DbPool,
  params: {
    accountId: string;
    folderId?: string | null;
    r2Key: string;
    url: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    source: 'upload' | 'generated' | 'profile';
    metadata?: Record<string, unknown> | null;
  }
): Promise<LibraryItemDto> => {
  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const metadataJson = params.metadata ? JSON.stringify(params.metadata) : null;

  await pool.exec(
    `INSERT INTO library_items (
      id, account_id, folder_id, r2_key, url, file_name, mime_type,
      size_bytes, source, is_favorite, metadata_json, trashed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?, ?)`,
    [
      id,
      params.accountId,
      params.folderId || null,
      params.r2Key,
      params.url,
      params.fileName,
      params.mimeType,
      Math.max(0, Math.round(params.sizeBytes)),
      params.source,
      metadataJson,
      nowIso,
      nowIso
    ]
  );

  return {
    id,
    folderId: params.folderId || null,
    r2Key: params.r2Key,
    url: params.url,
    fileName: params.fileName,
    mimeType: params.mimeType,
    sizeBytes: Math.max(0, Math.round(params.sizeBytes)),
    source: params.source,
    isFavorite: false,
    metadata: params.metadata ?? null,
    trashedAt: null,
    purgeAt: null,
    createdAt: nowIso,
    updatedAt: nowIso
  };
};

export const listLibraryData = async (pool: DbPool, accountId: string) => {
  await cleanupExpiredTrash(pool, accountId).catch(() => 0);

  const [itemRows, folderRows] = await Promise.all([
    pool.query<LibraryItemRow>(
      `SELECT id, account_id, folder_id, r2_key, url, file_name, mime_type,
              size_bytes, source, is_favorite, metadata_json, trashed_at, created_at, updated_at
       FROM library_items
       WHERE account_id = ?
       ORDER BY created_at DESC`,
      [accountId]
    ),
    pool.query<LibraryFolderRow>(
      `SELECT id, account_id, name, created_at, updated_at
       FROM library_folders
       WHERE account_id = ?
       ORDER BY name ASC`,
      [accountId]
    )
  ]);

  const items: LibraryItemDto[] = [];
  const trashedItems: LibraryItemDto[] = [];
  const folderCounts = new Map<string, number>();
  let usedBytes = 0;

  for (const row of itemRows) {
    const dto = toItemDto(row);
    usedBytes += dto.sizeBytes;
    if (dto.trashedAt !== null) {
      trashedItems.push(dto);
    } else {
      items.push(dto);
      if (dto.folderId) {
        folderCounts.set(dto.folderId, (folderCounts.get(dto.folderId) ?? 0) + 1);
      }
    }
  }

  const folders: LibraryFolderDto[] = folderRows.map(f => ({
    id: f.id,
    name: f.name,
    itemCount: folderCounts.get(f.id) ?? 0,
    createdAt: f.created_at,
    updatedAt: f.updated_at
  }));

  return {
    items,
    trashedItems,
    folders,
    storage: {
      usedBytes,
      limitBytes: MAX_USER_STORAGE_BYTES
    }
  };
};

export const createLibraryFolder = async (
  pool: DbPool,
  accountId: string,
  name: string
): Promise<LibraryFolderDto> => {
  const cleanName = name.trim().slice(0, 64);
  if (!cleanName) throw new Error('Folder name cannot be empty.');
  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  await pool.exec(
    'INSERT INTO library_folders (id, account_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, accountId, cleanName, nowIso, nowIso]
  );
  return { id, name: cleanName, itemCount: 0, createdAt: nowIso, updatedAt: nowIso };
};

export const renameLibraryFolder = async (
  pool: DbPool,
  accountId: string,
  folderId: string,
  name: string
): Promise<void> => {
  const cleanName = name.trim().slice(0, 64);
  if (!cleanName) throw new Error('Folder name cannot be empty.');
  await pool.exec(
    'UPDATE library_folders SET name = ?, updated_at = ? WHERE id = ? AND account_id = ?',
    [cleanName, new Date().toISOString(), folderId, accountId]
  );
};

export const deleteLibraryFolder = async (
  pool: DbPool,
  accountId: string,
  folderId: string
): Promise<void> => {
  const nowIso = new Date().toISOString();
  await pool.exec(
    'UPDATE library_items SET folder_id = NULL, updated_at = ? WHERE folder_id = ? AND account_id = ?',
    [nowIso, folderId, accountId]
  );
  await pool.exec('DELETE FROM library_folders WHERE id = ? AND account_id = ?', [
    folderId,
    accountId
  ]);
};

export const setItemsFavorite = async (
  pool: DbPool,
  accountId: string,
  itemIds: string[],
  isFavorite: boolean
): Promise<void> => {
  const nowIso = new Date().toISOString();
  const val = isFavorite ? 1 : 0;
  for (const id of itemIds) {
    await pool.exec(
      'UPDATE library_items SET is_favorite = ?, updated_at = ? WHERE id = ? AND account_id = ?',
      [val, nowIso, id, accountId]
    );
  }
};

export const moveItemsToFolder = async (
  pool: DbPool,
  accountId: string,
  itemIds: string[],
  folderId: string | null
): Promise<void> => {
  const nowIso = new Date().toISOString();
  for (const id of itemIds) {
    await pool.exec(
      'UPDATE library_items SET folder_id = ?, updated_at = ? WHERE id = ? AND account_id = ?',
      [folderId, nowIso, id, accountId]
    );
  }
};

export const trashLibraryItems = async (
  pool: DbPool,
  accountId: string,
  itemIds: string[]
): Promise<void> => {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  for (const id of itemIds) {
    await pool.exec(
      'UPDATE library_items SET trashed_at = ?, updated_at = ? WHERE id = ? AND account_id = ?',
      [now, nowIso, id, accountId]
    );
  }
};

export const restoreLibraryItems = async (
  pool: DbPool,
  accountId: string,
  itemIds: string[]
): Promise<void> => {
  const nowIso = new Date().toISOString();
  for (const id of itemIds) {
    await pool.exec(
      'UPDATE library_items SET trashed_at = NULL, updated_at = ? WHERE id = ? AND account_id = ?',
      [nowIso, id, accountId]
    );
  }
};

export const permanentlyDeleteLibraryItems = async (
  pool: DbPool,
  accountId: string,
  itemIds: string[]
): Promise<void> => {
  for (const id of itemIds) {
    const rows = await pool.query<{ r2_key: string }>(
      'SELECT r2_key FROM library_items WHERE id = ? AND account_id = ? LIMIT 1',
      [id, accountId]
    );
    const key = rows[0]?.r2_key;
    if (key && isR2Configured()) {
      await deleteFromR2(key).catch(() => undefined);
    }
    await pool.exec('DELETE FROM library_items WHERE id = ? AND account_id = ?', [id, accountId]);
  }
};

export const emptyLibraryTrash = async (pool: DbPool, accountId: string): Promise<void> => {
  const trashed = await pool.query<{ id: string; r2_key: string }>(
    'SELECT id, r2_key FROM library_items WHERE account_id = ? AND trashed_at IS NOT NULL',
    [accountId]
  );
  if (isR2Configured()) {
    await Promise.all(trashed.map(r => deleteFromR2(r.r2_key).catch(() => undefined)));
  }
  await pool.exec('DELETE FROM library_items WHERE account_id = ? AND trashed_at IS NOT NULL', [
    accountId
  ]);
};
