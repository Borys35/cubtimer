import { test, expect } from "@playwright/test";

const FIXTURE = "fixtures/synthetic-export.txt";

async function waitForDeploymentSha(page: import("@playwright/test").Page, sha: string) {
  const deadline = Date.now() + 10 * 60_000;
  let last = "";
  while (Date.now() < deadline) {
    const resp = await page.goto("/", { waitUntil: "domcontentloaded" });
    if (resp && !resp.ok()) throw new Error(`prod URL returned ${resp.status()}`);
    last = await page.evaluate(() => {
      const el = document.querySelector('meta[name="git-sha"]');
      return el ? el.getAttribute("content") ?? "" : "";
    });
    if (last === sha) return;
    await page.waitForTimeout(30_000);
  }
  throw new Error(`deployment never served SHA ${sha}; last seen: "${last || "(none)"}"`);
}

test("dashboard renders after fixture upload", async ({ page }) => {
  if (process.env.SMOKE_TARGET && process.env.SMOKE_SHA) {
    await waitForDeploymentSha(page, process.env.SMOKE_SHA);
  } else {
    await page.goto("/");
  }

  // Import lives in Settings; the stats page reads whatever sessions are stored.
  await page.getByRole("link", { name: "Settings" }).click();
  await page.setInputFiles('input[type="file"]', FIXTURE);
  await expect(page.getByText(/^Imported \d+ session/)).toBeVisible();
  await page.getByRole("link", { name: "Stats" }).click();

  await expect(page.locator(".tier-pill").first()).toBeVisible({ timeout: 20_000 });
  const scoreText = await page.locator("svg text").first().textContent();
  const score = Number(scoreText);
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(100);

  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  const trendLen = await page.evaluate(() => {
    const paths = [...document.querySelectorAll<SVGPathElement>("path.recharts-curve")];
    const expected = getComputedStyle(document.documentElement)
      .getPropertyValue("--series-trend")
      .trim()
      .toLowerCase();
    if (!expected) return -1;
    const trend = paths.find((p) => (p.getAttribute("stroke") ?? "").toLowerCase() === expected);
    return trend ? trend.getTotalLength() : -1;
  });
  expect(trendLen).toBeGreaterThan(10);

  await expect(page.getByText(/weakest/i).first()).toBeVisible();
});

test("theme toggle cycles and persists", async ({ page }) => {
  test.skip(Boolean(process.env.SMOKE_TARGET), "theme prefs are client-local");
  await page.goto("/");
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.theme));
  const first = await page.evaluate(() => document.documentElement.dataset.theme ?? "");
  await page.getByRole("button", { name: /Theme:/ }).click();
  const second = await page.evaluate(() => document.documentElement.dataset.theme ?? "");
  expect(second).not.toBe(first);
  expect(second).not.toBe("");
  const bgVar = (t: string) =>
    page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
      return getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    }, t);
  const bgFirst = await bgVar(first);
  const bgSecond = await bgVar(second);
  expect(bgFirst).not.toBe(bgSecond);
  await page.reload();
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.theme));
  const persisted = await page.evaluate(() => document.documentElement.dataset.theme ?? "");
  expect(persisted).toBe(second);
});
