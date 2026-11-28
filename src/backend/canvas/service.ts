import crypto from 'node:crypto';
import type { DbPool } from '@/backend/db/connection';
import { deleteFromR2, isR2Configured, uploadToR2 } from '@/backend/storage/r2';
import {
  getMimeTypeForCanvasFile,
  inferCanvasKind,
  inferCodeLanguage,
  normalizeCanvasPath,
  type CanvasFile,
  type CanvasFileKind,
  type CanvasWorkspaceRecord,
} from '@/lib/canvas/types';

const MAX_WORKSPACE_FILES = 30;
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_BINARY_FILE_BYTES = 10 * 1024 * 1024;

interface WorkspaceRow {
  chat_id: string;
  account_id: string;
  title: string;
  active_file_path: string | null;
  updated_at: string;
}

interface WorkspaceFileRow {
  id: string;
  chat_id: string;
  account_id: string;
  path: string;
  kind: string;
  mime_type: string;
  content_text: string | null;
  r2_key: string | null;
  public_url: string | null;
  size_bytes: number;
  updated_at: string;
}

export interface SaveWorkspaceFileInput {
  id?: string;
  path: string;
  kind?: CanvasFileKind;
  mimeType?: string;
  content?: string;
  r2Key?: string;
  publicUrl?: string;
  sizeBytes?: number;
}

export interface SaveWorkspaceInput {
  title?: string;
  activeFilePath?: string | null;
  files: SaveWorkspaceFileInput[];
}

async function assertChatOwnership(pool: DbPool, accountId: string, chatId: string): Promise<boolean> {
  const rows = await pool.query<{ id: string }>(
    'SELECT id FROM chats WHERE id = ? AND account_id = ? LIMIT 1',
    [chatId, accountId]
  );
  return rows.length > 0;
}

function mapFileRow(row: WorkspaceFileRow): CanvasFile {
  const kind = inferCanvasKind(row.path, row.kind);
  return {
    id: row.id,
    path: row.path,
    kind,
    language: kind === 'code' ? inferCodeLanguage(row.path) : undefined,
    mimeType: row.mime_type || getMimeTypeForCanvasFile(row.path, kind),
    content: row.content_text ?? '',
    ...(row.r2_key ? { r2Key: row.r2_key } : {}),
    ...(row.public_url ? { publicUrl: row.public_url } : {}),
    sizeBytes: Number(row.size_bytes || 0),
    updatedAt: row.updated_at,
  };
}

