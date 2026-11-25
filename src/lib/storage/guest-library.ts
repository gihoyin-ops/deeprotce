'use client';

export const GUEST_STORAGE_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB local-only for guests
const GUEST_TRASH_RETENTION_MS = 48 * 60 * 60 * 1000; // 2 days auto-purge
const DB_NAME = 'deepchat-guest-library';
const DB_VERSION = 1;
const STORE_NAME = 'state';
const STATE_KEY = 'library';

export interface GuestLibraryItem {
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

export interface GuestLibraryFolder {
  id: string;
  name: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PersistedGuestLibrary {
  items: GuestLibraryItem[];
  folders: Array<Omit<GuestLibraryFolder, 'itemCount'>>;
}

const openGuestDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });

const readState = async (): Promise<PersistedGuestLibrary> => {
  try {
    const db = await openGuestDb();
    return await new Promise<PersistedGuestLibrary>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => {
        const val = req.result as PersistedGuestLibrary | undefined;
        resolve(val && Array.isArray(val.items) && Array.isArray(val.folders) ? val : { items: [], folders: [] });
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return { items: [], folders: [] };
  }
};

const writeState = async (state: PersistedGuestLibrary): Promise<void> => {
  const db = await openGuestDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(state, STATE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

const fileToDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read file'));
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const purgeExpired = (state: PersistedGuestLibrary): { next: PersistedGuestLibrary; changed: boolean } => {
  const cutoff = Date.now() - GUEST_TRASH_RETENTION_MS;
  const kept = state.items.filter(it => it.trashedAt === null || it.trashedAt > cutoff);
  return {
    next: { ...state, items: kept },
    changed: kept.length !== state.items.length
  };
};

export const listGuestLibraryData = async () => {
  const raw = await readState();
  const { next, changed } = purgeExpired(raw);
  if (changed) await writeState(next).catch(() => undefined);

  const items: GuestLibraryItem[] = [];
  const trashedItems: GuestLibraryItem[] = [];
  const folderCounts = new Map<string, number>();
  let usedBytes = 0;

  for (const item of next.items) {
    usedBytes += item.sizeBytes || 0;
    if (item.trashedAt !== null) {
      trashedItems.push(item);
    } else {
      items.push(item);
      if (item.folderId) {
        folderCounts.set(item.folderId, (folderCounts.get(item.folderId) ?? 0) + 1);
      }
    }
  }

  const folders: GuestLibraryFolder[] = next.folders
    .map(f => ({ ...f, itemCount: folderCounts.get(f.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    items,
    trashedItems,
    folders,
    storage: {
      usedBytes,
      limitBytes: GUEST_STORAGE_LIMIT_BYTES
    }
  };
};

export const uploadGuestLibraryImage = async (
  file: File,
  folderId: string | null
): Promise<GuestLibraryItem> => {
  const raw = await readState();
  const { next } = purgeExpired(raw);
  const usedBytes = next.items.reduce((sum, it) => sum + (it.sizeBytes || 0), 0);

  if (usedBytes + file.size > GUEST_STORAGE_LIMIT_BYTES) {
    throw new Error('Guest 50 MB local storage limit reached. Delete items or sign in for 256 MB cloud storage.');
  }

  const dataUrl = await fileToDataUrl(file);
  const nowIso = new Date().toISOString();
  const item: GuestLibraryItem = {
    id: crypto.randomUUID(),
    folderId,
    r2Key: '',
    url: dataUrl,
    fileName: file.name || 'image.webp',
    mimeType: file.type || 'image/webp',
    sizeBytes: file.size,
    source: 'upload',
    isFavorite: false,
    metadata: { localOnly: true, uploadedAt: nowIso },
    trashedAt: null,
    purgeAt: null,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  next.items.unshift(item);
  await writeState(next);
  return item;
};

export const runGuestLibraryAction = async (payload: {
  action: string;
  name?: string;
  folderId?: string | null;
  itemIds?: string[];
  isFavorite?: boolean;
}): Promise<void> => {
  const raw = await readState();
  const { next } = purgeExpired(raw);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const idSet = new Set(payload.itemIds ?? []);

  switch (payload.action) {
    case 'createFolder': {
      const name = String(payload.name || '').trim().slice(0, 64);
      if (!name) throw new Error('Folder name cannot be empty.');
      next.folders.push({
        id: crypto.randomUUID(),
        name,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      break;
    }
    case 'deleteFolder': {
      next.folders = next.folders.filter(f => f.id !== payload.folderId);
      next.items = next.items.map(it =>
        it.folderId === payload.folderId ? { ...it, folderId: null, updatedAt: nowIso } : it
      );
      break;
    }
    case 'favorite': {
      next.items = next.items.map(it =>
        idSet.has(it.id) ? { ...it, isFavorite: Boolean(payload.isFavorite), updatedAt: nowIso } : it
      );
      break;
    }
    case 'move': {
      next.items = next.items.map(it =>
        idSet.has(it.id) ? { ...it, folderId: payload.folderId ?? null, updatedAt: nowIso } : it
      );
      break;
    }
    case 'trash': {
      next.items = next.items.map(it =>
        idSet.has(it.id)
          ? {
              ...it,
              trashedAt: now,
              purgeAt: now + GUEST_TRASH_RETENTION_MS,
              updatedAt: nowIso
            }
          : it
      );
      break;
    }
    case 'restore': {
      next.items = next.items.map(it =>
        idSet.has(it.id) ? { ...it, trashedAt: null, purgeAt: null, updatedAt: nowIso } : it
      );
      break;
    }
    case 'deletePermanent': {
      next.items = next.items.filter(it => !idSet.has(it.id));
      break;
    }
    case 'emptyTrash': {
      next.items = next.items.filter(it => it.trashedAt === null);
      break;
    }
    default:
      throw new Error('Unsupported action.');
  }

  await writeState(next);
};
