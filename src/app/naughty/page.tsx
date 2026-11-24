'use client';

import { useRouter } from 'next/navigation';
import ErrorPage from '@/components/ErrorPage';

const NaughtyPage = () => {
  const router = useRouter();

  return (
    <ErrorPage
      kind="naughty"
      title="Restricted endpoint"
      lines={[
        'This route is reserved for internal application requests and cannot be opened directly in the browser.',
      ]}
      primary={{ label: 'Back to DeepChat', action: () => router.push('/') }}
    />
  );
};

export default NaughtyPage;
