import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

// Service worker (#24): after one online visit the app shell and the
// self-hosted cubing.js scrambler work with no network.
//
// Runs against the local production build only: the prod smoke job starts on
// push, before Vercel has necessarily deployed this commit.
test.skip(Boolean(process.env.SMOKE_TARGET), "checks the local production build");

const SCRAMBLE_WARNING = /cubing\.js|using fallback|scrambler/i;

/** First visit installs the worker; a reload puts the page under its control. */
async function installServiceWorker(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
  }
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state ?? null))
    .toBe("activated");
}

function scrambleText(page: Page) {
  return page
    .getByRole("button", { name: "Previous scramble" })
    .locator("xpath=following-sibling::div[1]");
}

test("sw.js is served without long-lived caching", async ({ request }) => {
  const res = await request.get("/sw.js");
  expect(res.ok()).toBe(true);
  expect(res.headers()["cache-control"]).toMatch(/no-cache|max-age=0/);
  expect(res.headers()["cache-control"]).not.toMatch(/immutable/);
});

test("installing precaches the app shell, icons and all of public/cubing", async ({ page }) => {
  await installServiceWorker(page);
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
    }
    return urls;
  });

  const cubingDir = path.resolve(process.cwd(), "public/cubing");
  const cubingFiles = (fs.readdirSync(cubingDir, { recursive: true }) as string[])
    .map((f) => f.split(path.sep).join("/"))
    .filter((f) => fs.statSync(path.join(cubingDir, f)).isFile() && !f.endsWith(".map"))
    .map((f) => `/cubing/${f}`);
  expect(cubingFiles).toContain("/cubing/scramble/index.js");
  expect(cubingFiles).toContain("/cubing/chunks/search-worker-entry.js");

  for (const url of [
    "/",
    "/stats",
    "/settings",
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-512-maskable.png",
    "/apple-icon",
    "/icon.svg",
    "/logo.svg",
    ...cubingFiles,
  ]) {
    expect(cached, url).toContain(url);
  }
  expect(cached.some((u) => u.startsWith("/_next/static/chunks/"))).toBe(true);
  expect(cached.some((u) => u.startsWith("/_next/static/css/"))).toBe(true);
});

test("offline reload: timer renders, records a solve, scrambles come from cubing.js", async ({
  page,
  context,
}) => {
  const warnings: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning" || msg.type() === "error") warnings.push(msg.text());
  });

  await installServiceWorker(page);
  await context.setOffline(true);

  const cubingResponses: { url: string; fromSW: boolean; ok: boolean }[] = [];
  context.on("response", (res) => {
    if (res.url().includes("/cubing/")) {
      cubingResponses.push({ url: res.url(), fromSW: res.fromServiceWorker(), ok: res.ok() });
    }
  });
  const workerUrls: string[] = [];
  page.on("worker", (w) => workerUrls.push(w.url()));

  await page.reload();
  await expect(page.getByTestId("timer-display")).toBeVisible();
  await expect(scrambleText(page)).not.toBeEmpty();

  // The 3x3 scramble on screen was searched by cubing.js in its worker, with
  // every module served by the service worker.
  await expect.poll(() => workerUrls.length, { timeout: 30_000 }).toBeGreaterThan(0);
  await expect
    .poll(() => cubingResponses.some((r) => r.url.includes("/cubing/chunks/search-dynamic-solve-3x3x3")), {
      timeout: 30_000,
    })
    .toBe(true);

  // A second puzzle, through the same self-hosted module the app imports.
  const scramble444 = await page.evaluate(async () => {
    const url = "/cubing/scramble/index.js";
    const mod = await import(/* webpackIgnore: true */ url);
    return (await mod.randomScrambleForEvent("444")).toString();
  });
  // Offline, the import itself only succeeds from the precache; the 4x4
  // solver chunk below shows cubing.js searched it.
  expect(scramble444).toMatch(/\b[UDLRFB]w/);
  expect(cubingResponses.some((r) => r.url.includes("/cubing/chunks/search-dynamic-solve-4x4x4"))).toBe(true);

  expect(cubingResponses.length).toBeGreaterThan(0);
  for (const r of cubingResponses) {
    expect(r.ok, r.url).toBe(true);
    expect(r.fromSW, r.url).toBe(true);
  }

  // Record a solve while offline.
  await page.getByRole("button", { name: "Switch to typing times" }).click();
  await page.getByTestId("typed-time-input").fill("1234");
  await page.getByTestId("typed-time-input").press("Enter");
  await expect(page.locator("table").getByText("12.34").first()).toBeVisible();

  expect(warnings.filter((w) => SCRAMBLE_WARNING.test(w))).toEqual([]);
});

test("offline navigation serves the precached stats and settings pages", async ({ page, context }) => {
  await installServiceWorker(page);
  await context.setOffline(true);

  const statsResponse = await page.goto("/stats");
  expect(statsResponse?.fromServiceWorker()).toBe(true);
  await expect(page.getByText(/no solves yet/i)).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  // Client-side navigation back to the timer still works offline.
  await page.getByRole("link", { name: "Timer", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("timer-display")).toBeVisible();
});

test("Supabase and Vercel analytics requests bypass the service worker", async ({ page, context }) => {
  await installServiceWorker(page);

  const supabaseUrl = "https://sw-bypass-test.supabase.co/rest/v1/timer_solves?select=id";
  await context.route("https://sw-bypass-test.supabase.co/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: "[]",
    }),
  );
  const seen: { url: string; fromSW: boolean }[] = [];
  context.on("response", (res) => {
    if (res.url().includes("supabase.co") || res.url().includes("/_vercel/")) {
      seen.push({ url: res.url(), fromSW: res.fromServiceWorker() });
    }
  });

  const results = await page.evaluate(async (url) => {
    const supabase = await fetch(url).then((r) => r.status);
    const vercel = await fetch("/_vercel/insights/script.js").then((r) => r.status);
    return { supabase, vercel };
  }, supabaseUrl);
  expect(results.supabase).toBe(200);
  // Not deployed on Vercel locally: the point is only that it isn't served
  // from a cache.
  expect(results.vercel).toBeGreaterThanOrEqual(200);

  await expect.poll(() => seen.length).toBeGreaterThanOrEqual(2);
  for (const r of seen) expect(r.fromSW, r.url).toBe(false);

  const cachedHits = await page.evaluate(async () => {
    const hits: string[] = [];
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) {
        if (/supabase\.co|\/_vercel\//.test(req.url)) hits.push(req.url);
      }
    }
    return hits;
  });
  expect(cachedHits).toEqual([]);

  // Offline, a Supabase request fails instead of being answered from a cache.
  await context.unroute("https://sw-bypass-test.supabase.co/**");
  await context.setOffline(true);
  const offlineOk = await page.evaluate(async (url) => {
    try {
      await fetch(url);
      return true;
    } catch {
      return false;
    }
  }, supabaseUrl);
  expect(offlineOk).toBe(false);
});
