import type { NextConfig } from "next";

// script-src-elem (not script-src) so only element scripts are governed:
// Next's SSR/Hydration output carries inline bootstrap scripts (Turbopack
// preinit + RSC flight data), and the sandboxed srcDoc iframe in
// components/ui/CodePreview.tsx inherits this policy for its preview scripts.
// There are no inline on* event-handler attributes (React attaches listeners
// via addEventListener), so script-src-attr is locked to 'none'.
const nextConfig: NextConfig = {
  experimental: {
    // routing-level 404 page that bypasses the root layout, so unmatched
    // URLs render standalone (no chat frame), like the global error page
    globalNotFound: true
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src-elem 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'"
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
