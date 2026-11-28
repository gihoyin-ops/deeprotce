import {
  signAccountClaims,
  verifyAccountClaims,
  type SignedAccountClaims
} from './crypto';

export const SESSION_COOKIE_NAME = 'dc_session';
export const ACCOUNT_COOKIE_NAME = 'dc_account';
export const ACCOUNT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
export const ACCOUNT_REMEMBER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const isLocalHost = (hostHeader?: string | null): boolean => {
  if (!hostHeader) return false;
  const hostname = hostHeader.split(',')[0].trim().toLowerCase().split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
};

export const getAccountCookieDomain = (requestHost?: string | null): string | null => {
  // Never force a prod Domain on localhost or browsers will drop the cookie
  if (isLocalHost(requestHost)) return null;
  const configured = process.env.COOKIE_DOMAIN?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') return '.deepsia.my.id';
  return null;
};

export const getCookieValues = (headers: Headers, cookieName: string): string[] => {
  const cookie = headers.get('cookie');
  if (cookie === null) return [];
  const values: string[] = [];
  for (const part of cookie.split(';')) {
    const [rawName, ...rest] = part.split('=');
    if (rawName?.trim() === cookieName) {
      const value = rest.join('=').trim();
      if (value !== '') values.push(value);
    }
  }
  return values;
};

export const getCookieValue = (headers: Headers, cookieName: string): string | null =>
  getCookieValues(headers, cookieName)[0] ?? null;

export const getAllVerifiedAccounts = (headers: Headers): SignedAccountClaims[] => {
  const bySid = new Map<string, SignedAccountClaims>();
  for (const raw of getCookieValues(headers, ACCOUNT_COOKIE_NAME)) {
    const claims = verifyAccountClaims(raw);
    if (!claims) continue;
    const prev = bySid.get(claims.sid);
    if (!prev || claims.exp > prev.exp) {
      bySid.set(claims.sid, claims);
    }
  }
  return Array.from(bySid.values()).sort((a, b) => b.exp - a.exp);
};

export const getVerifiedAccount = (headers: Headers): SignedAccountClaims | null =>
  getAllVerifiedAccounts(headers)[0] ?? null;

export const hasAccountCookie = (headers: Headers): boolean => getVerifiedAccount(headers) !== null;

export const isGuestRequest = (headers: Headers): boolean => !hasAccountCookie(headers);

export const issueAccountSessionCookie = (
  claims: Omit<SignedAccountClaims, 'exp'>,
  options?: { rememberMe?: boolean; requestHost?: string | null }
): string => {
  const rememberMe = options?.rememberMe ?? true;
  const ttlSeconds = rememberMe ? ACCOUNT_REMEMBER_TTL_SECONDS : ACCOUNT_SESSION_TTL_SECONDS;
  const token = signAccountClaims({
    ...claims,
    exp: Date.now() + ttlSeconds * 1000
  });
  const domain = getAccountCookieDomain(options?.requestHost);
  const domainAttr = domain ? ` Domain=${domain};` : '';
  const isSecure = process.env.NODE_ENV === 'production' && !isLocalHost(options?.requestHost);
  const secureFlag = isSecure ? ' Secure;' : '';
  const maxAgeAttr = rememberMe ? ` Max-Age=${ttlSeconds}` : '';
  return `${ACCOUNT_COOKIE_NAME}=${token}; Path=/;${domainAttr} HttpOnly; SameSite=Lax;${secureFlag}${maxAgeAttr}`;
};

export const clearAccountSessionCookie = (requestHost?: string | null): string => {
  const domain = getAccountCookieDomain(requestHost);
  const domainAttr = domain ? ` Domain=${domain};` : '';
  const isSecure = process.env.NODE_ENV === 'production' && !isLocalHost(requestHost);
  const secureFlag = isSecure ? ' Secure;' : '';
  return `${ACCOUNT_COOKIE_NAME}=; Path=/;${domainAttr} HttpOnly; SameSite=Lax;${secureFlag} Max-Age=0`;
};

export const clearHostOnlyAccountSessionCookie = (requestHost?: string | null): string => {
  const isSecure = process.env.NODE_ENV === 'production' && !isLocalHost(requestHost);
  const secureFlag = isSecure ? ' Secure;' : '';
  return `${ACCOUNT_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax;${secureFlag} Max-Age=0`;
};

export const clearAllAccountSessionCookies = (requestHost?: string | null): string[] => {
  const hostOnly = clearHostOnlyAccountSessionCookie(requestHost);
  const domainCookie = clearAccountSessionCookie(requestHost);
  return domainCookie === hostOnly ? [hostOnly] : [domainCookie, hostOnly];
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
