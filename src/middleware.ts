import { NextRequest, NextResponse } from 'next/server';
import {
  buildSessionCookie,
  hasSessionCookie,
  isSameOriginRequest,
  issueSessionToken
} from '@/lib/security/auth';
import { MAX_BODY_BYTES } from '@/lib/security/limits';
import { checkApiRateLimits, getClientIp, isBanned } from '@/lib/security/rate-limit';

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

  const declaredLength = req.headers.get('content-length');
  if (declaredLength !== null) {
    const size = Number.parseInt(declaredLength, 10);
    if (!Number.isNaN(size) && size > MAX_BODY_BYTES) {
      return jsonError(413, 'payload_too_large');
    }
  }
  // a body with no content-length is chunked; re-reading it here to measure
  // the size would consume the exact stream the route handler needs, so only
  // declared sizes are policed at this layer

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
    response.headers.set('set-cookie', issueCookie);
  }
  return response;
}

export default function middleware(req: Request): NextResponse {
  try {
    return handle(req as NextRequest);
  } catch {
    // fail open: a middleware bug must not take the whole API offline
    return NextResponse.next();
  }
}
