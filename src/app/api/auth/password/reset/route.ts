import { NextResponse } from 'next/server';
import { verifyEmailOtp } from '@/backend/auth/otp';
import {
  createAccountSession,
  findAccountByEmail,
  requireDbPool,
  revokeAllSessionsForAccount,
} from '@/backend/auth/turso-auth';
import { buildDefaultAvatarUrl } from '@/lib/avatar';
import { hashPassword } from '@/lib/security/crypto';
import { getClientIp } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: unknown;
      code?: unknown;
      newPassword?: unknown;
    };

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      return NextResponse.json(
        { error: 'New password must be between 8 and 128 characters.' },
        { status: 400 }
      );
    }

    const pool = await requireDbPool();
    const account = await findAccountByEmail(pool, email);
    if (!account) {
      return NextResponse.json(
        { error: 'Invalid or expired reset code.' },
        { status: 400 }
      );
    }

    const verdict = await verifyEmailOtp(pool, email, code, 'reset');
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: verdict.status });
    }

    const passwordHash = await hashPassword(newPassword);
    const nowIso = new Date().toISOString();

    await pool.exec(
      'UPDATE accounts SET password_hash = ?, email_verified = 1, updated_at = ? WHERE id = ?',
      [passwordHash, nowIso, account.id]
    );

    await revokeAllSessionsForAccount(pool, account.id);

    const { cookieHeader } = await createAccountSession(
      pool,
      account,
      { userAgent: req.headers.get('user-agent'), ip: getClientIp(req), rememberMe: true }
    );

    const res = NextResponse.json({
      ok: true,
      account: {
        id: account.id,
        email: account.email,
        displayName: account.display_name,
        avatarUrl: account.avatar_url || buildDefaultAvatarUrl(account.id),
        plan: account.plan,
      },
    });
    res.headers.append('set-cookie', cookieHeader);
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Password reset failed.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
