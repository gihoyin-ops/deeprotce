const DEFAULT_AUTH_URL = 'https://auth.deepsia.my.id';

export const getAuthBaseUrl = (): string => {
  const configured = process.env.NEXT_PUBLIC_AUTH_URL?.trim();
  return (configured || DEFAULT_AUTH_URL).replace(/\/+$/, '');
};

export const buildAuthLoginUrl = (redirectTo?: string): string => {
  const base = getAuthBaseUrl();
  const target =
    redirectTo ?? (typeof window !== 'undefined' ? window.location.href : undefined);
  if (!target) {
    return `${base}/login`;
  }
  return `${base}/login?redirect=${encodeURIComponent(target)}`;
};

export const buildAuthOnboardingUrl = (redirectTo?: string): string => {
  const base = getAuthBaseUrl();
  const target =
    redirectTo ?? (typeof window !== 'undefined' ? window.location.href : undefined);
  if (!target) {
    return `${base}/get-started`;
  }
  return `${base}/get-started?redirect=${encodeURIComponent(target)}`;
};

export const buildAuthLogoutUrl = (): string => `${getAuthBaseUrl()}/api/auth/logout`;

export const openAuthModal = (): void => {
  if (typeof window === 'undefined') return;
  window.location.assign(buildAuthLoginUrl());
};
