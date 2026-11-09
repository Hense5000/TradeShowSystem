import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Dashboard ad images are uploaded through a server action (max 2 MB,
    // see src/lib/dashboard-ads.ts); the default limit is 1 MB.
    serverActions: { bodySizeLimit: "3mb" },
  },
  // The headless Chrome that opens exhibitor directories built with JavaScript
  // (src/lib/render-page.ts) is loaded from node_modules at run time, not bundled.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    // A glob over routes; written with * since [slug] would read as a character class.
    "/a/*/trade-shows/*": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/cron/nightly-update": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
