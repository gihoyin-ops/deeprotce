import { NextResponse } from 'next/server';
import { ensureTursoSchema, getDbPool } from '@/backend/db/connection';
import {
  isSessionActiveInDb,
  requireDbPool,
  revokeSessionById,
  type AccountRow
} from '@/backend/db/account-session';
import { deleteFromR2, isR2Configured } from '@/backend/storage/r2';
import { getAuthBaseUrl } from '@/lib/auth/auth-url';
import { buildDefaultAvatarUrl, isLegacyDefaultAvatar, normalizeUsername } from '@/lib/avatar';
import {
  ACCOUNT_COOKIE_NAME,
  clearAccountSessionCookie,
  clearAllAccountSessionCookies,
  clearHostOnlyAccountSessionCookie,
  getAccountCookieDomain,
  getAllVerifiedAccounts,
  getCookieValues,
  getVerifiedAccount,
  issueAccountSessionCookie
} from '@/lib/security/auth';

export const runtime = 'nodejs';

type JoinedSessionAccount = Pick<
  AccountRow,
  'id' | 'email' | 'username' | 'display_name' | 'avatar_url' | 'plan' | 'role' | 'is_banned'
> & { session_id: string; expires_at: number };

const JOINED_SESSION_SQL = `SELECT s.id AS session_id, s.expires_at,
        a.id, a.email, a.username, a.display_name, a.avatar_url, a.plan, a.role, a.is_banned
 FROM auth_sessions s
 JOIN accounts a ON a.id = s.account_id
 WHERE s.id = ?
 LIMIT 1`;

async function querySessionWithSchemaFallback(
  pool: NonNullable<ReturnType<typeof getDbPool>>,
  sid: string,
  schemaEnsured: { done: boolean }
): Promise<JoinedSessionAccount | null> {
  try {
    const rows = await pool.query<JoinedSessionAccount>(JOINED_SESSION_SQL, [sid]);
    return rows[0] ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!schemaEnsured.done && /no such (table|column)/i.test(msg)) {
      schemaEnsured.done = true;
      await ensureTursoSchema();
      const rows = await pool.query<JoinedSessionAccount>(JOINED_SESSION_SQL, [sid]);
      return rows[0] ?? null;
    }
    throw err;
  }
}

async function fetchCentralAuthFallback(rawAccountCookies: string[]) {
  if (rawAccountCookies.length === 0) return null;
  try {
    const authBase = getAuthBaseUrl();
    const res = await fetch(`${authBase}/api/auth/me`, {
      method: 'GET',
      headers: {
        cookie: rawAccountCookies.map(v => `${ACCOUNT_COOKIE_NAME}=${v}`).join('; '),
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
  const requestHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const rawAccountCookies = getCookieValues(req.headers, ACCOUNT_COOKIE_NAME);
  const candidates = getAllVerifiedAccounts(req.headers);

  // Auto-heal duplicate host-only cookies so they stop shadowing the shared domain cookie
  const maybeCleanHostOnly = (res: NextResponse): NextResponse => {
    if (rawAccountCookies.length > 1 && getAccountCookieDomain(requestHost) !== null) {
      res.headers.append('set-cookie', clearHostOnlyAccountSessionCookie(requestHost));
    }
    return res;
  };

  if (candidates.length === 0) {
    const central = await fetchCentralAuthFallback(rawAccountCookies);
    if (central) {
      return maybeCleanHostOnly(NextResponse.json(central));
    }
    return maybeCleanHostOnly(
      NextResponse.json({
        authenticated: false,
        guest: true,
        reason: rawAccountCookies.length > 0 ? 'invalid_token' : 'no_cookie'
      })
    );
  }

  let matchedClaim = null as (typeof candidates)[number] | null;
  let dbAccount: JoinedSessionAccount | null = null;
  let sawBanned = false;
  let dbLookupFailed = false;
  let pool: ReturnType<typeof getDbPool> = null;

  try {
    pool = getDbPool();
    if (pool) {
      const schemaEnsured = { done: false };
      for (const candidate of candidates) {
        const row = await querySessionWithSchemaFallback(pool, candidate.sid, schemaEnsured);
        if (!row) continue;
        if (Number(row.is_banned) === 1) {
          await revokeSessionById(pool, candidate.sid).catch(() => undefined);
          sawBanned = true;
          continue;
        }
        if (Date.now() > Number(row.expires_at)) {
          await revokeSessionById(pool, candidate.sid).catch(() => undefined);
          continue;
        }
        matchedClaim = candidate;
        dbAccount = row;
        break;
      }
    }
  } catch {
    // DB crapped out transiently, fall back to the cryptographically verified claims
    dbLookupFailed = true;
  }

  if (!dbLookupFailed && pool && !matchedClaim) {
    if (sawBanned) {
      const res = NextResponse.json({ authenticated: false, guest: true, banned: true });
      for (const cookie of clearAllAccountSessionCookies(requestHost)) {
        res.headers.append('set-cookie', cookie);
      }
      return res;
    }
    const central = await fetchCentralAuthFallback(rawAccountCookies);
    if (central) {
      return maybeCleanHostOnly(NextResponse.json(central));
    }
    return maybeCleanHostOnly(
      NextResponse.json({
        authenticated: false,
        guest: true,
        reason: 'session_inactive'
      })
    );
  }

  const verified = matchedClaim ?? candidates[0];
  const displayName = dbAccount?.display_name || verified.name;
  const username = dbAccount?.username ?? null;
  const rawAvatar = dbAccount?.avatar_url;
  const avatarUrl =
    rawAvatar && !isLegacyDefaultAvatar(rawAvatar)
      ? rawAvatar
      : buildDefaultAvatarUrl(username || dbAccount?.id || verified.sub);

  return maybeCleanHostOnly(
    NextResponse.json({
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
    })
  );
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

    const requestHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    const pool = await requireDbPool();
    const active = await isSessionActiveInDb(pool, verified.sid);
    if (!active) {
      const res = NextResponse.json({ error: 'Session expired.' }, { status: 401 });
      for (const cookie of clearAllAccountSessionCookies(requestHost)) {
        res.headers.append('set-cookie', cookie);
      }
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

    const cookieHeader = issueAccountSessionCookie(
      {
        sub: current.id,
        sid: verified.sid,
        email: current.email,
        plan: current.plan,
        role: current.role ?? 'user',
        name: nextDisplayName
      },
      { requestHost }
    );

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
    if (getAccountCookieDomain(requestHost) !== null) {
      res.headers.append('set-cookie', clearHostOnlyAccountSessionCookie(requestHost));
    }
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
    const requestHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    const pool = await requireDbPool();
    const active = await isSessionActiveInDb(pool, verified.sid);
    if (!active) {
      const res = NextResponse.json({ error: 'Session expired.' }, { status: 401 });
      for (const cookie of clearAllAccountSessionCookies(requestHost)) {
        res.headers.append('set-cookie', cookie);
      }
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
    for (const cookie of clearAllAccountSessionCookies(requestHost)) {
      res.headers.append('set-cookie', cookie);
    }
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete account.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
