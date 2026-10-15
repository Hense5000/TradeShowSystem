import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The headless Chrome that opens exhibitor directories built with JavaScript
  // (src/lib/render-page.ts) is loaded from node_modules at run time, not bundled.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    // A glob over routes; written with * since [slug] would read as a character class.
    "/a/*/trade-shows/*": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
