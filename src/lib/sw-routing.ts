// Request routing rules for the service worker (src/app/sw.ts). Kept free of
// worker globals so they can be unit-tested.

/** App shell pages precached at install and served offline. */
export const APP_SHELL_PAGES = ["/", "/stats", "/settings"] as const;

/**
 * Query parameters dropped when looking a request up in the precache:
 * Serwist's defaults (`utm_*`, `fbclid`) plus the bare content hash Next
 * appends to metadata icons (`/icon.svg?da6f2d006f7060bd`). Nothing else, so
 * RSC requests (`/stats?_rsc=...`) never get the precached HTML.
 */
export const PRECACHE_IGNORED_PARAMS: RegExp[] = [/^utm_/, /^fbclid$/, /^[0-9a-f]{16}$/];

/**
 * True when the service worker must leave a request alone, so the browser
 * fetches it straight from the network and nothing is cached:
 * - anything cross-origin: Supabase API, auth and realtime (whatever project
 *   host NEXT_PUBLIC_SUPABASE_URL points at), and any other third party;
 * - Vercel Web Analytics and Speed Insights under `/_vercel/`.
 */
export function bypassesServiceWorker(url: URL, appOrigin: string): boolean {
  if (url.origin !== appOrigin) return true;
  return url.pathname.startsWith("/_vercel/");
}

/**
 * The precached app shell page to serve for an offline navigation to
 * `pathname`: the page itself when it is part of the shell, else the timer.
 */
export function offlinePageFor(pathname: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return (APP_SHELL_PAGES as readonly string[]).includes(path) ? path : "/";
}
