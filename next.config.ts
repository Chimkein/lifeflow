import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy tuned for this app's real dependencies:
//  - Google OAuth (accounts.google.com) for the sign-in redirect/popup.
//  - Google APIs (googleapis.com / oauth2.googleapis.com) — but note those are
//    called SERVER-side; they're listed in connect-src only for completeness.
//  - Avatars from *.googleusercontent.com.
//  - next/font/google (Geist) self-hosts fonts at build time, so 'self' covers
//    fonts and styles; no external font host is needed.
// 'unsafe-inline' is kept for scripts/styles because Next.js injects inline
// bootstrap/hydration scripts and Tailwind/shadcn use inline styles. There is
// no untrusted user HTML rendered into the page shell, so this is acceptable;
// a nonce-based strict CSP (via middleware) is the future upgrade path.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://accounts.google.com https://apis.google.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
  "frame-src 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // HSTS only takes effect over HTTPS (Vercel serves HTTPS). 2 years + preload.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
