'use client';

import { useEffect, useState } from 'react';

export interface ActiveLimitState {
  reason: 'guest' | 'usage';
  message: string;
  resetAt: number;
}

const STORAGE_KEY = 'deepchat-active-limit';
const LIMIT_EVENT = 'deepchat:limit-changed';

export function getActiveLimit(): ActiveLimitState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveLimitState>;
    if (
      !parsed ||
      typeof parsed.resetAt !== 'number' ||
      (parsed.reason !== 'guest' && parsed.reason !== 'usage')
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() >= parsed.resetAt) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      reason: parsed.reason,
      message: typeof parsed.message === 'string' ? parsed.message : '',
      resetAt: parsed.resetAt,
    };
  } catch {
    return null;
  }
}

export function setActiveLimit(limit: ActiveLimitState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(limit));
  } catch {
    // swallow storage quota bs if localStorage is full
  }
  window.dispatchEvent(new Event(LIMIT_EVENT));
}

export function clearActiveLimit(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // whatever, ignore localStorage errors
  }
  window.dispatchEvent(new Event(LIMIT_EVENT));
}

export function formatRemainingTime(resetAt: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.ceil((resetAt - now) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.ceil(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

export function useActiveLimit(isGuest: boolean): ActiveLimitState | null {
  const [limit, setLimit] = useState<ActiveLimitState | null>(() => getActiveLimit());

  useEffect(() => {
    const sync = () => setLimit(getActiveLimit());
    sync();
    window.addEventListener(LIMIT_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(LIMIT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Nuke the guest limit as soon as this mf signs in
  useEffect(() => {
    if (!isGuest && limit?.reason === 'guest') {
      clearActiveLimit();
    }
  }, [isGuest, limit?.reason]);

  // Wipe the limit automatically once resetAt hits
  useEffect(() => {
    if (!limit) return;
    const remainingMs = Math.max(0, limit.resetAt - Date.now());
    const timer = window.setTimeout(() => {
      clearActiveLimit();
    }, remainingMs + 250);
    return () => window.clearTimeout(timer);
  }, [limit]);

  // Poll /api/usage for signed-in users so stale limit state clears when the window resets
  useEffect(() => {
    if (isGuest) return;
    let active = true;
    fetch('/api/usage', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data || !data.enforced) return;
        const exhausted = Array.isArray(data.windows)
          ? data.windows.find((w: { exhausted?: boolean; resetsAt?: string }) => w.exhausted)
          : null;
        if (exhausted) {
          const resetAt = exhausted.resetsAt
            ? new Date(exhausted.resetsAt).getTime()
            : Date.now() + 30 * 60 * 1000;
          setActiveLimit({
            reason: 'usage',
            message: 'You have reached your usage limit for this window.',
            resetAt: Number.isFinite(resetAt) ? resetAt : Date.now() + 30 * 60 * 1000,
          });
        } else if (limit?.reason === 'usage') {
          clearActiveLimit();
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [isGuest, limit?.reason]);

  return limit;
}
