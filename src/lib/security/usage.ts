import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { DATA_DIR, ensureDataDirectoriesSync, isServerless } from '@/lib/data-directories';
import { DEFAULT_PLAN, getPlan, isUnlimitedPlan, parsePlan, type PlanId } from './plans';

// Per-identity ledger, one row per identity, two windows per row
// Local-first, no account system, so identity is the IP the
// rate limiter already uses at src/lib/security/rate-limit.ts
// Each window is a burst cap at the plan number
// A window expires 5h or 7d after its first spend; hitting one 402s
// Store unavailable means fail open, a metering bug must not
// take chat offline
// Serverless off: on Vercel the function file is shared by every visitor
// as one identity and its storage resets on each cold start, so a budget
// here would not know who is who and could block chat for everyone
// The meter only runs on a real server (VPS or LAN self-host)
export const USAGE_LEDGER_ENABLED = !isServerless;

const DB_PATH = (() => {
  ensureDataDirectoriesSync();
  return path.join(DATA_DIR, 'deepchat-usage.sqlite');
})();

export type WindowId = 'h5' | 'd7';
/** public label for a window */
export type WindowLabel = '5h' | '7d';

export const USAGE_WINDOWS: { id: WindowId; ms: number }[] = [
  { id: 'h5', ms: 5 * 60 * 60 * 1000 },
  { id: 'd7', ms: 7 * 24 * 60 * 60 * 1000 }
];

const FIVE_HOUR_MS = USAGE_WINDOWS[0].ms;
const SEVEN_DAY_MS = USAGE_WINDOWS[1].ms;

