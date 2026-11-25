import { NextResponse } from 'next/server';
import { findAccountByEmail, requireDbPool } from '@/backend/auth/turso-auth';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const pool = await requireDbPool();
    const account = await findAccountByEmail(pool, email);

    return NextResponse.json({
      ok: true,
      exists: Boolean(account),
      hasPassword: Boolean(account?.password_hash),
      emailVerified: Boolean(account?.email_verified),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check email.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