export async function getAccountWorkspace(
  pool: DbPool,
  accountId: string,
  chatId: string
): Promise<CanvasWorkspaceRecord | null> {
  const owns = await assertChatOwnership(pool, accountId, chatId);
  if (!owns) return null;

  const wsRows = await pool.query<WorkspaceRow>(
    `SELECT chat_id, account_id, title, active_file_path, updated_at
     FROM chat_workspaces
     WHERE chat_id = ? AND account_id = ?
     LIMIT 1`,
    [chatId, accountId]
  );

  if (wsRows.length === 0) {
    return {
      chatId,
      title: 'Workspace',
      activeFilePath: null,
      files: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const fileRows = await pool.query<WorkspaceFileRow>(
    `SELECT id, chat_id, account_id, path, kind, mime_type, content_text, r2_key, public_url, size_bytes, updated_at
     FROM workspace_files
     WHERE chat_id = ? AND account_id = ?
     ORDER BY updated_at ASC, path ASC`,
    [chatId, accountId]
  );

  const ws = wsRows[0];
  return {
    chatId: ws.chat_id,
    title: ws.title || 'Workspace',
    activeFilePath: ws.active_file_path || null,
    files: fileRows.map(mapFileRow),
    updatedAt: ws.updated_at,
  };
}

export async function saveAccountWorkspace(
  pool: DbPool,
  accountId: string,
  chatId: string,
  input: SaveWorkspaceInput
): Promise<CanvasWorkspaceRecord | null> {
  const owns = await assertChatOwnership(pool, accountId, chatId);
  if (!owns) return null;

  if (!Array.isArray(input.files)) {
    throw new Error('files must be an array.');
  }
  if (input.files.length > MAX_WORKSPACE_FILES) {
    throw new Error(`Workspace is limited to ${MAX_WORKSPACE_FILES} files.`);
  }

  const nowIso = new Date().toISOString();
  const title = (typeof input.title === 'string' ? input.title.trim() : '').slice(0, 140) || 'Workspace';

  const normalizedFiles: Array<{
    id: string;
    path: string;
    kind: CanvasFileKind;
    mimeType: string;
    contentText: string;
    r2Key: string | null;
    publicUrl: string | null;
    sizeBytes: number;
  }> = [];
  const seenPaths = new Set<string>();

  for (const raw of input.files) {
    const cleanPath = normalizeCanvasPath(raw?.path || '');
    if (!cleanPath) {
      throw new Error(`Invalid workspace file path: ${String(raw?.path ?? '')}`);
    }
    if (seenPaths.has(cleanPath)) continue;
    seenPaths.add(cleanPath);

    const contentText = typeof raw.content === 'string' ? raw.content : '';
    const textBytes = Buffer.byteLength(contentText, 'utf8');
    if (textBytes > MAX_TEXT_FILE_BYTES) {
      throw new Error(`File ${cleanPath} exceeds 2MB text limit.`);
    }

    const kind = inferCanvasKind(cleanPath, raw.kind);
    const mimeType =
      typeof raw.mimeType === 'string' && raw.mimeType.trim()
        ? raw.mimeType.trim().slice(0, 120)
        : getMimeTypeForCanvasFile(cleanPath, kind);
    const r2Key = typeof raw.r2Key === 'string' && raw.r2Key.trim() ? raw.r2Key.trim() : null;
    const publicUrl =
      typeof raw.publicUrl === 'string' && raw.publicUrl.trim() ? raw.publicUrl.trim() : null;
    const sizeBytes =
      typeof raw.sizeBytes === 'number' && Number.isFinite(raw.sizeBytes) && raw.sizeBytes >= 0
        ? Math.round(raw.sizeBytes)
        : textBytes;

    normalizedFiles.push({
      id:
        typeof raw.id === 'string' && raw.id.trim()
          ? raw.id.trim().slice(0, 80)
          : `wf_${crypto.randomBytes(6).toString('hex')}`,
      path: cleanPath,
      kind,
      mimeType,
      contentText,
      r2Key,
      publicUrl,
      sizeBytes,
    });
  }

  const normalizedActive = input.activeFilePath ? normalizeCanvasPath(input.activeFilePath) : null;
  const activeFilePath =
    normalizedActive && seenPaths.has(normalizedActive)
      ? normalizedActive
      : normalizedFiles[0]?.path ?? null;

  await pool.exec(
    `INSERT INTO chat_workspaces (chat_id, account_id, title, active_file_path, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET
       title = excluded.title,
       active_file_path = excluded.active_file_path,
       updated_at = excluded.updated_at`,
    [chatId, accountId, title, activeFilePath, nowIso]
  );

  const existingRows = await pool.query<{ path: string; r2_key: string | null }>(
    'SELECT path, r2_key FROM workspace_files WHERE chat_id = ? AND account_id = ?',
    [chatId, accountId]
  );

  for (const row of existingRows) {
    if (!seenPaths.has(row.path)) {
      await pool.exec(
        'DELETE FROM workspace_files WHERE chat_id = ? AND account_id = ? AND path = ?',
        [chatId, accountId, row.path]
      );
      if (row.r2_key && isR2Configured()) {
        await deleteFromR2(row.r2_key).catch(() => undefined);
      }
    }
  }

  for (const file of normalizedFiles) {
    await pool.exec(
      `INSERT INTO workspace_files (id, chat_id, account_id, path, kind, mime_type, content_text, r2_key, public_url, size_bytes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(chat_id, path) DO UPDATE SET
         kind = excluded.kind,
         mime_type = excluded.mime_type,
         content_text = excluded.content_text,
         r2_key = excluded.r2_key,
         public_url = excluded.public_url,
         size_bytes = excluded.size_bytes,
         updated_at = excluded.updated_at`,
      [
        file.id,
        chatId,
        accountId,
        file.path,
        file.kind,
        file.mimeType,
        file.contentText,
        file.r2Key,
        file.publicUrl,
        file.sizeBytes,
        nowIso,
      ]
    );
  }

  return getAccountWorkspace(pool, accountId, chatId);
}

export async function uploadWorkspaceBinary(
  pool: DbPool,
  accountId: string,
  chatId: string,
  fileName: string,
  mimeType: string,
  bytes: Uint8Array
): Promise<{ r2Key: string; publicUrl: string; sizeBytes: number } | null> {
  const owns = await assertChatOwnership(pool, accountId, chatId);
  if (!owns) return null;

  if (bytes.byteLength > MAX_BINARY_FILE_BYTES) {
    throw new Error('File exceeds 10MB workspace binary upload limit.');
  }
  if (!isR2Configured()) {
    throw new Error('Object storage is not configured.');
  }

  const safeName = (normalizeCanvasPath(fileName) || 'document.bin').replace(/\//g, '_');
  const key = `workspaces/${accountId}/${chatId}/${Date.now()}-${safeName}`;
  const uploaded = await uploadToR2({
    key,
    body: bytes,
    contentType: mimeType || 'application/octet-stream',
  });

  return {
    r2Key: uploaded.key,
    publicUrl: uploaded.url,
    sizeBytes: bytes.byteLength,
  };
}

export async function deleteAccountWorkspace(
  pool: DbPool,
  accountId: string,
  chatId: string
): Promise<boolean> {
  const owns = await assertChatOwnership(pool, accountId, chatId);
  if (!owns) return false;

  if (isR2Configured()) {
    const r2Rows = await pool.query<{ r2_key: string | null }>(
      'SELECT r2_key FROM workspace_files WHERE chat_id = ? AND account_id = ? AND r2_key IS NOT NULL',
      [chatId, accountId]
    );
    await Promise.all(
      r2Rows
        .map((r) => r.r2_key)
        .filter((k): k is string => Boolean(k))
        .map((k) => deleteFromR2(k).catch(() => undefined))
    );
  }

  const res = await pool.exec(
    'DELETE FROM chat_workspaces WHERE chat_id = ? AND account_id = ?',
    [chatId, accountId]
  );
  return res.changes > 0;
}
