import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import withSerwistInit from "@serwist/next";

const publicDir = path.resolve(process.cwd(), "public");

/**
 * Everything in public/ except the service worker itself and source maps:
 * the logos and the whole self-hosted cubing.js scrambler (ADR 0001), which
 * `prebuild` bundles into public/cubing before `next build` reads this file.
 */
function publicPrecacheEntries() {
  if (!fs.existsSync(publicDir)) return [];
  return fs
    .readdirSync(publicDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(publicDir, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
    .filter((file) => !/^(sw\.js|swe-worker-.*\.js)(\.map)?$/.test(file) && !file.endsWith(".map"))
    .sort()
    .map((file) => ({
      url: `/${file}`,
      revision: crypto.createHash("md5").update(fs.readFileSync(path.join(publicDir, file))).digest("hex"),
    }));
}

// Prerendered pages and generated icons aren't webpack assets, so they get a
// per-build revision: a deploy always refreshes them alongside the new chunks.
const buildRevision = crypto.randomUUID();
const generatedEntries = [
  // App shell (keep in sync with APP_SHELL_PAGES in src/lib/sw-routing.ts).
  "/",
  "/stats",
  "/settings",
  // Metadata routes and the icon route handler (src/app/icons/[file]).
  // Pages link the first two with a content-hash query (`/icon.svg?<hash>`),
  // which src/app/sw.ts ignores when matching the precache.
  "/icon.svg",
  "/apple-icon",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
].map((url) => ({ url, revision: buildRevision }));

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  // The timer must never reload by itself mid-solve when the network returns.
  reloadOnOnline: false,
  // Pages are precached; no extra worker caching every client navigation.
  cacheOnNavigation: false,
  additionalPrecacheEntries: [...generatedEntries, ...publicPrecacheEntries()],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Browsers must always revalidate the worker script so deploys are seen.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
