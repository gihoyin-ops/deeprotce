'use client';

import { useQuery } from '@tanstack/react-query';

export interface AuthSessionState {
  ok: boolean;
  authenticated: boolean;
  guest: boolean;
}

export const AUTH_SESSION_QUERY_KEY = ['auth', 'session'] as const;

export function useGuestStatus() {
  const { data } = useQuery<AuthSessionState>({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
      if (!res.ok) {
        return { ok: false, authenticated: false, guest: true };
      }
      return (await res.json()) as AuthSessionState;
    },
    staleTime: 60_000,
    retry: false,
  });

  // Default to guest until an authenticated session is confirmed
  const isGuest = data ? !data.authenticated : true;
  return {
    isGuest,
    isAuthenticated: !isGuest,
  };
}
