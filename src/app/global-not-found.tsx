'use client';

import { useRouter } from 'next/navigation';
import ErrorPage from '@/components/ErrorPage';
import { GLOBAL_CSS, THEME_SCRIPT } from '@/lib/standaloneTheme';

// Routing-level 404 (experimental.globalNotFound): Next bypasses the whole
// route tree, so this must be a complete standalone document, the same way
// global-error.tsx is one. Only unmatched URLs land here, so the in-frame
// chrome (sidebar/header) does not appear: the 404 is its own page.
const GlobalNotFound = () => {
  const router = useRouter();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>DeepChat. Not found</title>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style>{GLOBAL_CSS}</style>
      </head>
      <body>
        <ErrorPage
          kind="404"
          title="Oops, this page took a wrong turn"
          lines={[
            'That link does not exist (anymore). Maybe it moved, maybe it simply lost its way.',
            'Grab a coffee, we will guide you back.'
          ]}
          primary={{ label: 'Back to the homepage', action: () => router.push('/') }}
        />
      </body>
    </html>
  );
};

export default GlobalNotFound;
