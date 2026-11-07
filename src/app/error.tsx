'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ErrorPage from '@/components/ErrorPage';

export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const router = useRouter();
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  return (
    <ErrorPage
      kind="500"
      title="The server just sneezed"
      lines={
        digest
          ? [
              'Something got messy behind the scenes. Not your fault, we promise.',
              `ref: ${String(digest).slice(0, 10)}`,
            ]
          : ['Something got messy behind the scenes. Not your fault, we promise.']
      }
      primary={{ label: 'Try again', action: () => retry() }}
      secondary={{ label: 'Back home', action: () => router.push('/') }}
    />
  );
}
