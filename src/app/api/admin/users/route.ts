import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { recordAdminAudit, requireAdminActor } from '@/backend/admin/guard';
import { buildDefaultAvatarUrl, normalizeUsername } from '@/lib/avatar';
import { hashPassword } from '@/lib/security/crypto';
import { parsePlan, type PlanId } from '@/lib/security/plans';
import { parseRole, type AccountRole } from '@/lib/security/roles';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ADMIN_PLANS = new Set<PlanId>(['free', 'supporters', 'cool']);

const sanitizeAvatarInput = (raw: unknown, fallbackSeed: string): string => {
  if (typeof raw !== 'string') return buildDefaultAvatarUrl(fallbackSeed);
  const trimmed = raw.trim();
  if (!trimmed) return buildDefaultAvatarUrl(fallbackSeed);
  if (
    trimmed.length <= 524_288 &&
    (trimmed.startsWith('https://') ||
      trimmed.startsWith('/') ||
      trimmed.startsWith('data:image/'))
  ) {
    return trimmed;
  }
  return buildDefaultAvatarUrl(fallbackSeed);
};

export async function POST(req: Request) {
  const auth = await requireAdminActor(req, {
    requireManager: true,
    checkSameOrigin: true
  });
  if (!auth.ok) return auth.response;

  const { pool, actor } = auth;

  try {
    const body = (await req.json()) as {
      email?: unknown;
      username?: unknown;
      displayName?: unknown;
      password?: unknown;
      avatarUrl?: unknown;
      plan?: unknown;
      role?: unknown;
      reason?: unknown;
    };

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const rawUsername = typeof body.username === 'string' ? body.username : '';
    const username = normalizeUsername(rawUsername);
    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters (letters, numbers, _, ., -).' },
        { status: 400 }
      );
    }

    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: 'Password must be between 8 and 128 characters.' },
        { status: 400 }
      );
    }

    const displayName =
      typeof body.displayName === 'string' && body.displayName.trim()
        ? body.displayName.trim().slice(0, 64)
        : username;

    const parsedPlan = parsePlan(body.plan ?? 'free') ?? 'free';
    const plan: PlanId = ALLOWED_ADMIN_PLANS.has(parsedPlan) ? parsedPlan : 'free';

    const role: AccountRole = parseRole(body.role ?? 'user') ?? 'user';
    const reason =
      typeof body.reason === 'string' && body.reason.trim().length >= 3
        ? body.reason.trim().slice(0, 500)
        : `Created ${role} account via Admin Panel`;

    const existingEmail = await pool.query<{ id: string }>(
      'SELECT id FROM accounts WHERE LOWER(email) = ? LIMIT 1',
      [email]
    );
    if (existingEmail.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const existingUsername = await pool.query<{ id: string }>(
      'SELECT id FROM accounts WHERE LOWER(username) = LOWER(?) LIMIT 1',
      [username]
    );
    if (existingUsername.length > 0) {
      return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
    }

    const accountId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const avatarUrl = sanitizeAvatarInput(body.avatarUrl, username || accountId);
    const nowIso = new Date().toISOString();

    await pool.exec(
      `INSERT INTO accounts
         (id, email, username, password_hash, display_name, avatar_url, plan, role, is_banned, email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`,
      [accountId, email, username, passwordHash, displayName, avatarUrl, plan, role, nowIso, nowIso]
    );

    await pool.exec(
      `INSERT INTO plan_grants (id, account_id, plan, granted_by, valid_from, valid_until)
       VALUES (?, ?, ?, 'admin', ?, NULL)`,
      [crypto.randomUUID(), accountId, plan, nowIso]
    );

    await recordAdminAudit(pool, {
      actor,
      action: 'create_user',
      targetAccountId: accountId,
      targetEmail: email,
      reason,
      metadata: { plan, role, username }
    });

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: accountId,
          email,
          username,
          displayName,
          avatarUrl,
          plan,
          role,
          isBanned: false,
          banReason: null,
          bannedAt: null,
          createdAt: nowIso,
          updatedAt: nowIso,
          activeSessions: 0
        }
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create user.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
