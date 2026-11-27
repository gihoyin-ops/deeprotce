'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { buildAuthLoginUrl } from '@/lib/auth/auth-url';
import { getUserProfileClient } from '@/lib/storage/client-storage';

export default function ProfileRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        const data = res.ok
          ? ((await res.json()) as {
              authenticated?: boolean;
              account?: { username?: string | null };
            })
          : null;
        if (!active) return;

        if (data?.authenticated && data.account?.username) {
          router.replace(`/u/${encodeURIComponent(data.account.username)}`);
          return;
        }
        if (data?.authenticated && !data.account?.username) {
          router.replace('/get-started');
          return;
        }
      } catch {
        // Fall back to the local profile if the server shits the bed
      }

      const local = await getUserProfileClient();
      if (!active) return;
      if (local.username) {
        router.replace(`/u/${encodeURIComponent(local.username)}`);
      } else {
        window.location.replace(buildAuthLoginUrl());
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--dc-canvas)]">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--dc-border-subtle)] border-t-[var(--dc-text-strong)]" />
    </div>
  );
}