let db: DatabaseSync | null = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS usage (
    key TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'free',
    h5_start INTEGER NOT NULL DEFAULT 0,
    h5_tokens INTEGER NOT NULL DEFAULT 0,
    d7_start INTEGER NOT NULL DEFAULT 0,
    d7_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

const getDb = (): DatabaseSync | null => {
  if (!USAGE_LEDGER_ENABLED) return null;
  try {
    if (!db) {
      db = new DatabaseSync(DB_PATH);
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec(SCHEMA);
    }
    return db;
  } catch {
    // no storage, fail open
    return null;
  }
};

// row mirror of SELECT ... FROM usage, node-sqlite returns untyped rows
type UsageRow = {
  key: string;
  plan: string;
  h5_start: number;
  h5_tokens: number;
  d7_start: number;
  d7_tokens: number;
};

type WindowState = { start: number; tokens: number };

const readIdentity = (database: DatabaseSync, identityKey: string): UsageRow | null => {
  const row = database.prepare('SELECT key, plan, h5_start, h5_tokens, d7_start, d7_tokens FROM usage WHERE key = ?').get(identityKey) as UsageRow | undefined;
  return row ?? null;
};

const windowStateForRow = (row: UsageRow, id: WindowId): WindowState =>
  id === 'h5' ? { start: row.h5_start, tokens: row.h5_tokens } : { start: row.d7_start, tokens: row.d7_tokens };

// reset a window when it is past its spend horizon
const refreshWindow = (database: DatabaseSync, row: UsageRow, id: WindowId, windowMs: number, now: number): WindowState => {
  const state = windowStateForRow(row, id);
  if (state.tokens > 0 && now - state.start >= windowMs) {
    const startExpr = id === 'h5' ? 'h5_start' : 'd7_start';
    database.prepare(`UPDATE usage SET ${startExpr} = ?, ${startExpr.replace('_start', '_tokens')} = 0, updated_at = ? WHERE key = ?`)
      .run(now, new Date(now).toISOString(), row.key);
    return { start: now, tokens: 0 };
  }
  return state;
};

const ensureIdentity = (database: DatabaseSync, identityKey: string): void => {
  const nowIso = new Date().toISOString();
  database.prepare('INSERT OR IGNORE INTO usage (key, plan, h5_start, h5_tokens, d7_start, d7_tokens, created_at, updated_at) VALUES (?, ?, 0, 0, 0, 0, ?, ?)')
    .run(identityKey, DEFAULT_PLAN, nowIso, nowIso);
};

const limitFor = (planId: PlanId): number => getPlan(planId).limitTokens;

const FIVE_HOUR_LABEL: WindowLabel = '5h';
const SEVEN_DAY_LABEL: WindowLabel = '7d';

export interface UsageWindowSnapshot {
  window: WindowLabel;
  limit: number;
  used: number;
  remaining: number;
  start: number;
  end: number;
  exhausted: boolean;
}

export interface UsageSnapshot {
  plan: string;
  planId: PlanId;
  limit: number;
  used: number;
  remaining: number;
  unlimited: boolean;
  windows: UsageWindowSnapshot[];
}

/** current plan + window state; null when offline */
export const getUsageSnapshot = (identityKey: string): UsageSnapshot | null => {
  const database = getDb();
  if (!database) return null;

  const now = Date.now();
  let row = readIdentity(database, identityKey);
  if (!row) {
    ensureIdentity(database, identityKey);
    row = readIdentity(database, identityKey);
    if (!row) return null;
  }

  const planId = parsePlan(row.plan) ?? DEFAULT_PLAN;
  const limit = limitFor(planId);
  const unlimited = isUnlimitedPlan(planId);

  let worstUsed = 0;
  let bestRemaining: number = Infinity;
  const windows: UsageWindowSnapshot[] = [];

  for (const { id, ms } of USAGE_WINDOWS) {
    const state = refreshWindow(database, row, id, ms, now);
    const start = state.tokens > 0 ? state.start : now;
    const exhausted = !unlimited && state.tokens >= limit;

    const windowSnap: UsageWindowSnapshot = {
      window: id === 'h5' ? FIVE_HOUR_LABEL : SEVEN_DAY_LABEL,
      limit,
      used: state.tokens,
      remaining: unlimited ? Infinity : Math.max(0, limit - state.tokens),
      start,
      end: start + ms,
      exhausted
    };
    windows.push(windowSnap);
    worstUsed = Math.max(worstUsed, state.tokens);
    if (!unlimited) bestRemaining = Math.min(bestRemaining, windowSnap.remaining);
  }

  return {
    plan: getPlan(planId).label,
    planId,
    limit,
    used: worstUsed,
    remaining: unlimited ? Infinity : bestRemaining,
    unlimited,
    windows
  };
};

export type UsageGate =
  | { allowed: true; snapshot: UsageSnapshot | null }
  | { allowed: false; status: number; error: string; exhaustedWindow?: WindowLabel; retryAfterMs?: number };

/** gate a spend; fail open when offline */
export const checkUsageBudget = (identityKey: string): UsageGate => {
  const snapshot = getUsageSnapshot(identityKey);
  if (!snapshot) return { allowed: true, snapshot: null };
  if (snapshot.unlimited) return { allowed: true, snapshot };

  const exhausted = snapshot.windows.find(w => w.exhausted);
  if (exhausted) {
    const now = Date.now();
    return {
      allowed: false,
      status: 402,
      error: 'usage_limit_reached',
      exhaustedWindow: exhausted.window,
      retryAfterMs: Math.max(0, exhausted.end - now)
    };
  }
  return { allowed: true, snapshot };
};

/** add spent tokens to both windows in one atomic statement */
export const recordTokens = (identityKey: string, tokens: number): void => {
  const database = getDb();
  if (!database) return;

  const amount = Math.max(0, Math.floor(Number.isFinite(tokens) ? tokens : 0));
  if (amount === 0) return;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  ensureIdentity(database, identityKey);
  // SQLite SET is evaluated against the original row so each
  // branch is a pure function of the stored state, and a crash
  // cannot skew one window relative to the other
  database.prepare(`
    UPDATE usage SET
      h5_start  = CASE WHEN h5_tokens = 0 THEN ? WHEN (? - h5_start) >= ? THEN ? ELSE h5_start END,
      h5_tokens = CASE WHEN h5_tokens = 0 THEN ? WHEN (? - h5_start) >= ? THEN ? ELSE h5_tokens + ? END,
      d7_start  = CASE WHEN d7_tokens = 0 THEN ? WHEN (? - d7_start) >= ? THEN ? ELSE d7_start END,
      d7_tokens = CASE WHEN d7_tokens = 0 THEN ? WHEN (? - d7_start) >= ? THEN ? ELSE d7_tokens + ? END,
      updated_at = ?
    WHERE key = ?
  `).run(
    now, now, FIVE_HOUR_MS, now,
    amount, now, FIVE_HOUR_MS, amount, amount,
    now, now, SEVEN_DAY_MS, now,
    amount, now, SEVEN_DAY_MS, amount, amount,
    nowIso, identityKey
  );
};

/** set or change the stored plan for an identity */
export const setIdentityPlan = (identityKey: string, planId: PlanId): PlanId => {
  const database = getDb();
  if (!database) return planId;

  ensureIdentity(database, identityKey);
  database.prepare('UPDATE usage SET plan = ?, updated_at = ? WHERE key = ?').run(planId, new Date().toISOString(), identityKey);
  return planId;
};
