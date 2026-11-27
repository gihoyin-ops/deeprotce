import type { PythonOutputFile, PythonWorkspaceInputFile } from '@/lib/code/python-runtime';

export interface CachedPythonResult {
  charts: string[];
  images: string[];
  files: PythonOutputFile[];
  stdout: string;
  stderr: string;
  error: string;
}

interface StoredCacheEntry {
  key: string;
  result: CachedPythonResult;
  updatedAt: number;
}

const DB_NAME = 'deepchat_python_cache_v1';
const STORE_NAME = 'results';
const MAX_CACHE_ENTRIES = 50;

const memoryCache = new Map<string, CachedPythonResult>();

const hashString = (input: string): string => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
};

export const computePythonCacheKey = (
  code: string,
  files: PythonWorkspaceInputFile[]
): string => {
  const fileSig = files
    .map((f) => {
      const sample = f.previewUrl || f.content?.slice(0, 128) || f.dataUrl?.slice(0, 128) || f.base64?.slice(0, 128) || '';
      const len = f.content?.length ?? f.dataUrl?.length ?? f.base64?.length ?? 0;
      return `${f.name}:${len}:${hashString(sample)}`;
    })
    .join('|');
  return `py_${code.length}_${hashString(code)}_${hashString(fileSig)}`;
};

export const getMemoryCachedPythonResult = (key: string): CachedPythonResult | null => {
  return memoryCache.get(key) ?? null;
};

const openCacheDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

export const getCachedPythonResult = async (key: string): Promise<CachedPythonResult | null> => {
  const mem = memoryCache.get(key);
  if (mem) return mem;

  const db = await openCacheDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result as StoredCacheEntry | undefined;
        if (entry?.result) {
          memoryCache.set(key, entry.result);
          resolve(entry.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

export const saveCachedPythonResult = async (
  key: string,
  result: CachedPythonResult
): Promise<void> => {
  if (result.error) return;
  memoryCache.set(key, result);

  const db = await openCacheDb();
  if (!db) return;

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({
      key,
      result,
      updatedAt: Date.now()
    } satisfies StoredCacheEntry);

    const allReq = store.getAll();
    allReq.onsuccess = () => {
      const entries = (allReq.result as StoredCacheEntry[] | undefined) ?? [];
      if (entries.length <= MAX_CACHE_ENTRIES) return;
      entries.sort((a, b) => a.updatedAt - b.updatedAt);
      const toDelete = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
      for (const item of toDelete) {
        store.delete(item.key);
      }
    };
  } catch {
    // Ignore IDB quota/storage errors
  }
};
