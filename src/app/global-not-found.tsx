'use client';

import { useRouter } from 'next/navigation';
import ErrorPage from '@/components/ErrorPage';
import { GLOBAL_CSS, THEME_SCRIPT } from '@/lib/standaloneTheme';

// Routing-level 404 (experimental.globalNotFound): Next skips the whole
// route tree, so this has to be a standalone HTML document just like
// global-error.tsx. Only unmatched URLs land here, so the sidebar and
// header don't show up, the 404 owns the whole page
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
