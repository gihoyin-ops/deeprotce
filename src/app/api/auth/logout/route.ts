import { NextResponse } from 'next/server';
import { ensureTursoSchema } from '@/backend/db/connection';
import { revokeSessionById } from '@/backend/db/account-session';
import { clearAccountSessionCookie, getVerifiedAccount } from '@/lib/security/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const verified = getVerifiedAccount(req.headers);

  if (verified) {
    try {
      const pool = await ensureTursoSchema();
      if (pool) {
        await revokeSessionById(pool, verified.sid);
      }
    } catch {
      // Nuke the cookie anyway even if DB cleanup craps out
    }
  }

  const res = NextResponse.json({ ok: true });
  res.headers.append('set-cookie', clearAccountSessionCookie());
  return res;
}
