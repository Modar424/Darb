import path from 'node:path';
import type { NextConfig } from 'next';

/** Server-side only (never exposed to the browser): where the NestJS API lives. */
const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? 'http://localhost:3001').replace(
  /\/$/,
  '',
);

// Content-Security-Policy is set per request (with a nonce) in src/proxy.ts.

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root so a lockfile in a parent folder is never picked up by mistake.
  turbopack: { root: path.resolve(__dirname) },
  poweredByHeader: false,
  // The browser only ever talks to this origin; the API is reached through this proxy so the
  // session cookie stays first-party (HttpOnly, SameSite=Lax) and no CORS is needed in the browser.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_INTERNAL_URL}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
