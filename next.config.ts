import type { NextConfig } from "next";

// no script-src on purpose: the sandboxed srcDoc iframe in
// components/ui/CodePreview.tsx executes user preview code whose scripts are
// governed by that document's own CSP; a page-level script-src would kill them
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'"
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(),microphone=(),geolocation=(),payment=(),usb=()'
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
        ]
      }
    ];
  }
};

export default nextConfig;
