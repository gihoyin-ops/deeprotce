import type { NextConfig } from "next";

// Use script-src-elem (not script-src) so CSP only polices script elements.
// Next SSR/Hydration shits out inline bootstrap scripts (Turbopack preinit
// + RSC flight data), and the sandboxed srcDoc iframe in
// components/ui/CodePreview.tsx inherits this policy for preview scripts.
// Zero inline on* handler attributes exist (React wires listeners via
// addEventListener), so script-src-attr stays locked to 'none'.
const nextConfig: NextConfig = {
  experimental: {
    // Routing-level 404 that skips the root layout, so dead URLs render
    // standalone without the chat frame, same as the global error page
    globalNotFound: true
  },
  async headers() {
    const pythonSandboxHeaders = [
      {
        key: 'Content-Security-Policy',
        value:
          "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net https://fastly.jsdelivr.net https://gcore.jsdelivr.net https://cdn.plot.ly; script-src-elem 'unsafe-inline' blob: https://cdn.jsdelivr.net https://fastly.jsdelivr.net https://gcore.jsdelivr.net https://cdn.plot.ly; connect-src data: blob: https://cdn.jsdelivr.net https://fastly.jsdelivr.net https://gcore.jsdelivr.net https://cdn.plot.ly https://pypi.org https://files.pythonhosted.org; style-src 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: https://cdn.jsdelivr.net https://fastly.jsdelivr.net https://gcore.jsdelivr.net; worker-src 'self' blob: https://cdn.jsdelivr.net https://fastly.jsdelivr.net https://gcore.jsdelivr.net; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
      },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Cache-Control', value: 'no-store, max-age=0' }
    ];

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src-elem 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https://cdn.deepsia.my.id; font-src 'self' data:; connect-src 'self' https:; frame-src 'self' blob:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'"
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(),microphone=(self),geolocation=(),payment=(),usb=()'
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
        ]
      },
      {
        source: '/python-sandbox',
        headers: pythonSandboxHeaders
      },
      {
        source: '/api/python-sandbox',
        headers: pythonSandboxHeaders
      }
    ];
  }
};

export default nextConfig;
