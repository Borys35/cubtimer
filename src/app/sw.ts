/// <reference lib="webworker" />
// Service worker source, bundled by @serwist/next into public/sw.js at build
// time (production only; disabled in `next dev`). next.config.mjs builds the
// precache list: Next's JS/CSS chunks, everything in public/ (logos, the
// self-hosted cubing.js scrambler and its search worker), the app shell pages
// and the generated icons and manifest.
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";
import { PRECACHE_IGNORED_PARAMS, bypassesServiceWorker, offlinePageFor } from "@/lib/sw-routing";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist: Serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { ignoreURLParametersMatching: PRECACHE_IGNORED_PARAMS },
  // A new version waits until no tab uses the old one. Serwist's built-in
  // {type: "SKIP_WAITING"} message handler lets a page activate it early.
  skipWaiting: false,
  clientsClaim: false,
  runtimeCaching: [
    {
      // Navigations outside the precache (e.g. `/?error=...` from a failed
      // magic link) go to the network; offline, the matching shell page.
      matcher: ({ request, url }) =>
        request.mode === "navigate" && !bypassesServiceWorker(url, self.location.origin),
      handler: new NetworkOnly({
        plugins: [
          {
            handlerDidError: async ({ request }): Promise<Response> =>
              (await serwist.matchPrecache(offlinePageFor(new URL(request.url).pathname))) ??
              Response.error(),
          },
        ],
      }),
    },
  ],
  // No other routes: Supabase, Vercel analytics, RSC payloads and anything
  // not precached go straight to the network without the worker caching them.
});

serwist.addEventListeners();
