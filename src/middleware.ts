import { NextRequest, NextResponse } from 'next/server';
import {
  ACCOUNT_COOKIE_NAME,
  buildSessionCookie,
  clearAccountSessionCookie,
  getCookieValue,
  getVerifiedAccount,
  hasSessionCookie,
  isSameOriginRequest,
  issueSessionToken
} from '@/lib/security/auth';
import { MAX_BODY_BYTES } from '@/lib/security/limits';
import {
  checkApiRateLimits,
  checkAuthRateLimits,
  getClientIp,
  isBanned
} from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

export const config = {
  matcher: '/api/:path*'
};

function jsonError(status: number, error: string, extraHeaders?: Record<string, string>) {
  return NextResponse.json(
    { error },
    { status, headers: { 'content-type': 'application/json', ...extraHeaders } }
  );
}

function handle(req: NextRequest): NextResponse {
  const ip = getClientIp(req);
  const pathname = req.nextUrl.pathname;

  // Nosey browsers hitting /api/* directly in the address bar get yeeted to /naughty
  if (req.headers.get('sec-fetch-dest') === 'document') {
    const target = new URL('/naughty', req.url);
    target.searchParams.set('from', pathname);
    return NextResponse.redirect(target, 307);
  }

  if (isBanned(ip)) {
    return jsonError(403, 'blocked', { 'x-ratelimit-policy': 'permanent' });
  }

  let issueCookie: string | null = null;
  if (!hasSessionCookie(req.headers)) {
    const sameOrigin = isSameOriginRequest(req.headers, req.headers.get('host'));
    if (!sameOrigin) {
      return jsonError(401, 'unauthorized');
    }
    issueCookie = buildSessionCookie(issueSessionToken());
  }

  // Verify signed dc_account cookie if it's there; nuke tampered or expired garbage
  const rawAccountCookie = getCookieValue(req.headers, ACCOUNT_COOKIE_NAME);
  const verifiedAccount = rawAccountCookie ? getVerifiedAccount(req.headers) : null;
  const shouldClearTamperedAccount = rawAccountCookie !== null && verifiedAccount === null;

  const declaredLength = req.headers.get('content-length');
  if (declaredLength !== null) {
    const size = Number.parseInt(declaredLength, 10);
    if (!Number.isNaN(size) && size > MAX_BODY_BYTES) {
      return jsonError(413, 'payload_too_large');
    }
  }

  // Tighter rate limit on auth mutation routes so skids can't brute-force logins
  if (pathname.startsWith('/api/auth/') && req.method === 'POST') {
    const authVerdict = checkAuthRateLimits(ip);
    if (authVerdict.status === 'banned') {
      return jsonError(403, 'blocked', { 'x-ratelimit-policy': 'permanent' });
    }
    if (authVerdict.status === 'retry') {
      return jsonError(429, 'too_many_auth_requests', {
        'retry-after': String(authVerdict.retryAfterSeconds ?? 5)
      });
    }
  }

  const verdict = checkApiRateLimits(ip);
  if (verdict.status === 'banned') {
    return jsonError(403, 'blocked', { 'x-ratelimit-policy': 'permanent' });
  }
  if (verdict.status === 'retry') {
    return jsonError(429, 'too_many_requests', {
      'retry-after': String(verdict.retryAfterSeconds ?? 1)
    });
  }

  const response = NextResponse.next();
  if (issueCookie !== null) {
    response.headers.append('set-cookie', issueCookie);
  }
  if (shouldClearTamperedAccount) {
    response.headers.append('set-cookie', clearAccountSessionCookie());
  }
  return response;
}

export default function middleware(req: Request): NextResponse {
  try {
    return handle(req as NextRequest);
  } catch {
    // Fail closed if security middleware shits the bed
    return jsonError(500, 'security_middleware_error');
  }
}
