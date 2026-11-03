// Client-side feedback helpers. The server sqlite (POST /api/feedback) is the
// authoritative store; localStorage mirrors every vote so the UI can restore
// state synchronously and keep it if the server file is missing.
//
// One vote per message: re-clicking the active thumb removes the vote
// ({remove: true}), clicking the other one flips it server-side.

export type MessageRating = 'like' | 'dislike';

export interface FeedbackRecord {
  rating: MessageRating;
  reasons: string[];
  details: string;
  savedAt: string;
  persisted: boolean;
}

export type FeedbackMap = Record<string, FeedbackRecord>;

const STORAGE_KEY = 'deepchat-message-feedback-v1';

export const DISLIKE_REASONS: readonly string[] = [
  'Visual is unhelpful or broken',
  'Incorrect or incomplete',
  'Not what I asked for',
  'Slow or buggy',
  'Style or tone',
  'Safety or legal concern',
  'Other'
];

export const ERROR_DISLIKE_REASONS: readonly string[] = [
  'Always Error Response',
  'Incorrect or incomplete',
  'Not what I asked for',
  'Slow or buggy',
  'Other'
];

export const LIKE_REASONS: readonly string[] = [
  'Correct and helpful',
  'Clear explanation',
  'Well matched to the request',
  'Good formatting',
  'Other'
];

const keyFor = (chatId: string, messageId: string) => `${chatId}:${messageId}`;

const readStored = (): FeedbackMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: FeedbackMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'object' || value === null) continue;
      const record = value as Record<string, unknown>;
      if (record.rating !== 'like' && record.rating !== 'dislike') continue;
      out[key] = {
        rating: record.rating,
        reasons: Array.isArray(record.reasons) ? record.reasons.filter((reason): reason is string => typeof reason === 'string') : [],
        details: typeof record.details === 'string' ? record.details : '',
        savedAt: typeof record.savedAt === 'string' ? record.savedAt : new Date().toISOString(),
        persisted: record.persisted === true
      };
    }
    return out;
  } catch {
    return {};
  }
};

const writeStored = (map: FeedbackMap) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // storage full or blocked: in-memory state in the caller still works
  }
};

export const getFeedbackMap = (): FeedbackMap => readStored();

export const subscribeFeedback = (callback: (map: FeedbackMap) => void): (() => void) => {
  const local = () => callback(readStored());
  window.addEventListener('feedbackUpdated', local);
  const storage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback(readStored());
  };
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener('feedbackUpdated', local);
    window.removeEventListener('storage', storage);
  };
};

const notifyChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('feedbackUpdated'));
};

export const submitMessageFeedback = async (
  chatId: string,
  messageId: string,
  rating: MessageRating | null,
  reasons: string[] = [],
  details = ''
): Promise<boolean> => {
  const key = keyFor(chatId, messageId);
  const map = readStored();
  const previous = map[key];

  if (rating === null) {
    delete map[key];
    writeStored(map);
    notifyChange();
  } else {
    const saved: FeedbackRecord = {
      // Keep a prior annotation when the new call carries none (a plain flip
      // from the toolbar reuses whatever the dialog last submitted).
      rating,
      reasons: reasons.length > 0 ? reasons : previous?.rating === rating ? previous.reasons : [],
      details: details.length > 0 ? details : previous?.rating === rating ? previous.details : '',
      savedAt: new Date().toISOString(),
      persisted: true
    };
    map[key] = saved;
    writeStored(map);
    notifyChange();
  }

  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, messageId, rating, remove: rating === null, reasons, details })
    });
    const result = (await response.json()) as { ok?: boolean };
    const persisted = response.ok && result.ok === true;
    const freshMap = readStored();
    const current = freshMap[key];
    if (rating === null) delete freshMap[key];
    else if (current) freshMap[key] = { ...current, persisted };
    writeStored(freshMap);
    notifyChange();
    return persisted;
  } catch {
    // offline: the local copy stays, marked unpersisted so it is visible as such
    const freshMap = readStored();
    const current = freshMap[key];
    if (rating !== null && current) freshMap[key] = { ...current, persisted: false };
    writeStored(freshMap);
    notifyChange();
    return false;
  }
};
