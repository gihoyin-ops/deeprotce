import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  isSessionActiveInDb,
  requireDbPool,
  type AccountRow
} from '@/backend/auth/turso-auth';
import type { DbPool } from '@/backend/db/connection';
import { getVerifiedAccount, isSameOriginRequest } from '@/lib/security/auth';
import {
  isManagerStaffRole,
  parseRole,
  type AccountRole
} from '@/lib/security/roles';

export interface AdminActor {
  id: string;
  email: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  plan: AccountRow['plan'];
  role: AccountRole;
}

export type AdminAuthResult =
  | { ok: true; pool: DbPool; actor: AdminActor; sessionId: string }
  | { ok: false; response: NextResponse };

export async function requireAdminActor(
  req: Request,
  options?: { requireManager?: boolean; checkSameOrigin?: boolean }
): Promise<AdminAuthResult> {
  if (options?.checkSameOrigin) {
    const sameOrigin = isSameOriginRequest(req.headers, req.headers.get('host'));
    if (!sameOrigin) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 })
      };
    }
  }

  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    };
  }

  let pool: DbPool;
  try {
    pool = await requireDbPool();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database unavailable.';
    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status: 503 })
    };
  }

  const active = await isSessionActiveInDb(pool, verified.sid);
  if (!active) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Session expired or revoked.' }, { status: 401 })
    };
  }

  const rows = await pool.query<
    Pick<
      AccountRow,
      'id' | 'email' | 'username' | 'display_name' | 'avatar_url' | 'plan' | 'role' | 'is_banned'
    >
  >(
    `SELECT id, email, username, display_name, avatar_url, plan, role, is_banned
     FROM accounts
     WHERE id = ?
     LIMIT 1`,
    [verified.sub]
  );

  const account = rows[0];
  if (!account) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Account not found.' }, { status: 401 })
    };
  }

  if (Number(account.is_banned) === 1) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Account is suspended.' }, { status: 403 })
    };
  }

  const role = parseRole(account.role) ?? 'user';
  if (!isManagerStaffRole(role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Manager Staff access required.' },
        { status: 403 }
      )
    };
  }

  return {
    ok: true,
    pool,
    sessionId: verified.sid,
    actor: {
      id: account.id,
      email: account.email,
      username: account.username,
      display_name: account.display_name,
      avatar_url: account.avatar_url,
      plan: account.plan,
      role
    }
  };
}

export async function recordAdminAudit(
  pool: DbPool,
  params: {
    actor: AdminActor;
    action: string;
    targetAccountId?: string | null;
    targetEmail?: string | null;
    reason: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await pool.exec(
    `INSERT INTO admin_audit_logs
       (id, actor_id, actor_email, actor_role, action, target_account_id, target_email, reason, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      params.actor.id,
      params.actor.email,
      params.actor.role,
      params.action,
      params.targetAccountId ?? null,
      params.targetEmail ?? null,
      params.reason.trim().slice(0, 500),
      params.metadata ? JSON.stringify(params.metadata) : null,
      new Date().toISOString()
    ]
  );
}
