import { NextResponse } from 'next/server';
import { ensureTursoSchema } from '@/backend/db/connection';
import { isSessionActiveInDb, requireDbPool, type AccountRow } from '@/backend/db/account-session';
import { deleteFromR2, isR2Configured } from '@/backend/storage/r2';
import { getAuthBaseUrl } from '@/lib/auth/auth-url';
import { buildDefaultAvatarUrl, isLegacyDefaultAvatar, normalizeUsername } from '@/lib/avatar';
import {
  ACCOUNT_COOKIE_NAME,
  clearAccountSessionCookie,
  getCookieValue,
  getVerifiedAccount,
  issueAccountSessionCookie
} from '@/lib/security/auth';

export const runtime = 'nodejs';

async function fetchCentralAuthFallback(rawAccountCookie: string | null) {
  if (!rawAccountCookie) return null;
  try {
    const authBase = getAuthBaseUrl();
    const res = await fetch(`${authBase}/api/auth/me`, {
      method: 'GET',
      headers: {
        cookie: `${ACCOUNT_COOKIE_NAME}=${rawAccountCookie}`,
        origin: authBase
      },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      authenticated?: boolean;
      account?: Record<string, unknown>;
    };
    if (data?.authenticated && data.account) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const rawAccountCookie = getCookieValue(req.headers, ACCOUNT_COOKIE_NAME);
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    const central = await fetchCentralAuthFallback(rawAccountCookie);
    if (central) {
      return NextResponse.json(central);
    }
    return NextResponse.json({
      authenticated: false,
      guest: true,
      reason: rawAccountCookie ? 'invalid_token' : 'no_cookie'
    });
  }

  let dbAccount: Pick<
    AccountRow,
    'id' | 'email' | 'username' | 'display_name' | 'avatar_url' | 'plan' | 'role' | 'is_banned'
  > | null = null;

  try {
    const pool = await ensureTursoSchema();
    if (pool) {
      const active = await isSessionActiveInDb(pool, verified.sid);
      if (!active) {
        const central = await fetchCentralAuthFallback(rawAccountCookie);
        if (central) {
          return NextResponse.json(central);
        }
        return NextResponse.json({
          authenticated: false,
          guest: true,
          reason: 'session_inactive'
        });
      }

      const rows = await pool.query<
        Pick<
          AccountRow,
          'id' | 'email' | 'username' | 'display_name' | 'avatar_url' | 'plan' | 'role' | 'is_banned'
        >
      >(
        'SELECT id, email, username, display_name, avatar_url, plan, role, is_banned FROM accounts WHERE id = ? LIMIT 1',
        [verified.sub]
      );
      dbAccount = rows[0] ?? null;
      if (dbAccount && Number(dbAccount.is_banned) === 1) {
        const res = NextResponse.json({ authenticated: false, guest: true, banned: true });
        res.headers.append('set-cookie', clearAccountSessionCookie());
        return res;
      }
    }
  } catch {
    // DB crapped out transiently, fall back to the cryptographically verified claims
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
      role: dbAccount?.role || verified.role || 'user',
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
      isPublic?: unknown;
    };

    const pool = await requireDbPool();
    const active = await isSessionActiveInDb(pool, verified.sid);
    if (!active) {
      const res = NextResponse.json({ error: 'Session expired.' }, { status: 401 });
      res.headers.append('set-cookie', clearAccountSessionCookie());
      return res;
    }

    const rows = await pool.query<
      Pick<AccountRow, 'id' | 'email' | 'username' | 'display_name' | 'avatar_url' | 'plan' | 'role'>
    >(
      'SELECT id, email, username, display_name, avatar_url, plan, role FROM accounts WHERE id = ? LIMIT 1',
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
        'SELECT id FROM accounts WHERE LOWER(username) = LOWER(?) AND id != ? LIMIT 1',
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

    let nextIsPublic: boolean | undefined;
    if (typeof body.isPublic === 'boolean') {
      nextIsPublic = body.isPublic;
      await pool.exec(
        `INSERT INTO user_profile_settings (account_id, is_public, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(account_id) DO UPDATE SET
           is_public = excluded.is_public,
           updated_at = excluded.updated_at`,
        [current.id, nextIsPublic ? 1 : 0, nowIso]
      );
    }

    const cookieHeader = issueAccountSessionCookie({
      sub: current.id,
      sid: verified.sid,
      email: current.email,
      plan: current.plan,
      role: current.role ?? 'user',
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
        role: current.role ?? 'user',
        ...(typeof nextIsPublic === 'boolean' ? { isPublic: nextIsPublic } : {}),
        needsOnboarding: !nextUsername
      }
    });
    res.headers.append('set-cookie', cookieHeader);
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile.';
    if (/unique/i.test(message) && /username/i.test(message)) {
      return NextResponse.json(
        { error: 'That username is already taken. Try another one.' },
        { status: 409 }
      );
    }
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const pool = await requireDbPool();
    const active = await isSessionActiveInDb(pool, verified.sid);
    if (!active) {
      const res = NextResponse.json({ error: 'Session expired.' }, { status: 401 });
      res.headers.append('set-cookie', clearAccountSessionCookie());
      return res;
    }

    if (isR2Configured()) {
      const [itemRows, accRows] = await Promise.all([
        pool.query<{ r2_key: string }>('SELECT r2_key FROM library_items WHERE account_id = ?', [
          verified.sub
        ]),
        pool.query<{ username: string | null }>('SELECT username FROM accounts WHERE id = ? LIMIT 1', [
          verified.sub
        ])
      ]);

      const keysToDelete = itemRows.map(r => r.r2_key).filter(Boolean);
      const handle = accRows[0]?.username;
      if (handle) {
        keysToDelete.push(`u/profile/${handle}.webp`);
      }

      await Promise.all(keysToDelete.map(k => deleteFromR2(k).catch(() => undefined)));
    }

    await pool.exec('DELETE FROM accounts WHERE id = ?', [verified.sub]);

    const res = NextResponse.json({ ok: true });
    res.headers.append('set-cookie', clearAccountSessionCookie());
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete account.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
