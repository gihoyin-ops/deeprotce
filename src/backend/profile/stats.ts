import { ensureTursoSchema, type DbPool } from '@/backend/db/connection';
import type { AccountRow } from '@/backend/auth/turso-auth';
import { buildDefaultAvatarUrl, isLegacyDefaultAvatar } from '@/lib/avatar';
import { isStaffRole } from '@/lib/security/roles';

export interface DailyTokenPoint {
  day: string;
  tokens: number;
}

export interface ModelUsageStat {
  modelId: string;
  tokens: number;
  requests: number;
}

export interface ProfileStatsPayload {
  lifetimeTokens: number;
  peakTokens: number;
  longestStreak: number;
  currentStreak: number;
  dailyActivity: DailyTokenPoint[];
  mostUsedModels: ModelUsageStat[];
}

export interface PublicProfileResult {
  found: boolean;
  private: boolean;
  isOwner: boolean;
  profile?: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    plan: string;
    isPublic: boolean;
  };
  stats?: ProfileStatsPayload;
}

const toUtcDayKey = (date: Date): string => date.toISOString().slice(0, 10);

const addDaysUtc = (dayKey: string, delta: number): string => {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return toUtcDayKey(dt);
};

export const recordAccountDailyTokens = async (
  accountId: string,
  tokens: number
): Promise<void> => {
  const amount = Math.max(0, Math.floor(Number.isFinite(tokens) ? tokens : 0));
  if (!accountId || amount <= 0) return;

  try {
    const pool = await ensureTursoSchema();
    if (!pool) return;
    const day = toUtcDayKey(new Date());
    await pool.exec(
      `INSERT INTO user_daily_tokens (account_id, day, tokens, requests)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(account_id, day) DO UPDATE SET
         tokens = user_daily_tokens.tokens + excluded.tokens,
         requests = user_daily_tokens.requests + 1`,
      [accountId, day, amount]
    );
  } catch {
    // Non-critical telemetry bs, never block chat responses
  }
};

export const recordAccountModelUsage = async (
  accountId: string,
  modelId: string,
  tokens: number
): Promise<void> => {
  const cleanModel = modelId.trim().slice(0, 128);
  const amount = Math.max(0, Math.floor(Number.isFinite(tokens) ? tokens : 0));
  if (!accountId || !cleanModel) return;

  try {
    const pool = await ensureTursoSchema();
    if (!pool) return;
    const nowIso = new Date().toISOString();
    await pool.exec(
      `INSERT INTO user_model_usage (account_id, model_id, tokens, requests, last_used_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(account_id, model_id) DO UPDATE SET
         tokens = user_model_usage.tokens + excluded.tokens,
         requests = user_model_usage.requests + 1,
         last_used_at = excluded.last_used_at`,
      [accountId, cleanModel, amount, nowIso]
    );
  } catch {
    // Non-critical telemetry bs, never block chat responses
  }
};

const computeStreaks = (activeDaysSortedAsc: string[]): { currentStreak: number; longestStreak: number } => {
  if (activeDaysSortedAsc.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < activeDaysSortedAsc.length; i += 1) {
    const expectedNext = addDaysUtc(activeDaysSortedAsc[i - 1], 1);
    if (activeDaysSortedAsc[i] === expectedNext) {
      run += 1;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 1;
    }
  }

  const today = toUtcDayKey(new Date());
  const yesterday = addDaysUtc(today, -1);
  const activeSet = new Set(activeDaysSortedAsc);

  let currentStreak = 0;
  let cursor = activeSet.has(today) ? today : activeSet.has(yesterday) ? yesterday : '';
  while (cursor && activeSet.has(cursor)) {
    currentStreak += 1;
    cursor = addDaysUtc(cursor, -1);
  }

  return { currentStreak, longestStreak };
};

export const getAccountProfileAndStats = async (
  pool: DbPool,
  usernameParam: string,
  viewerAccountId: string | null
): Promise<PublicProfileResult> => {
  const cleanHandle = usernameParam.trim().replace(/^@+/, '').toLowerCase();
  if (!cleanHandle) {
    return { found: false, private: false, isOwner: false };
  }

  const accountRows = await pool.query<
    Pick<AccountRow, 'id' | 'username' | 'display_name' | 'avatar_url' | 'plan' | 'role'>
  >(
    'SELECT id, username, display_name, avatar_url, plan, role FROM accounts WHERE LOWER(username) = ? OR id = ? LIMIT 1',
    [cleanHandle, usernameParam.trim()]
  );

  const account = accountRows[0];
  if (!account) {
    return { found: false, private: false, isOwner: false };
  }

  const privacyRows = await pool.query<{ is_public: number }>(
    'SELECT is_public FROM user_profile_settings WHERE account_id = ? LIMIT 1',
    [account.id]
  );
  const isPublic = Boolean(privacyRows[0]?.is_public);
  const isOwner = viewerAccountId === account.id;

  const avatar =
    account.avatar_url && !isLegacyDefaultAvatar(account.avatar_url)
      ? account.avatar_url
      : buildDefaultAvatarUrl(account.username || account.id);

  const publicPlanBadge = isStaffRole(account.role) ? 'staff' : account.plan || 'free';

  const profileSummary = {
    id: account.id,
    name: account.display_name,
    username: account.username || cleanHandle,
    avatar,
    plan: publicPlanBadge,
    isPublic
  };

  if (!isPublic && !isOwner) {
    return {
      found: true,
      private: true,
      isOwner: false,
      profile: profileSummary
    };
  }

  const dailyRows = await pool.query<{ day: string; tokens: number }>(
    'SELECT day, tokens FROM user_daily_tokens WHERE account_id = ? ORDER BY day ASC',
    [account.id]
  );

  let lifetimeTokens = 0;
  let peakTokens = 0;
  const dayMap = new Map<string, number>();
  const activeDays: string[] = [];

  for (const row of dailyRows) {
    const tokens = Number(row.tokens) || 0;
    lifetimeTokens += tokens;
    if (tokens > peakTokens) peakTokens = tokens;
    dayMap.set(row.day, tokens);
    if (tokens > 0) activeDays.push(row.day);
  }

  const { currentStreak, longestStreak } = computeStreaks(activeDays);

  // Build the last 182 days (26 weeks) for the GitHub-style activity heatmap
  const today = toUtcDayKey(new Date());
  const totalDays = 182;
  const dailyActivity: DailyTokenPoint[] = [];
  for (let i = totalDays - 1; i >= 0; i -= 1) {
    const day = addDaysUtc(today, -i);
    dailyActivity.push({ day, tokens: dayMap.get(day) ?? 0 });
  }

  const modelRows = await pool.query<{ model_id: string; tokens: number; requests: number }>(
    'SELECT model_id, tokens, requests FROM user_model_usage WHERE account_id = ? ORDER BY tokens DESC, requests DESC LIMIT 5',
    [account.id]
  );

  const mostUsedModels: ModelUsageStat[] = modelRows.map(row => ({
    modelId: row.model_id,
    tokens: Number(row.tokens) || 0,
    requests: Number(row.requests) || 0
  }));

  return {
    found: true,
    private: false,
    isOwner,
    profile: profileSummary,
    stats: {
      lifetimeTokens,
      peakTokens,
      longestStreak,
      currentStreak,
      dailyActivity,
      mostUsedModels
    }
  };
};
