'use client';

import { useEffect } from 'react';
import ErrorPage from '@/components/ErrorPage';
import { GLOBAL_CSS, THEME_SCRIPT } from '@/lib/standaloneTheme';

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>DeepChat - Something went wrong</title>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style>{GLOBAL_CSS}</style>
      </head>
      <body>
        <ErrorPage
          kind="500"
          title="Something went wrong"
          lines={['An unexpected error occurred while loading this page. Please try again.']}
          primary={{ label: 'Try again', action: () => retry() }}
          secondary={{ label: 'Back home', action: () => window.location.assign('/') }}
        />
      </body>
    </html>
  );
}
