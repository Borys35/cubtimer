import { test, expect } from "@playwright/test";

test("navigation between routes works", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Timer", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Stats" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

  await page.getByRole("link", { name: "Stats" }).click();
  await expect(page).toHaveURL(/\/stats/);
  await expect(page.getByText(/no solves yet/i)).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.getByRole("link", { name: "Timer", exact: true }).click();
  await expect(page).toHaveURL("/");
});

test("stats page shows timer sessions from localStorage", async ({ page }) => {
  const sessions = [
    {
      id: "test-s1",
      name: "Session_310826_01",
      puzzleType: "3x3",
      createdAt: 1725110400,
      endedAt: null,
      solves: [
        {
          id: "solve-1",
          timeMs: 12500,
          dnf: false,
          penalty: 0,
          scramble: "R U R' U'",
          dateSec: 1725110400,
        },
        {
          id: "solve-2",
          timeMs: 15000,
          dnf: false,
          penalty: 0,
          scramble: "F R U R' U' F'",
          dateSec: 1725110460,
        },
      ],
    },
  ];

  await page.goto("/");
  await page.evaluate((data) => {
    localStorage.setItem(
      "cstimer-analyzer",
      JSON.stringify({
        sessions: data.sessions,
        activeSessionId: "test-s1",
        settings: {
          startDelayMs: 500,
          inspectionEnabled: false,
          inspectionDurationSec: 15,
          soundEnabled: false,
        },
      }),
    );
  }, { sessions });

  await page.reload();
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.theme));

  await page.getByRole("link", { name: "Stats" }).click();
  await expect(page).toHaveURL(/\/stats/);

  await expect(page.getByText(/^1 session /)).toBeVisible();
  await expect(page.locator("option", { hasText: "3x3 (2 solves)" })).toHaveCount(1);
  await expect(page.getByText("Solves in range", { exact: true })).toBeVisible();
});

test("stats page shows empty state when no sessions", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.getByText(/no solves yet/i)).toBeVisible();
});
