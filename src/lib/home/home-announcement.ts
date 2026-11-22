export const ANNOUNCEMENT_STORAGE_KEY = 'deepchat-home-announcement-v1';
export const MAX_ANNOUNCEMENT_VIEWS = 3;

export type AnnouncementActionType = 'enable-web-search' | 'enable-image' | 'open-models';
export type AnnouncementIconKey = 'globe' | 'image' | 'brain';

export interface HomeAnnouncementItem {
  id: string;
  badge: string;
  tag: string;
  title: string;
  description: string;
  actionLabel: string;
  actionType: AnnouncementActionType;
  icon: AnnouncementIconKey;
}

export interface HomeAnnouncementState {
  views: number;
  dismissed: boolean;
  lastSeenAt: number;
}

export interface AnnouncementImpressionResult {
  visible: boolean;
  initialSlide: number;
  viewNumber: number;
}

export const HOME_ANNOUNCEMENTS: HomeAnnouncementItem[] = [
  {
    id: 'live-web-search',
    badge: 'New',
    tag: 'Web Search',
    title: 'Search the live web inside any prompt',
    description: 'Toggle live search with automatic multi-engine failover and rich source cards right in your chat.',
    actionLabel: 'Enable Search',
    actionType: 'enable-web-search',
    icon: 'globe',
  },
  {
    id: 'image-studio',
    badge: 'New',
    tag: 'Image Studio',
    title: 'Generate visuals in custom aspect ratios',
    description: 'Switch on Image mode to craft square, portrait, or widescreen scenes without leaving DeepChat.',
    actionLabel: 'Try Image Mode',
    actionType: 'enable-image',
    icon: 'image',
  },
  {
    id: 'multi-model',
    badge: 'Tip',
    tag: 'Models & Tiers',
    title: 'Switch models and reasoning depth on the fly',
    description: 'Pick fast models for quick drafts or dial up deeper reasoning tiers directly from the composer.',
    actionLabel: 'Browse Models',
    actionType: 'open-models',
    icon: 'brain',
  },
];

let lastImpressionAt = 0;
let lastImpressionResult: AnnouncementImpressionResult | null = null;

function parseStoredState(raw: string | null): HomeAnnouncementState {
  if (!raw) {
    return { views: 0, dismissed: false, lastSeenAt: 0 };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { views: 0, dismissed: false, lastSeenAt: 0 };
    }
    const record = parsed as Record<string, unknown>;
    const views = typeof record.views === 'number' && Number.isFinite(record.views) && record.views >= 0
      ? Math.floor(record.views)
      : 0;
    const dismissed = record.dismissed === true;
    const lastSeenAt = typeof record.lastSeenAt === 'number' && Number.isFinite(record.lastSeenAt)
      ? record.lastSeenAt
      : 0;
    return { views, dismissed, lastSeenAt };
  } catch {
    return { views: 0, dismissed: false, lastSeenAt: 0 };
  }
}

export function consumeHomeAnnouncementImpression(): AnnouncementImpressionResult {
  if (typeof window === 'undefined') {
    return { visible: false, initialSlide: 0, viewNumber: 0 };
  }

  const now = Date.now();
  if (lastImpressionResult && now - lastImpressionAt < 2500) {
    return lastImpressionResult;
  }

  let current: HomeAnnouncementState = { views: 0, dismissed: false, lastSeenAt: 0 };
  try {
    current = parseStoredState(window.localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY));
  } catch {
    const fallback: AnnouncementImpressionResult = { visible: false, initialSlide: 0, viewNumber: 0 };
    lastImpressionAt = now;
    lastImpressionResult = fallback;
    return fallback;
  }

  if (current.dismissed || current.views >= MAX_ANNOUNCEMENT_VIEWS) {
    const hiddenResult: AnnouncementImpressionResult = {
      visible: false,
      initialSlide: 0,
      viewNumber: current.views,
    };
    lastImpressionAt = now;
    lastImpressionResult = hiddenResult;
    return hiddenResult;
  }

  const nextViews = current.views + 1;
  const nextState: HomeAnnouncementState = {
    views: nextViews,
    dismissed: false,
    lastSeenAt: now,
  };

  try {
    window.localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // ignore storage quota or private browsing errors
  }

  const result: AnnouncementImpressionResult = {
    visible: true,
    initialSlide: (nextViews - 1) % HOME_ANNOUNCEMENTS.length,
    viewNumber: nextViews,
  };
  lastImpressionAt = now;
  lastImpressionResult = result;
  return result;
}

export function dismissHomeAnnouncement(): void {
  lastImpressionAt = Date.now();
  lastImpressionResult = { visible: false, initialSlide: 0, viewNumber: MAX_ANNOUNCEMENT_VIEWS };

  if (typeof window === 'undefined') return;
  try {
    const nextState: HomeAnnouncementState = {
      views: MAX_ANNOUNCEMENT_VIEWS,
      dismissed: true,
      lastSeenAt: Date.now(),
    };
    window.localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // ignore storage errors
  }
}
