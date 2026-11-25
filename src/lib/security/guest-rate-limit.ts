import { ensureTursoSchema } from '@/backend/db/connection';
import { hashIp } from './crypto';

export const GUEST_LIMITS = {
  maxChatRequests: 3,
  chatWindowSeconds: 2 * 60 * 60, // 2 hours
  maxAttachmentsPerMessage: 3,
  maxUploads: 10,
  uploadWindowSeconds: 24 * 60 * 60 // 24 hours
} as const;

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getGuestRateLimitConfig = () => ({
  maxRequests: parsePositiveInt(process.env.GUEST_MAX_REQUESTS, GUEST_LIMITS.maxChatRequests),
  windowMs: parsePositiveInt(process.env.GUEST_WINDOW_SECONDS, GUEST_LIMITS.chatWindowSeconds) * 1000
});

export const getGuestUploadLimitConfig = () => ({
  maxUploads: parsePositiveInt(process.env.GUEST_MAX_UPLOADS, GUEST_LIMITS.maxUploads),
  windowMs:
    parsePositiveInt(process.env.GUEST_UPLOAD_WINDOW_SECONDS, GUEST_LIMITS.uploadWindowSeconds) * 1000
});

export interface GuestRateLimitVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds?: number;
  resetAt: number;
}

type MemoryEntry = { count: number; windowStart: number };

const getMemoryMap = (): Map<string, MemoryEntry> => {
  const g = globalThis as { __dcGuestRateMap?: Map<string, MemoryEntry> };
  return (g.__dcGuestRateMap ??= new Map());
};

const checkMemoryFallback = (
  key: string,
  limit: number,
  windowMs: number,
  now: number
): GuestRateLimitVerdict => {
  const map = getMemoryMap();
  const existing = map.get(key);
  if (!existing || now - existing.windowStart >= windowMs) {
    map.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt: now + windowMs
    };
  }

  if (existing.count >= limit) {
    const resetAt = existing.windowStart + windowMs;
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      resetAt
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.windowStart + windowMs
  };
};

const checkTursoWindowLimit = async (
  key: string,
  limit: number,
  windowMs: number
): Promise<GuestRateLimitVerdict> => {
  const now = Date.now();

  try {
    const pool = await ensureTursoSchema();
    if (!pool) {
      return checkMemoryFallback(key, limit, windowMs, now);
    }

    const rows = await pool.query<{ count: number; window_start: number }>(
      'SELECT count, window_start FROM guest_rate_limits WHERE key = ?',
      [key]
    );

    const nowIso = new Date(now).toISOString();
    const row = rows[0];

    if (!row || now - Number(row.window_start) >= windowMs) {
      await pool.exec(
        `INSERT INTO guest_rate_limits (key, count, window_start, updated_at)
         VALUES (?, 1, ?, ?)
         ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start, updated_at = excluded.updated_at`,
        [key, now, nowIso]
      );
      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - 1),
        resetAt: now + windowMs
      };
    }

    const currentCount = Number(row.count);
    const windowStart = Number(row.window_start);
    const resetAt = windowStart + windowMs;

    if (currentCount >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        resetAt
      };
    }

    const nextCount = currentCount + 1;
    await pool.exec(
      'UPDATE guest_rate_limits SET count = ?, updated_at = ? WHERE key = ?',
      [nextCount, nowIso, key]
    );

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - nextCount),
      resetAt
    };
  } catch {
    return checkMemoryFallback(key, limit, windowMs, now);
  }
};

export const checkGuestChatRateLimit = async (ip: string): Promise<GuestRateLimitVerdict> => {
  const { maxRequests, windowMs } = getGuestRateLimitConfig();
  return checkTursoWindowLimit(`guest:${hashIp(ip)}`, maxRequests, windowMs);
};

export const checkGuestUploadLimit = async (ip: string): Promise<GuestRateLimitVerdict> => {
  const { maxUploads, windowMs } = getGuestUploadLimitConfig();
  return checkTursoWindowLimit(`guest_upload:${hashIp(ip)}`, maxUploads, windowMs);
};
