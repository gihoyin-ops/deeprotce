import { ensureTursoSchema, type DbPool } from '@/backend/db/connection';
import type { AccountRole, BackendPlanId } from '@/backend/types';

export interface AccountRow {
  id: string;
  email: string;
  username: string | null;
  password_hash: string | null;
  display_name: string;
  avatar_url: string | null;
  plan: BackendPlanId;
  role: AccountRole;
  is_banned: number;
  ban_reason: string | null;
  banned_at: string | null;
  banned_by: string | null;
  email_verified: number;
  created_at: string;
  updated_at: string;
}

export const requireDbPool = async (): Promise<DbPool> => {
  const pool = await ensureTursoSchema();
  if (!pool) {
    throw new Error('Database is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
  }
  return pool;
};

export const revokeAllSessionsForAccount = async (
  pool: DbPool,
  accountId: string
): Promise<void> => {
  await pool.exec('DELETE FROM auth_sessions WHERE account_id = ?', [accountId]);
};

export const revokeSessionById = async (pool: DbPool, sessionId: string): Promise<void> => {
  await pool.exec('DELETE FROM auth_sessions WHERE id = ?', [sessionId]);
};

export const isSessionActiveInDb = async (pool: DbPool, sessionId: string): Promise<boolean> => {
  const rows = await pool.query<{ id: string; expires_at: number; is_banned: number | null }>(
    `SELECT s.id, s.expires_at, a.is_banned
     FROM auth_sessions s
     JOIN accounts a ON a.id = s.account_id
     WHERE s.id = ?
     LIMIT 1`,
    [sessionId]
  );
  const row = rows[0];
  if (!row) return false;
  if (Number(row.is_banned) === 1 || Date.now() > Number(row.expires_at)) {
    await revokeSessionById(pool, sessionId).catch(() => undefined);
    return false;
  }
  return true;
};
