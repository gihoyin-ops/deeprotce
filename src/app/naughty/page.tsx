'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import ErrorPage from '@/components/ErrorPage';

const NaughtyPage = ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) => {
  const router = useRouter();
  const { from } = use(searchParams);
  const poked = typeof from === 'string' && from.trim() ? from.trim() : '/api';

  return (
    <ErrorPage
      kind="naughty"
      title="Hey, you naughty."
      lines={[
        'Nice try poking the backend directly, but that door only opens to the app, not to your address bar.',
        `poked: ${poked}`,
        'Head back to the chat, we will still be here.',
      ]}
      primary={{ label: 'Back to the homepage', action: () => router.push('/') }}
    />
  );
};

export default NaughtyPage;
