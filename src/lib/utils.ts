'use client';

import React, { useSyncExternalStore } from 'react';
import { DEFAULT_GUEST_AVATAR } from '@/lib/avatar';

export function useIsMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
}

export function useClientOnly<T>(value: T, defaultValue: T): T {
  const mounted = useIsMounted();
  return mounted ? value : defaultValue;
}

export const escapeScriptClose = (value: string) => value.replace(/<\/script/gi, '<\\/script');

export const safeAvatarSource = (value: string | undefined): string => {
  const fallback = DEFAULT_GUEST_AVATAR;
  if (!value) return fallback;
  if (value.startsWith('data:image/') || value.startsWith('/')) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol.toLowerCase() === 'https:' && parsed.hostname !== '' ? value : fallback;
  } catch {
    return fallback;
  }
};

export function ClientOnly({ children, fallback = null }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const mounted = useIsMounted();

  if (!mounted) {
    return fallback;
  }

  return React.createElement(React.Fragment, null, children);
}
