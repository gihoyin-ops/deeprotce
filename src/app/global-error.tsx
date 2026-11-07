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

  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>DeepChat. Small hiccup</title>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style>{GLOBAL_CSS}</style>
      </head>
      <body>
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
          secondary={{ label: 'Back home', action: () => window.location.assign('/') }}
        />
      </body>
    </html>
  );
}
