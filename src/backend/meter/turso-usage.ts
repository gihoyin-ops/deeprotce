import crypto from 'node:crypto';
import { ensureTursoSchema, type DbPool } from '@/backend/db/connection';
import { DEFAULT_PLAN, getPlan, isUnlimitedPlan, parsePlan, type PlanId } from '@/lib/security/plans';
import type { UsageGate, UsageSnapshot, UsageWindowSnapshot } from '@/lib/security/usage';

const FIVE_HOUR_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAY_MS = 7 * 24 * 60 * 60 * 1000;

interface UsageWindowRow {
  id: string;
  account_id: string;
  window_type: '5h' | '7d';
  limit_tokens: number;
  used_tokens: number;
  window_start: number;
  window_end: number;
}

const WINDOW_DEFS: Array<{ type: '5h' | '7d'; ms: number }> = [
  { type: '5h', ms: FIVE_HOUR_MS },
  { type: '7d', ms: SEVEN_DAY_MS }
];

const ensureWindowRow = async (
  pool: DbPool,
  accountId: string,
  windowType: '5h' | '7d',
  windowMs: number,
  limitTokens: number,
  now: number,
  existing?: UsageWindowRow
): Promise<UsageWindowRow> => {
  const effectiveLimit = Number.isFinite(limitTokens) ? limitTokens : 0;

  if (!existing || now >= Number(existing.window_end)) {
    const id = existing?.id || crypto.randomUUID();
    const start = now;
    const end = now + windowMs;
    await pool.exec(
      `INSERT INTO usage_windows (id, account_id, window_type, limit_tokens, used_tokens, window_start, window_end)
       VALUES (?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(account_id, window_type) DO UPDATE SET
         limit_tokens = excluded.limit_tokens,
         used_tokens = 0,
         window_start = excluded.window_start,
         window_end = excluded.window_end`,
      [id, accountId, windowType, effectiveLimit, start, end]
    );
    return {
      id,
      account_id: accountId,
      window_type: windowType,
      limit_tokens: effectiveLimit,
      used_tokens: 0,
      window_start: start,
      window_end: end
    };
  }

  if (Number(existing.limit_tokens) !== effectiveLimit) {
    await pool.exec(
      'UPDATE usage_windows SET limit_tokens = ? WHERE account_id = ? AND window_type = ?',
      [effectiveLimit, accountId, windowType]
    );
    existing.limit_tokens = effectiveLimit;
  }

  return existing;
};

export const getAccountUsageSnapshot = async (accountId: string): Promise<UsageSnapshot | null> => {
  if (!accountId) return null;

  try {
    const pool = await ensureTursoSchema();
    if (!pool) return null;

    const accRows = await pool.query<{ plan: string }>(
      'SELECT plan FROM accounts WHERE id = ? LIMIT 1',
      [accountId]
    );
    if (!accRows[0]) return null;

    const planId = parsePlan(accRows[0].plan) ?? DEFAULT_PLAN;
    const planMeta = getPlan(planId);
    const limit = planMeta.limitTokens;
    const unlimited = isUnlimitedPlan(planId);

    const existingRows = await pool.query<UsageWindowRow>(
      'SELECT id, account_id, window_type, limit_tokens, used_tokens, window_start, window_end FROM usage_windows WHERE account_id = ?',
      [accountId]
    );
    const byType = new Map<string, UsageWindowRow>();
    for (const r of existingRows) {
      byType.set(r.window_type, r);
    }

    const now = Date.now();
    let worstUsed = 0;
    let bestRemaining: number = Infinity;
    const windows: UsageWindowSnapshot[] = [];

    for (const def of WINDOW_DEFS) {
      const row = await ensureWindowRow(
        pool,
        accountId,
        def.type,
        def.ms,
        limit,
        now,
        byType.get(def.type)
      );
      const used = Number(row.used_tokens) || 0;
      const exhausted = !unlimited && used >= limit;
      const remaining = unlimited ? Infinity : Math.max(0, limit - used);

      windows.push({
        window: def.type,
        limit,
        used,
        remaining,
        start: Number(row.window_start),
        end: Number(row.window_end),
        exhausted
      });

      worstUsed = Math.max(worstUsed, used);
      if (!unlimited) bestRemaining = Math.min(bestRemaining, remaining);
    }

    return {
      plan: planMeta.label,
      planId,
      limit,
      used: worstUsed,
      remaining: unlimited ? Infinity : bestRemaining,
      unlimited,
      windows
    };
  } catch {
    return null;
  }
};

export const recordAccountUsageTokens = async (accountId: string, tokens: number): Promise<void> => {
  const amount = Math.max(0, Math.floor(Number.isFinite(tokens) ? tokens : 0));
  if (!accountId || amount <= 0) return;

  try {
    const pool = await ensureTursoSchema();
    if (!pool) return;

    const accRows = await pool.query<{ plan: string }>(
      'SELECT plan FROM accounts WHERE id = ? LIMIT 1',
      [accountId]
    );
    if (!accRows[0]) return;

    const planId = parsePlan(accRows[0].plan) ?? DEFAULT_PLAN;
    const limit = getPlan(planId).limitTokens;
    const effectiveLimit = Number.isFinite(limit) ? limit : 0;
    const now = Date.now();

    for (const def of WINDOW_DEFS) {
      await pool.exec(
        `INSERT INTO usage_windows (id, account_id, window_type, limit_tokens, used_tokens, window_start, window_end)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id, window_type) DO UPDATE SET
           limit_tokens = excluded.limit_tokens,
           used_tokens = CASE
             WHEN ? >= usage_windows.window_end THEN excluded.used_tokens
             ELSE usage_windows.used_tokens + excluded.used_tokens
           END,
           window_start = CASE
             WHEN ? >= usage_windows.window_end THEN excluded.window_start
             ELSE usage_windows.window_start
           END,
           window_end = CASE
             WHEN ? >= usage_windows.window_end THEN excluded.window_end
             ELSE usage_windows.window_end
           END`,
        [
          crypto.randomUUID(),
          accountId,
          def.type,
          effectiveLimit,
          amount,
          now,
          now + def.ms,
          now,
          now,
          now
        ]
      );
    }
  } catch {
    // Non-critical; never block chat responses
  }
};

export const checkAccountUsageBudget = async (accountId: string): Promise<UsageGate> => {
  const snapshot = await getAccountUsageSnapshot(accountId);
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

export const setAccountPlanInDb = async (accountId: string, planId: PlanId): Promise<void> => {
  const pool = await ensureTursoSchema();
  if (!pool) return;

  const nowIso = new Date().toISOString();
  const limit = getPlan(planId).limitTokens;
  const effectiveLimit = Number.isFinite(limit) ? limit : 0;

  await pool.exec('UPDATE accounts SET plan = ?, updated_at = ? WHERE id = ?', [
    planId,
    nowIso,
    accountId
  ]);
  await pool.exec(
    'UPDATE usage_windows SET limit_tokens = ? WHERE account_id = ?',
    [effectiveLimit, accountId]
  );
  await pool.exec(
    `INSERT INTO plan_grants (id, account_id, plan, granted_by, valid_from, valid_until)
     VALUES (?, ?, ?, 'admin', ?, NULL)`,
    [crypto.randomUUID(), accountId, planId, nowIso]
  );
};
