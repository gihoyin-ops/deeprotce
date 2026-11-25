import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAccountSession, findAccountByEmail, requireDbPool } from '@/backend/auth/turso-auth';
import { buildDefaultAvatarUrl } from '@/lib/avatar';
import { hashPassword } from '@/lib/security/crypto';
import { getClientIp } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: unknown;
      password?: unknown;
      displayName?: unknown;
    };

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const rawName = typeof body.displayName === 'string' ? body.displayName.trim() : '';

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: 'Password must be between 8 and 128 characters.' },
        { status: 400 }
      );
    }

    const pool = await requireDbPool();
    const existing = await findAccountByEmail(pool, email);
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    const accountId = crypto.randomUUID();
    const displayName = (rawName || email.split('@')[0] || 'User').slice(0, 64);
    const avatarUrl = buildDefaultAvatarUrl(accountId);
    const passwordHash = await hashPassword(password);
    const nowIso = new Date().toISOString();

    await pool.exec(
      `INSERT INTO accounts (id, email, username, password_hash, display_name, avatar_url, plan, email_verified, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, 'free', 0, ?, ?)`,
      [accountId, email, passwordHash, displayName, avatarUrl, nowIso, nowIso]
    );

    await pool.exec(
      `INSERT INTO plan_grants (id, account_id, plan, granted_by, valid_from, valid_until)
       VALUES (?, ?, 'free', 'self', ?, NULL)`,
      [crypto.randomUUID(), accountId, nowIso]
    );

    const { cookieHeader } = await createAccountSession(
      pool,
      { id: accountId, email, plan: 'free', display_name: displayName },
      { userAgent: req.headers.get('user-agent'), ip: getClientIp(req) }
    );

    const res = NextResponse.json(
      {
        ok: true,
        account: {
          id: accountId,
          email,
          displayName,
          avatarUrl,
          plan: 'free'
        }
      },
      { status: 201 }
    );
    res.headers.append('set-cookie', cookieHeader);
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
