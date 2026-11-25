import { NextResponse } from 'next/server';
import { sendOtpEmail } from '@/backend/auth/email';
import { issueEmailOtp, OTP_TTL_MS } from '@/backend/auth/otp';
import { requireDbPool } from '@/backend/auth/turso-auth';

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
    const { code, resendAfterSeconds, retryAfterSeconds } = await issueEmailOtp(pool, email, 'auth');

    if (retryAfterSeconds !== undefined) {
      return NextResponse.json(
        {
          error: `Please wait ${retryAfterSeconds}s before requesting another code.`,
          retryAfterSeconds
        },
        {
          status: 429,
          headers: { 'retry-after': String(retryAfterSeconds) }
        }
      );
    }

    await sendOtpEmail({
      toEmail: email,
      code,
      expiresMinutes: Math.round(OTP_TTL_MS / 60_000)
    });

    return NextResponse.json({
      ok: true,
      expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
      resendAfterSeconds
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send verification code.';
    const status = message.includes('Database is not configured') || message.includes('not configured')
      ? 503
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
