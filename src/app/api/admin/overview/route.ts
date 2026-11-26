import { NextResponse } from 'next/server';
import { requireAdminActor } from '@/backend/admin/guard';
import { buildDefaultAvatarUrl, isLegacyDefaultAvatar } from '@/lib/avatar';
import { parseRole } from '@/lib/security/roles';

export const runtime = 'nodejs';

interface RawUserRow {
  id: string;
  email: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  plan: string;
  role: string;
  is_banned: number;
  ban_reason: string | null;
  banned_at: string | null;
  created_at: string;
  updated_at: string;
  active_sessions: number;
}

interface RawAuditRow {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_role: string;
  action: string;
  target_account_id: string | null;
  target_email: string | null;
  reason: string;
  metadata_json: string | null;
  created_at: string;
}

export async function GET(req: Request) {
  const auth = await requireAdminActor(req);
  if (!auth.ok) return auth.response;

  const { pool, actor } = auth;

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const roleFilter = (url.searchParams.get('role') ?? 'all').trim().toLowerCase();
    const statusFilter = (url.searchParams.get('status') ?? 'all').trim().toLowerCase();
    const planFilter = (url.searchParams.get('plan') ?? 'all').trim().toLowerCase();

    const nowMs = Date.now();

    const [allUsers, grantRows, auditRows] = await Promise.all([
      pool.query<RawUserRow>(
        `SELECT
           a.id,
           a.email,
           a.username,
           a.display_name,
           a.avatar_url,
           a.plan,
           a.role,
           a.is_banned,
           a.ban_reason,
           a.banned_at,
           a.created_at,
           a.updated_at,
           (
             SELECT COUNT(*)
             FROM auth_sessions s
             WHERE s.account_id = a.id AND s.expires_at > ?
           ) AS active_sessions
         FROM accounts a
         ORDER BY
           CASE LOWER(a.role)
             WHEN 'manager_staff' THEN 0
             WHEN 'staff' THEN 1
             ELSE 2
           END ASC,
           a.created_at DESC`,
        [nowMs]
      ),
      pool.query<{
        account_id: string;
        plan: string;
        granted_by: string;
        valid_from: string;
        valid_until: string | null;
      }>(
        `SELECT account_id, plan, granted_by, valid_from, valid_until
         FROM plan_grants
         ORDER BY valid_from DESC`
      ),
      pool.query<RawAuditRow>(
        `SELECT id, actor_id, actor_email, actor_role, action, target_account_id, target_email, reason, metadata_json, created_at
         FROM admin_audit_logs
         ORDER BY created_at DESC
         LIMIT 60`
      )
    ]);

    const latestGrantByAccount = new Map<
      string,
      { plan: string; grantedBy: string; validFrom: string; validUntil: string | null }
    >();
    for (const g of grantRows) {
      if (!latestGrantByAccount.has(g.account_id)) {
        latestGrantByAccount.set(g.account_id, {
          plan: g.plan,
          grantedBy: g.granted_by,
          validFrom: g.valid_from,
          validUntil: g.valid_until
        });
      }
    }

    const stats = {
      totalUsers: allUsers.length,
      activeStaff: allUsers.filter(
        u => !Number(u.is_banned) && (u.role === 'staff' || u.role === 'manager_staff')
      ).length,
      managerStaff: allUsers.filter(
        u => !Number(u.is_banned) && u.role === 'manager_staff'
      ).length,
      bannedUsers: allUsers.filter(u => Number(u.is_banned) === 1).length,
      paidUsers: allUsers.filter(
        u => u.plan === 'supporters' || u.plan === 'cool'
      ).length
    };

    const filteredUsers = allUsers
      .filter(u => {
        if (q) {
          const hay = `${u.email} ${u.username ?? ''} ${u.display_name}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        const normalizedRole = parseRole(u.role) ?? 'user';
        if (roleFilter !== 'all' && normalizedRole !== roleFilter) return false;
        if (statusFilter === 'banned' && Number(u.is_banned) !== 1) return false;
        if (statusFilter === 'active' && Number(u.is_banned) === 1) return false;
        if (planFilter !== 'all' && u.plan.toLowerCase() !== planFilter) return false;
        return true;
      })
      .map(u => {
        const avatar =
          u.avatar_url && !isLegacyDefaultAvatar(u.avatar_url)
            ? u.avatar_url
            : buildDefaultAvatarUrl(u.username || u.id);
        return {
          id: u.id,
          email: u.email,
          username: u.username,
          displayName: u.display_name,
          avatarUrl: avatar,
          plan: u.plan,
          role: parseRole(u.role) ?? 'user',
          isBanned: Number(u.is_banned) === 1,
          banReason: u.ban_reason,
          bannedAt: u.banned_at,
          createdAt: u.created_at,
          updatedAt: u.updated_at,
          activeSessions: Number(u.active_sessions ?? 0),
          subscription: latestGrantByAccount.get(u.id) ?? null
        };
      });

    const auditLogs = auditRows.map(row => {
      let metadata: Record<string, unknown> | null = null;
      if (row.metadata_json) {
        try {
          metadata = JSON.parse(row.metadata_json) as Record<string, unknown>;
        } catch {
          metadata = null;
        }
      }
      return {
        id: row.id,
        actorId: row.actor_id,
        actorEmail: row.actor_email,
        actorRole: parseRole(row.actor_role) ?? 'user',
        action: row.action,
        targetAccountId: row.target_account_id,
        targetEmail: row.target_email,
        reason: row.reason,
        metadata,
        createdAt: row.created_at
      };
    });

    const actorAvatar =
      actor.avatar_url && !isLegacyDefaultAvatar(actor.avatar_url)
        ? actor.avatar_url
        : buildDefaultAvatarUrl(actor.username || actor.id);

    return NextResponse.json({
      actor: {
        id: actor.id,
        email: actor.email,
        displayName: actor.display_name,
        role: actor.role,
        avatarUrl: actorAvatar
      },
      stats,
      users: filteredUsers,
      auditLogs
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load admin overview.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
