import { NextResponse } from 'next/server';
import { ensureTursoSchema } from '@/backend/db/connection';
import { getAccountProfileAndStats } from '@/backend/profile/stats';
import { getVerifiedAccount } from '@/lib/security/auth';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  context: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await context.params;
    const pool = await ensureTursoSchema();
    if (!pool) {
      return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
    }

    const verified = getVerifiedAccount(req.headers);
    const result = await getAccountProfileAndStats(
      pool,
      decodeURIComponent(username),
      verified?.sub ?? null
    );

    if (!result.found) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
