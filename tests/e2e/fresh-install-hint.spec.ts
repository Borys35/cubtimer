import { test, expect, type Page } from "@playwright/test";

const HINT = /Solves from your browser don't carry over to the installed app/;
const DISMISSED_KEY = "cstimer-analyzer:fresh-install-hint-dismissed";

/** Pretend to be the iOS installed app (Safari's non-standard flag). */
async function mockStandalone(page: Page, standalone: boolean) {
  await page.addInitScript((value) => {
    Object.defineProperty(Navigator.prototype, "standalone", { configurable: true, get: () => value });
  }, standalone);
}

async function openTimer(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("timer-display")).toBeVisible();
}

/** The hint is decided after mount; give that a moment before asserting it's absent. */
async function settle(page: Page) {
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForTimeout(500);
}

test.describe("fresh-install hint", () => {
  test.skip(Boolean(process.env.SMOKE_TARGET), "relies on a clean, signed-out browser");

  test("shows in the installed app when signed out with no solves, and stays dismissed", async ({ page }) => {
    await mockStandalone(page, true);
    await openTimer(page);

    const hint = page.getByTestId("fresh-install-hint");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText(HINT);
    await expect(hint.getByRole("button", { name: "Import" })).toBeVisible();

    await hint.getByRole("button", { name: "Dismiss" }).click();
    await expect(hint).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("timer-display")).toBeVisible();
    await settle(page);
    await expect(page.getByTestId("fresh-install-hint")).toHaveCount(0);
  });

  test("not shown in a normal browser tab", async ({ page }) => {
    await mockStandalone(page, false);
    await openTimer(page);
    await settle(page);
    await expect(page.getByTestId("fresh-install-hint")).toHaveCount(0);
  });

  test("not shown when there are solves", async ({ page }) => {
    await mockStandalone(page, true);
    // Seed before any app code runs (see routing.spec.ts).
    await page.addInitScript(() => {
      localStorage.setItem(
        "cstimer-analyzer",
        JSON.stringify({
          sessions: [
            {
              id: "test-s1",
              name: "Session_310826_01",
              puzzleType: "3x3",
              createdAt: 1725110400,
              endedAt: null,
              solves: [
                { id: "solve-1", timeMs: 12500, dnf: false, penalty: 0, scramble: "R U R' U'", dateSec: 1725110400 },
              ],
            },
          ],
          activeSessionId: "test-s1",
          settings: {},
        }),
      );
    });
    await openTimer(page);
    // Having solves retires the hint for good.
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), DISMISSED_KEY)).toBe("1");
    await expect(page.getByTestId("fresh-install-hint")).toHaveCount(0);
  });
});
