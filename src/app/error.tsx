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

  return (
    <ErrorPage
      kind="500"
      title="Something went wrong"
      lines={['An unexpected error occurred while loading this page. Please try again.']}
      primary={{ label: 'Try again', action: () => retry() }}
      secondary={{ label: 'Back home', action: () => router.push('/') }}
    />
  );
}
