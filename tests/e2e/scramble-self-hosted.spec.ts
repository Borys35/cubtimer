import { test, expect } from "@playwright/test";

// ADR 0001: the scrambler loads from the app's own /cubing/ copy, never from
// cdn.cubing.net, and scrambles come from cubing.js, not the random-move
// fallback.
//
// Runs against the local production build only: the prod smoke job starts on
// push, before Vercel has necessarily deployed this commit.
test.skip(Boolean(process.env.SMOKE_TARGET), "checks the local production build");

test("scrambles come from self-hosted cubing.js, not the CDN", async ({ page, context }) => {
  const requests: string[] = [];
  const workerUrls: string[] = [];
  const warnings: string[] = [];

  context.on("request", (req) => requests.push(req.url()));
  page.on("worker", (w) => workerUrls.push(w.url()));
  page.on("console", (msg) => {
    if (msg.type() === "warning") warnings.push(msg.text());
  });
  // Anything that still tries the CDN fails instead of silently working.
  await context.route(/cdn\.cubing\.net/, (route) => route.abort());

  await page.goto("/");
  const origin = new URL(page.url()).origin;

  const scramble = page
    .getByRole("button", { name: "Previous scramble" })
    .locator("xpath=following-sibling::div[1]");
  await expect(scramble).not.toBeEmpty();

  // The module comes from the same origin.
  await expect
    .poll(() => requests.includes(`${origin}/cubing/scramble/index.js`), { timeout: 30_000 })
    .toBe(true);

  // cubing.js spawns its search worker relative to import.meta.url, so it is
  // same-origin too, and the worker fetches the 3x3 solver: a scramble was
  // actually searched by cubing.js.
  await expect.poll(() => workerUrls.length, { timeout: 30_000 }).toBeGreaterThan(0);
  for (const url of workerUrls) expect(new URL(url).origin).toBe(origin);
  await expect
    .poll(() => requests.some((u) => u.startsWith(`${origin}/cubing/chunks/search-dynamic-solve-3x3x3`)), {
      timeout: 30_000,
    })
    .toBe(true);

  expect(requests.filter((u) => u.includes("cdn.cubing.net"))).toEqual([]);
  expect(warnings.filter((w) => /cubing\.js|using fallback/i.test(w))).toEqual([]);
});

test("self-hosted cubing.js scrambles every puzzle type in the browser", async ({ page, context }) => {
  const failed: string[] = [];
  context.on("requestfailed", (req) => {
    if (req.url().includes("/cubing/")) failed.push(req.url());
  });
  context.on("response", (res) => {
    if (res.url().includes("/cubing/") && !res.ok()) failed.push(`${res.status()} ${res.url()}`);
  });
  await context.route(/cdn\.cubing\.net/, (route) => route.abort());

  await page.goto("/");
  // Same events as PUZZLE_TO_EVENT in src/lib/scramble.ts.
  const events = ["222", "333", "444", "555", "666", "777", "pyram", "minx", "skewb", "sq1", "clock"];
  const scrambles = await page.evaluate(async (evts) => {
    const url = "/cubing/scramble/index.js";
    const mod = await import(/* webpackIgnore: true */ url);
    const out: Record<string, string> = {};
    for (const e of evts) out[e] = (await mod.randomScrambleForEvent(e)).toString();
    return out;
  }, events);

  for (const e of events) expect(scrambles[e], e).toMatch(/\S/);
  expect(failed).toEqual([]);
});
