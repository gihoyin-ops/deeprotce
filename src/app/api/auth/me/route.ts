import { NextResponse } from 'next/server';
import { ensureTursoSchema } from '@/backend/db/connection';
import { isSessionActiveInDb } from '@/backend/auth/turso-auth';
import { buildDefaultAvatarUrl } from '@/lib/avatar';
import { clearAccountSessionCookie, getVerifiedAccount } from '@/lib/security/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ authenticated: false, guest: true });
  }

  try {
    const pool = await ensureTursoSchema();
    if (pool) {
      const active = await isSessionActiveInDb(pool, verified.sid);
      if (!active) {
        const res = NextResponse.json({ authenticated: false, guest: true });
        res.headers.append('set-cookie', clearAccountSessionCookie());
        return res;
      }
    }
  } catch {
    // If DB check fails transiently, fall back to cryptographically verified claims
  }

  return NextResponse.json({
    authenticated: true,
    guest: false,
    account: {
      id: verified.sub,
      email: verified.email,
      displayName: verified.name,
      avatarUrl: buildDefaultAvatarUrl(verified.sub),
      plan: verified.plan
    }
  });
}
