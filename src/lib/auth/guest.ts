'use client';

import { useSyncExternalStore } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { DEFAULT_GUEST_AVATAR } from '@/lib/avatar';
import { deepchatQueryKeys } from '@/lib/query-keys';
import {
  getCachedUserProfileSync,
  saveUserProfileClient,
} from '@/lib/storage/client-storage';

export interface AuthSessionState {
  ok: boolean;
  authenticated: boolean;
  guest: boolean;
}

export const AUTH_SESSION_QUERY_KEY = ['auth', 'session'] as const;
const AUTH_HINT_KEY = 'deepchat-auth-hint';
const AUTH_HINT_EVENT = 'deepchat:auth-hint';

const subscribeAuthHint = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const onChange = () => callback();
  window.addEventListener('storage', onChange);
  window.addEventListener(AUTH_HINT_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(AUTH_HINT_EVENT, onChange);
  };
};

const getAuthHintSnapshot = (): boolean | null => {
  if (typeof window === 'undefined') return null;
  try {
    const rawHint = localStorage.getItem(AUTH_HINT_KEY);
    if (rawHint === '1') return true;
    if (rawHint === '0') return false;
    const cachedProfile = getCachedUserProfileSync();
    return Boolean(cachedProfile?.id && cachedProfile.id !== 'default');
  } catch {
    return false;
  }
};

const notifyAuthHint = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_HINT_EVENT));
  }
};

export function useGuestStatus() {
  const cachedAuthHint = useSyncExternalStore(
    subscribeAuthHint,
    getAuthHintSnapshot,
    () => null
  );

  const { data } = useQuery<AuthSessionState>({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
      const payload: AuthSessionState = res.ok
        ? ((await res.json()) as AuthSessionState)
        : { ok: false, authenticated: false, guest: true };
      try {
        localStorage.setItem(AUTH_HINT_KEY, payload.authenticated ? '1' : '0');
        notifyAuthHint();
      } catch {}
      return payload;
    },
    staleTime: 60_000,
    retry: false,
  });

  const resolvedAuthenticated = data ? Boolean(data.authenticated) : cachedAuthHint === true;
  const isAuthLoading = !data && cachedAuthHint === null;
  const isGuest = !resolvedAuthenticated;

  return {
    isGuest,
    isAuthenticated: resolvedAuthenticated,
    isAuthLoading,
  };
}

export async function logoutAccountClient(queryClient: QueryClient): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => undefined);

  try {
    localStorage.removeItem('deepchat-user-profile');
    localStorage.setItem(AUTH_HINT_KEY, '0');
    notifyAuthHint();
  } catch {}

  const guestProfile = {
    id: 'default',
    name: 'Guest',
    username: '',
    avatar: DEFAULT_GUEST_AVATAR,
    plan: '',
    age: '18 or older',
  };

  await saveUserProfileClient(guestProfile, { skipRemoteSync: true });

  queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, {
    ok: true,
    authenticated: false,
    guest: true,
  });
  queryClient.setQueryData(deepchatQueryKeys.profile, guestProfile);

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.profile }),
  ]);
}
