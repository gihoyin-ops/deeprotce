import {
  signAccountClaims,
  verifyAccountClaims,
  type SignedAccountClaims
} from './crypto';

export const SESSION_COOKIE_NAME = 'dc_session';
export const ACCOUNT_COOKIE_NAME = 'dc_account';
export const ACCOUNT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

export const getCookieValue = (headers: Headers, cookieName: string): string | null => {
  const cookie = headers.get('cookie');
  if (cookie === null) return null;
  for (const part of cookie.split(';')) {
    const [rawName, ...rest] = part.split('=');
    if (rawName?.trim() === cookieName) {
      const value = rest.join('=').trim();
      return value !== '' ? value : null;
    }
  }
  return null;
};

export const getVerifiedAccount = (headers: Headers): SignedAccountClaims | null => {
  const raw = getCookieValue(headers, ACCOUNT_COOKIE_NAME);
  return verifyAccountClaims(raw);
};

export const hasAccountCookie = (headers: Headers): boolean => getVerifiedAccount(headers) !== null;

export const isGuestRequest = (headers: Headers): boolean => !hasAccountCookie(headers);

export const issueAccountSessionCookie = (claims: Omit<SignedAccountClaims, 'exp'>): string => {
  const token = signAccountClaims({
    ...claims,
    exp: Date.now() + ACCOUNT_SESSION_TTL_SECONDS * 1000
  });
  const secureFlag = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${ACCOUNT_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax;${secureFlag} Max-Age=${ACCOUNT_SESSION_TTL_SECONDS}`;
};

export const clearAccountSessionCookie = (): string => {
  const secureFlag = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${ACCOUNT_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax;${secureFlag} Max-Age=0`;
};

export const issueSessionToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
};

export const buildSessionCookie = (token: string): string => {
  const secureFlag = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax;${secureFlag} Max-Age=86400`;
};

export const hasSessionCookie = (headers: Headers): boolean => {
  const value = getCookieValue(headers, SESSION_COOKIE_NAME);
  return value !== null && /^[0-9a-f]{64}$/i.test(value);
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
