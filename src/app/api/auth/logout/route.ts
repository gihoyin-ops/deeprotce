import { NextResponse } from 'next/server';
import { getDbPool } from '@/backend/db/connection';
import { revokeSessionById } from '@/backend/db/account-session';
import { clearAllAccountSessionCookies, getAllVerifiedAccounts } from '@/lib/security/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const requestHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const verifiedList = getAllVerifiedAccounts(req.headers);

  if (verifiedList.length > 0) {
    try {
      const pool = getDbPool();
      if (pool) {
        await Promise.all(
          verifiedList.map(v => revokeSessionById(pool, v.sid).catch(() => undefined))
        );
      }
    } catch {
      // Nuke the cookie anyway even if DB cleanup craps out
    }
  }

  const res = NextResponse.json({ ok: true });
  for (const cookie of clearAllAccountSessionCookies(requestHost)) {
    res.headers.append('set-cookie', cookie);
  }
  return res;
}
