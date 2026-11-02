export const SESSION_COOKIE_NAME = 'dc_session';

export const issueSessionToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
};

export const buildSessionCookie = (token: string): string =>
  `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=86400`;

export const hasSessionCookie = (headers: Headers): boolean => {
  const cookie = headers.get('cookie');
  if (cookie === null) return false;
  for (const part of cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name === SESSION_COOKIE_NAME) return true;
  }
  return false;
};

export const isSameOriginRequest = (headers: Headers, hostHeader: string | null): boolean => {
  const fetchSite = headers.get('sec-fetch-site');
  if (fetchSite === 'same-origin') return true;
  if (fetchSite === 'cross-site' || fetchSite === 'none') return false;

  const host = (hostHeader ?? headers.get('x-forwarded-host'))?.trim();
  if (host === undefined || host === '') return false;
  const expected = host.split(',')[0].trim().toLowerCase().split(':')[0];

  let candidate = headers.get('origin');
  if (candidate === null) candidate = headers.get('referer');
  if (candidate === null) return false;
  candidate = candidate.trim();
  if (candidate === '') return false;

  let originHost: string;
  try {
    originHost = new URL(candidate).hostname;
  } catch {
    return false;
  }
  return originHost.toLowerCase() === expected;
};
