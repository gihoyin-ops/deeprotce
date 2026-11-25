import { NextResponse } from 'next/server';
import { ensureTursoSchema } from '@/backend/db/connection';
import { revokeSessionById } from '@/backend/auth/turso-auth';
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
      // Clear cookie even if DB cleanup fails
    }
  }

  const res = NextResponse.json({ ok: true });
  res.headers.append('set-cookie', clearAccountSessionCookie());
  return res;
}
