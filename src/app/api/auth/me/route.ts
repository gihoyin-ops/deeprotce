import { NextResponse } from 'next/server';
import { ensureTursoSchema } from '@/backend/db/connection';
import { isSessionActiveInDb, requireDbPool, type AccountRow } from '@/backend/auth/turso-auth';
import { buildDefaultAvatarUrl, isLegacyDefaultAvatar, normalizeUsername } from '@/lib/avatar';
import {
  clearAccountSessionCookie,
  getVerifiedAccount,
  issueAccountSessionCookie
} from '@/lib/security/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ authenticated: false, guest: true });
  }

  let dbAccount: Pick<
    AccountRow,
    'id' | 'email' | 'username' | 'display_name' | 'avatar_url' | 'plan'
  > | null = null;

  try {
    const pool = await ensureTursoSchema();
    if (pool) {
      const active = await isSessionActiveInDb(pool, verified.sid);
      if (!active) {
        const res = NextResponse.json({ authenticated: false, guest: true });
        res.headers.append('set-cookie', clearAccountSessionCookie());
        return res;
      }

      const rows = await pool.query<
        Pick<AccountRow, 'id' | 'email' | 'username' | 'display_name' | 'avatar_url' | 'plan'>
      >(
        'SELECT id, email, username, display_name, avatar_url, plan FROM accounts WHERE id = ? LIMIT 1',
        [verified.sub]
      );
      dbAccount = rows[0] ?? null;
    }
  } catch {
    // If DB check fails transiently, fall back to cryptographically verified claims
  }

  const displayName = dbAccount?.display_name || verified.name;
  const username = dbAccount?.username ?? null;
  const rawAvatar = dbAccount?.avatar_url;
  const avatarUrl =
    rawAvatar && !isLegacyDefaultAvatar(rawAvatar)
      ? rawAvatar
      : buildDefaultAvatarUrl(username || dbAccount?.id || verified.sub);

  return NextResponse.json({
    authenticated: true,
    guest: false,
    account: {
      id: verified.sub,
      email: dbAccount?.email || verified.email,
      displayName,
      username,
      avatarUrl,
      plan: dbAccount?.plan || verified.plan,
      needsOnboarding: dbAccount ? !dbAccount.username : false
    }
  });
}

export async function PATCH(req: Request) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      displayName?: unknown;
      username?: unknown;
      avatarUrl?: unknown;
    };

    const pool = await requireDbPool();
    const active = await isSessionActiveInDb(pool, verified.sid);
    if (!active) {
      const res = NextResponse.json({ error: 'Session expired.' }, { status: 401 });
      res.headers.append('set-cookie', clearAccountSessionCookie());
      return res;
    }

    const rows = await pool.query<
      Pick<AccountRow, 'id' | 'email' | 'username' | 'display_name' | 'avatar_url' | 'plan'>
    >(
      'SELECT id, email, username, display_name, avatar_url, plan FROM accounts WHERE id = ? LIMIT 1',
      [verified.sub]
    );
    const current = rows[0];
    if (!current) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    let nextDisplayName = current.display_name;
    if (typeof body.displayName === 'string') {
      const trimmed = body.displayName.trim();
      if (!trimmed) {
        return NextResponse.json({ error: 'Display name cannot be empty.' }, { status: 400 });
      }
      nextDisplayName = trimmed.slice(0, 64);
    }

    let nextUsername = current.username;
    if (typeof body.username === 'string') {
      const normalized = normalizeUsername(body.username);
      if (normalized.length < 3) {
        return NextResponse.json(
          { error: 'Username must be at least 3 characters (letters, numbers, _, ., -).' },
          { status: 400 }
        );
      }
      const existing = await pool.query<{ id: string }>(
        'SELECT id FROM accounts WHERE username = ? AND id != ? LIMIT 1',
        [normalized, current.id]
      );
      if (existing.length > 0) {
        return NextResponse.json(
          { error: 'That username is already taken. Try another one.' },
          { status: 409 }
        );
      }
      nextUsername = normalized;
    }

    let nextAvatarUrl =
      current.avatar_url && !isLegacyDefaultAvatar(current.avatar_url)
        ? current.avatar_url
        : buildDefaultAvatarUrl(nextUsername || current.id);

    if (typeof body.avatarUrl === 'string') {
      const trimmedAvatar = body.avatarUrl.trim();
      if (
        trimmedAvatar &&
        trimmedAvatar.length <= 524_288 &&
        (trimmedAvatar.startsWith('https://') ||
          trimmedAvatar.startsWith('/') ||
          trimmedAvatar.startsWith('data:image/'))
      ) {
        nextAvatarUrl = trimmedAvatar;
      }
    }

    const nowIso = new Date().toISOString();
    await pool.exec(
      'UPDATE accounts SET display_name = ?, username = ?, avatar_url = ?, updated_at = ? WHERE id = ?',
      [nextDisplayName, nextUsername, nextAvatarUrl, nowIso, current.id]
    );

    const cookieHeader = issueAccountSessionCookie({
      sub: current.id,
      sid: verified.sid,
      email: current.email,
      plan: current.plan,
      name: nextDisplayName
    });

    const res = NextResponse.json({
      ok: true,
      account: {
        id: current.id,
        email: current.email,
        displayName: nextDisplayName,
        username: nextUsername,
        avatarUrl: nextAvatarUrl,
        plan: current.plan,
        needsOnboarding: !nextUsername
      }
    });
    res.headers.append('set-cookie', cookieHeader);
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
