'use client';

import { useRouter } from 'next/navigation';
import ErrorPage from '@/components/ErrorPage';

const NotFound = () => {
  const router = useRouter();
  return (
    <ErrorPage
      kind="404"
      title="Oops, this page took a wrong turn"
      lines={[
        'That link does not exist (anymore). Maybe it moved, maybe it simply lost its way.',
        'Grab a coffee, we will guide you back.',
      ]}
      primary={{ label: 'Back to the homepage', action: () => router.push('/') }}
    />
  );
};

export default NotFound;
