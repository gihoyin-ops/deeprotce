import crypto from 'node:crypto';
import { ensureTursoSchema, type DbPool } from '@/backend/db/connection';
import type { AccountRole, BackendPlanId } from '@/backend/types';
import {
  ACCOUNT_REMEMBER_TTL_SECONDS,
  ACCOUNT_SESSION_TTL_SECONDS,
  issueAccountSessionCookie
} from '@/lib/security/auth';
import { hashIp, hashToken } from '@/lib/security/crypto';

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

export const findAccountByEmail = async (pool: DbPool, email: string): Promise<AccountRow | null> => {
  const rows = await pool.query<AccountRow>(
    'SELECT id, email, username, password_hash, display_name, avatar_url, plan, role, is_banned, ban_reason, banned_at, banned_by, email_verified, created_at, updated_at FROM accounts WHERE LOWER(email) = ? LIMIT 1',
    [email.trim().toLowerCase()]
  );
  return rows[0] ?? null;
};

export const createAccountSession = async (
  pool: DbPool,
  account: Pick<AccountRow, 'id' | 'email' | 'plan' | 'role' | 'display_name'>,
  meta: { userAgent: string | null; ip: string; rememberMe?: boolean }
): Promise<{ cookieHeader: string; sessionId: string }> => {
  const rememberMe = meta.rememberMe ?? true;
  const ttlSeconds = rememberMe ? ACCOUNT_REMEMBER_TTL_SECONDS : ACCOUNT_SESSION_TTL_SECONDS;
  const sessionId = crypto.randomUUID();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;

  await pool.exec(
    `INSERT INTO auth_sessions (id, account_id, token_hash, user_agent, ip_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      account.id,
      tokenHash,
      (meta.userAgent ?? '').slice(0, 256),
      hashIp(meta.ip),
      expiresAt,
      new Date(now).toISOString()
    ]
  );

  const cookieHeader = issueAccountSessionCookie(
    {
      sub: account.id,
      sid: sessionId,
      email: account.email,
      plan: account.plan,
      role: account.role ?? 'user',
      name: account.display_name
    },
    { rememberMe }
  );

  return { cookieHeader, sessionId };
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
