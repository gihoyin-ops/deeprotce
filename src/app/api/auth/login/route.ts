import { NextResponse } from 'next/server';
import { createAccountSession, findAccountByEmail, requireDbPool } from '@/backend/auth/turso-auth';
import { buildDefaultAvatarUrl } from '@/lib/avatar';
import { verifyPassword } from '@/lib/security/crypto';
import { getClientIp } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: unknown;
      password?: unknown;
    };

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const pool = await requireDbPool();
    const account = await findAccountByEmail(pool, email);

    if (!account || !account.password_hash) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const valid = await verifyPassword(password, account.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
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
    const message = error instanceof Error ? error.message : 'Login failed';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
