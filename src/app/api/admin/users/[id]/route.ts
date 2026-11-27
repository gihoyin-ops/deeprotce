import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { recordAdminAudit, requireAdminActor } from '@/backend/admin/guard';
import { revokeAllSessionsForAccount } from '@/backend/db/account-session';
import { deleteFromR2, isR2Configured } from '@/backend/storage/r2';
import { parsePlan, type PlanId } from '@/lib/security/plans';
import { isManagerStaffRole, parseRole } from '@/lib/security/roles';

export const runtime = 'nodejs';

const ALLOWED_ADMIN_PLANS = new Set<PlanId>(['free', 'supporters', 'cool']);

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminActor(req, { checkSameOrigin: true });
  if (!auth.ok) return auth.response;

  const { pool, actor } = auth;
  const { id: targetId } = await context.params;

  if (!targetId) {
    return NextResponse.json({ error: 'Target user ID is required.' }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      action?: unknown;
      plan?: unknown;
      role?: unknown;
      reason?: unknown;
      mode?: unknown;
      days?: unknown;
      validUntil?: unknown;
    };

    const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    const targets = await pool.query<{
      id: string;
      email: string;
      username: string | null;
      plan: string;
      role: string;
      is_banned: number;
    }>(
      'SELECT id, email, username, plan, role, is_banned FROM accounts WHERE id = ? LIMIT 1',
      [targetId]
    );
    const target = targets[0];
    if (!target) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const targetRole = parseRole(target.role) ?? 'user';
    const isManager = isManagerStaffRole(actor.role);
    const nowIso = new Date().toISOString();

    if (action === 'update_plan') {
      if (!isManager && targetRole !== 'user') {
        return NextResponse.json(
          { error: 'Only Manager Staff can modify staff plans.' },
          { status: 403 }
        );
      }

      const parsedPlan = parsePlan(body.plan);
      if (!parsedPlan || !ALLOWED_ADMIN_PLANS.has(parsedPlan)) {
        return NextResponse.json({ error: 'Invalid plan selected.' }, { status: 400 });
      }

      const auditReason = reason.length >= 4 ? reason : `Changed plan from ${target.plan} to ${parsedPlan}`;

      await pool.exec('UPDATE accounts SET plan = ?, updated_at = ? WHERE id = ?', [
        parsedPlan,
        nowIso,
        target.id
      ]);
      await pool.exec(
        `INSERT INTO plan_grants (id, account_id, plan, granted_by, valid_from, valid_until)
         VALUES (?, ?, ?, 'admin', ?, NULL)`,
        [crypto.randomUUID(), target.id, parsedPlan, nowIso]
      );

      await recordAdminAudit(pool, {
        actor,
        action: 'update_plan',
        targetAccountId: target.id,
        targetEmail: target.email,
        reason: auditReason,
        metadata: { fromPlan: target.plan, toPlan: parsedPlan }
      });

      return NextResponse.json({ ok: true, plan: parsedPlan });
    }

    if (action === 'update_subscription') {
      if (!isManager && targetRole !== 'user') {
        return NextResponse.json(
          { error: 'Only Manager Staff can modify staff subscriptions.' },
          { status: 403 }
        );
      }

      const mode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : '';
      if (!['extend_days', 'shorten_days', 'set_date', 'lifetime', 'revoke'].includes(mode)) {
        return NextResponse.json({ error: 'Invalid subscription adjustment mode.' }, { status: 400 });
      }
      if (reason.length < 4) {
        return NextResponse.json(
          { error: 'Please provide a reason (at least 4 characters).' },
          { status: 400 }
        );
      }

      const latestGrants = await pool.query<{
        id: string;
        plan: string;
        valid_until: string | null;
      }>(
        'SELECT id, plan, valid_until FROM plan_grants WHERE account_id = ? ORDER BY valid_from DESC LIMIT 1',
        [target.id]
      );
      const latestGrant = latestGrants[0] ?? null;

      if (mode === 'revoke') {
        await pool.exec('UPDATE accounts SET plan = ?, updated_at = ? WHERE id = ?', [
          'free',
          nowIso,
          target.id
        ]);
        if (latestGrant) {
          await pool.exec('UPDATE plan_grants SET valid_until = ? WHERE id = ?', [
            nowIso,
            latestGrant.id
          ]);
        }
        await pool.exec(
          `INSERT INTO plan_grants (id, account_id, plan, granted_by, valid_from, valid_until)
           VALUES (?, ?, 'free', 'admin', ?, NULL)`,
          [crypto.randomUUID(), target.id, nowIso]
        );
        await recordAdminAudit(pool, {
          actor,
          action: 'revoke_subscription',
          targetAccountId: target.id,
          targetEmail: target.email,
          reason,
          metadata: { fromPlan: target.plan, previousValidUntil: latestGrant?.valid_until ?? null }
        });
        return NextResponse.json({ ok: true, plan: 'free', validUntil: null });
      }

      const currentExpiryMs =
        latestGrant?.valid_until && !Number.isNaN(Date.parse(latestGrant.valid_until))
          ? Date.parse(latestGrant.valid_until)
          : null;
      const nowMs = Date.now();
      let nextValidUntil: string | null = null;

      if (mode === 'lifetime') {
        nextValidUntil = null;
      } else if (mode === 'extend_days' || mode === 'shorten_days') {
        const rawDays = Number(body.days);
        if (!Number.isFinite(rawDays) || rawDays <= 0 || rawDays > 3650) {
          return NextResponse.json({ error: 'Days must be between 1 and 3650.' }, { status: 400 });
        }
        const deltaMs = Math.round(rawDays) * 24 * 60 * 60 * 1000;
        const baseMs =
          mode === 'extend_days'
            ? currentExpiryMs && currentExpiryMs > nowMs
              ? currentExpiryMs
              : nowMs
            : currentExpiryMs ?? nowMs;
        const computedMs = mode === 'extend_days' ? baseMs + deltaMs : Math.max(nowMs, baseMs - deltaMs);
        nextValidUntil = new Date(computedMs).toISOString();
      } else if (mode === 'set_date') {
        const rawDate = typeof body.validUntil === 'string' ? body.validUntil.trim() : '';
        const parsedMs = Date.parse(rawDate);
        if (!rawDate || Number.isNaN(parsedMs)) {
          return NextResponse.json({ error: 'Valid expiration date is required.' }, { status: 400 });
        }
        nextValidUntil = new Date(parsedMs).toISOString();
      }

      const activePlan =
        target.plan === 'supporters' || target.plan === 'cool' ? target.plan : 'supporters';
      if (target.plan !== activePlan) {
        await pool.exec('UPDATE accounts SET plan = ?, updated_at = ? WHERE id = ?', [
          activePlan,
          nowIso,
          target.id
        ]);
      }

      if (latestGrant) {
        await pool.exec('UPDATE plan_grants SET valid_until = ?, plan = ? WHERE id = ?', [
          nextValidUntil,
          activePlan,
          latestGrant.id
        ]);
      } else {
        await pool.exec(
          `INSERT INTO plan_grants (id, account_id, plan, granted_by, valid_from, valid_until)
           VALUES (?, ?, ?, 'admin', ?, ?)`,
          [crypto.randomUUID(), target.id, activePlan, nowIso, nextValidUntil]
        );
      }

      await recordAdminAudit(pool, {
        actor,
        action: 'update_subscription',
        targetAccountId: target.id,
        targetEmail: target.email,
        reason,
        metadata: {
          mode,
          plan: activePlan,
          fromValidUntil: latestGrant?.valid_until ?? null,
          toValidUntil: nextValidUntil
        }
      });

      return NextResponse.json({ ok: true, plan: activePlan, validUntil: nextValidUntil });
    }

    // Everything below requires Manager Staff, no exceptions
    if (!isManager) {
      return NextResponse.json(
        { error: 'Manager Staff authority required for this action.' },
        { status: 403 }
      );
    }

    if (action === 'update_role') {
      const nextRole = parseRole(body.role);
      if (!nextRole) {
        return NextResponse.json({ error: 'Invalid role selected.' }, { status: 400 });
      }
      if (target.id === actor.id && nextRole !== 'manager_staff') {
        return NextResponse.json(
          { error: 'You cannot demote your own Manager Staff account.' },
          { status: 400 }
        );
      }
      if (reason.length < 4) {
        return NextResponse.json(
          { error: 'Please provide a reason (at least 4 characters).' },
          { status: 400 }
        );
      }

      await pool.exec('UPDATE accounts SET role = ?, updated_at = ? WHERE id = ?', [
        nextRole,
        nowIso,
        target.id
      ]);

      await recordAdminAudit(pool, {
        actor,
        action: 'update_role',
        targetAccountId: target.id,
        targetEmail: target.email,
        reason,
        metadata: { fromRole: targetRole, toRole: nextRole }
      });

      return NextResponse.json({ ok: true, role: nextRole });
    }

    if (action === 'ban') {
      if (target.id === actor.id) {
        return NextResponse.json({ error: 'You cannot ban your own account.' }, { status: 400 });
      }
      if (reason.length < 5) {
        return NextResponse.json(
          { error: 'Ban reason is required (at least 5 characters).' },
          { status: 400 }
        );
      }

      await pool.exec(
        `UPDATE accounts
         SET is_banned = 1, ban_reason = ?, banned_at = ?, banned_by = ?, updated_at = ?
         WHERE id = ?`,
        [reason.slice(0, 500), nowIso, actor.id, nowIso, target.id]
      );

      // Kill all active sessions for the banned dumbass immediately
      await revokeAllSessionsForAccount(pool, target.id);

      await recordAdminAudit(pool, {
        actor,
        action: 'ban_user',
        targetAccountId: target.id,
        targetEmail: target.email,
        reason,
        metadata: { targetRole }
      });

      return NextResponse.json({ ok: true, isBanned: true, banReason: reason, bannedAt: nowIso });
    }

    if (action === 'unban') {
      if (reason.length < 4) {
        return NextResponse.json(
          { error: 'Unban reason is required (at least 4 characters).' },
          { status: 400 }
        );
      }

      await pool.exec(
        `UPDATE accounts
         SET is_banned = 0, ban_reason = NULL, banned_at = NULL, banned_by = NULL, updated_at = ?
         WHERE id = ?`,
        [nowIso, target.id]
      );

      await recordAdminAudit(pool, {
        actor,
        action: 'unban_user',
        targetAccountId: target.id,
        targetEmail: target.email,
        reason
      });

      return NextResponse.json({ ok: true, isBanned: false });
    }

    if (action === 'revoke_sessions') {
      if (target.id === actor.id) {
        return NextResponse.json(
          { error: 'Use Sign out to end your own session.' },
          { status: 400 }
        );
      }

      await revokeAllSessionsForAccount(pool, target.id);

      await recordAdminAudit(pool, {
        actor,
        action: 'revoke_sessions',
        targetAccountId: target.id,
        targetEmail: target.email,
        reason: reason.length >= 4 ? reason : 'Forced session revocation by Manager Staff'
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported admin action.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Admin update failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminActor(req, {
    requireManager: true,
    checkSameOrigin: true
  });
  if (!auth.ok) return auth.response;

  const { pool, actor } = auth;
  const { id: targetId } = await context.params;

  if (!targetId) {
    return NextResponse.json({ error: 'Target user ID is required.' }, { status: 400 });
  }

  if (targetId === actor.id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  try {
    let reason = '';
    try {
      const body = (await req.json()) as { reason?: unknown };
      reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    } catch {
      reason = '';
    }

    if (reason.length < 5) {
      return NextResponse.json(
        { error: 'Deletion reason is required (at least 5 characters).' },
        { status: 400 }
      );
    }

    const targets = await pool.query<{
      id: string;
      email: string;
      username: string | null;
      role: string;
    }>('SELECT id, email, username, role FROM accounts WHERE id = ? LIMIT 1', [targetId]);
    const target = targets[0];
    if (!target) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (isR2Configured()) {
      const itemRows = await pool.query<{ r2_key: string }>(
        'SELECT r2_key FROM library_items WHERE account_id = ?',
        [target.id]
      );
      const keysToDelete = itemRows.map(r => r.r2_key).filter(Boolean);
      if (target.username) {
        keysToDelete.push(`u/profile/${target.username}.webp`);
      }
      await Promise.all(keysToDelete.map(k => deleteFromR2(k).catch(() => undefined)));
    }

    await pool.exec('DELETE FROM accounts WHERE id = ?', [target.id]);

    await recordAdminAudit(pool, {
      actor,
      action: 'delete_user',
      targetAccountId: target.id,
      targetEmail: target.email,
      reason,
      metadata: { deletedRole: target.role, username: target.username }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete user.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
