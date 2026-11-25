import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { verifyEmailOtp } from '@/backend/auth/otp';
import { createAccountSession, findAccountByEmail, requireDbPool } from '@/backend/auth/turso-auth';
import { buildDefaultAvatarUrl } from '@/lib/avatar';
import { getClientIp } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: unknown;
      code?: unknown;
      displayName?: unknown;
    };

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const rawName = typeof body.displayName === 'string' ? body.displayName.trim() : '';

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const pool = await requireDbPool();
    const verdict = await verifyEmailOtp(pool, email, code, 'auth');
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: verdict.status });
    }

    let account = await findAccountByEmail(pool, email);
    const nowIso = new Date().toISOString();

    if (!account) {
      const accountId = crypto.randomUUID();
      const displayName = (rawName || email.split('@')[0] || 'User').slice(0, 64);
      const avatarUrl = buildDefaultAvatarUrl(accountId);

      await pool.exec(
        `INSERT INTO accounts (id, email, username, password_hash, display_name, avatar_url, plan, email_verified, created_at, updated_at)
         VALUES (?, ?, NULL, NULL, ?, ?, 'free', 1, ?, ?)`,
        [accountId, email, displayName, avatarUrl, nowIso, nowIso]
      );

      await pool.exec(
        `INSERT INTO plan_grants (id, account_id, plan, granted_by, valid_from, valid_until)
         VALUES (?, ?, 'free', 'self', ?, NULL)`,
        [crypto.randomUUID(), accountId, nowIso]
      );

      account = {
        id: accountId,
        email,
        username: null,
        password_hash: null,
        display_name: displayName,
        avatar_url: avatarUrl,
        plan: 'free',
        email_verified: 1,
        created_at: nowIso,
        updated_at: nowIso
      };
    } else if (!account.email_verified) {
      const nextAvatar = account.avatar_url || buildDefaultAvatarUrl(account.id);
      await pool.exec(
        'UPDATE accounts SET email_verified = 1, avatar_url = ?, updated_at = ? WHERE id = ?',
        [nextAvatar, nowIso, account.id]
      );
      account.avatar_url = nextAvatar;
    }

    const { cookieHeader } = await createAccountSession(
      pool,
      account,
      { userAgent: req.headers.get('user-agent'), ip: getClientIp(req) }
    );

    const res = NextResponse.json({
      ok: true,
      account: {
        id: account.id,
        email: account.email,
        displayName: account.display_name,
        avatarUrl: account.avatar_url || buildDefaultAvatarUrl(account.id),
        plan: account.plan
      }
    });
    res.headers.append('set-cookie', cookieHeader);
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
