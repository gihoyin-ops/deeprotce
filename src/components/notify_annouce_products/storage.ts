interface StoredAnnouncementState {
  views: number;
  dismissed: boolean;
  lastSeenAt: number;
}

const STORAGE_PREFIX = 'deepchat-product-announcement';
const DEDUPE_WINDOW_MS = 2500;
const recentImpressions = new Map<string, { at: number; visible: boolean }>();

function buildStorageKey(id: string, storageVersion: number): string {
  return `${STORAGE_PREFIX}:${id}:v${storageVersion}`;
}

function parseStoredState(raw: string | null): StoredAnnouncementState {
  if (!raw) {
    return { views: 0, dismissed: false, lastSeenAt: 0 };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { views: 0, dismissed: false, lastSeenAt: 0 };
    }
    const record = parsed as Record<string, unknown>;
    const views =
      typeof record.views === 'number' && Number.isFinite(record.views) && record.views >= 0
        ? Math.floor(record.views)
        : 0;
    const dismissed = record.dismissed === true;
    const lastSeenAt =
      typeof record.lastSeenAt === 'number' && Number.isFinite(record.lastSeenAt)
        ? record.lastSeenAt
        : 0;
    return { views, dismissed, lastSeenAt };
  } catch {
    return { views: 0, dismissed: false, lastSeenAt: 0 };
  }
}

export function consumeProductAnnouncementImpression(
  id: string,
  storageVersion: number,
  maxViews: number
): boolean {
  if (typeof window === 'undefined' || maxViews <= 0) {
    return false;
  }

  const key = buildStorageKey(id, storageVersion);
  const now = Date.now();
  const cached = recentImpressions.get(key);
  if (cached && now - cached.at < DEDUPE_WINDOW_MS) {
    return cached.visible;
  }

  let current: StoredAnnouncementState = { views: 0, dismissed: false, lastSeenAt: 0 };
  try {
    current = parseStoredState(window.localStorage.getItem(key));
  } catch {
    recentImpressions.set(key, { at: now, visible: false });
    return false;
  }

  if (current.dismissed || current.views >= maxViews) {
    recentImpressions.set(key, { at: now, visible: false });
    return false;
  }

  const nextState: StoredAnnouncementState = {
    views: current.views + 1,
    dismissed: false,
    lastSeenAt: now,
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(nextState));
  } catch {
    // ignore quota or restricted storage modes
  }

  recentImpressions.set(key, { at: now, visible: true });
  return true;
}

export function dismissProductAnnouncement(
  id: string,
  storageVersion: number,
  maxViews: number
): void {
  const key = buildStorageKey(id, storageVersion);
  const now = Date.now();
  recentImpressions.set(key, { at: now, visible: false });

  if (typeof window === 'undefined') return;

  try {
    const nextState: StoredAnnouncementState = {
      views: Math.max(1, maxViews),
      dismissed: true,
      lastSeenAt: now,
    };
    window.localStorage.setItem(key, JSON.stringify(nextState));
  } catch {
    // ignore storage errors
  }
}
