import type { CanvasFile, CanvasWorkspaceRecord } from './types';

const CANVAS_DB_NAME = 'deepchat_canvas_db';
const CANVAS_DB_VERSION = 1;
const STORE_NAME = 'workspaces';
const MAX_LOCAL_BINARY_BYTES = 4 * 1024 * 1024;

let canvasDbPromise: Promise<IDBDatabase> | null = null;

function getCanvasIndexedDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is unavailable'));
  }
  if (!canvasDbPromise) {
    const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>();
    const req = window.indexedDB.open(CANVAS_DB_NAME, CANVAS_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'chatId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      canvasDbPromise = null;
      reject(req.error);
    };
    canvasDbPromise = promise;
  }
  return canvasDbPromise;
}

async function idbGetWorkspace(chatId: string): Promise<CanvasWorkspaceRecord | null> {
  try {
    const db = await getCanvasIndexedDB();
    const { promise, resolve, reject } = Promise.withResolvers<CanvasWorkspaceRecord | null>();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(chatId);
    req.onsuccess = () => resolve((req.result as CanvasWorkspaceRecord) ?? null);
    req.onerror = () => reject(req.error);
    return await promise;
  } catch {
    return null;
  }
}

async function idbPutWorkspace(workspace: CanvasWorkspaceRecord): Promise<void> {
  try {
    const db = await getCanvasIndexedDB();
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(workspace);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    await promise;
  } catch {
    // Ignore quota/private-mode IndexedDB errors
  }
}

export async function deleteLocalWorkspace(chatId: string): Promise<void> {
  try {
    const db = await getCanvasIndexedDB();
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(chatId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    await promise;
  } catch {}
}

export async function clearAllLocalWorkspaces(): Promise<void> {
  try {
    const db = await getCanvasIndexedDB();
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    await promise;
  } catch {}
}

function isAuthenticatedClient(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('deepchat-auth-hint') === '1';
  } catch {
    return false;
  }
}

export async function loadWorkspace(chatId: string): Promise<CanvasWorkspaceRecord> {
  const local = await idbGetWorkspace(chatId);

  if (isAuthenticatedClient()) {
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(chatId)}`, {
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace?: CanvasWorkspaceRecord };
        if (data.workspace) {
          // Merge local binaryDataUrl fallbacks if R2 wasn't available during guest/offline edits
          const mergedFiles: CanvasFile[] = data.workspace.files.map((remoteFile) => {
            const localMatch = local?.files.find((f) => f.path === remoteFile.path);
            if (!remoteFile.publicUrl && localMatch?.binaryDataUrl) {
              return { ...remoteFile, binaryDataUrl: localMatch.binaryDataUrl };
            }
            return remoteFile;
          });
          const merged: CanvasWorkspaceRecord = {
            ...data.workspace,
            files: mergedFiles,
          };
          await idbPutWorkspace(merged);
          return merged;
        }
      }
    } catch {
      // Fall back to local cache if network fails
    }
  }

  return (
    local || {
      chatId,
      title: 'Workspace',
      activeFilePath: null,
      files: [],
      updatedAt: new Date().toISOString(),
    }
  );
}

export async function saveWorkspace(workspace: CanvasWorkspaceRecord): Promise<void> {
  await idbPutWorkspace(workspace);

  if (!isAuthenticatedClient()) return;

  try {
    await fetch(`/api/workspaces/${encodeURIComponent(workspace.chatId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        title: workspace.title,
        activeFilePath: workspace.activeFilePath,
        files: workspace.files.map((f) => ({
          id: f.id,
          path: f.path,
          kind: f.kind,
          mimeType: f.mimeType,
          content: f.content,
          r2Key: f.r2Key,
          publicUrl: f.publicUrl,
          sizeBytes: f.sizeBytes,
        })),
      }),
    });
  } catch {
    // IndexedDB copy stays safe until next sync
  }
}

function readBlobAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadWorkspaceBinaryClient(
  chatId: string,
  file: File
): Promise<{ r2Key?: string; publicUrl?: string; binaryDataUrl?: string; sizeBytes: number }> {
  if (isAuthenticatedClient()) {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/workspaces/${encodeURIComponent(chatId)}`, {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      });
      if (res.ok) {
        const data = (await res.json()) as {
          r2Key?: string;
          publicUrl?: string;
          sizeBytes?: number;
        };
        if (data.publicUrl) {
          return {
            r2Key: data.r2Key,
            publicUrl: data.publicUrl,
            sizeBytes: data.sizeBytes ?? file.size,
          };
        }
      }
    } catch {
      // Fall back to local Data URL below
    }
  }

  if (file.size > MAX_LOCAL_BINARY_BYTES) {
    throw new Error('PDF exceeds 4MB local preview limit.');
  }

  const binaryDataUrl = await readBlobAsDataUrl(file);
  return {
    binaryDataUrl,
    sizeBytes: file.size,
  };
}
