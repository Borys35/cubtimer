import { test, expect, type Page } from "@playwright/test";

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

type StoredSolve = { timeMs: number; penalty: number; dnf: boolean };

/** One session with an older solve, so "has solves" alone never shows the buttons. */
async function seed(page: Page, settings: Record<string, unknown> = {}) {
  // Seed before any app code runs (see routing.spec.ts).
  await page.addInitScript((extra) => {
    localStorage.setItem(
      "cstimer-analyzer",
      JSON.stringify({
        sessions: [
          {
            id: "test-s1",
            name: "Penalty test",
            puzzleType: "3x3",
            createdAt: 1725110400,
            endedAt: 1725110400,
            solves: [
              { id: "old", timeMs: 20000, dnf: false, penalty: 0, scramble: "R U", dateSec: 1725110400 },
            ],
          },
        ],
        activeSessionId: "test-s1",
        settings: { startDelayMs: 0, inspectionEnabled: false, soundEnabled: false, ...extra },
      }),
    );
  }, settings);
}

async function storedSolves(page: Page): Promise<StoredSolve[]> {
  return page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("cstimer-analyzer") ?? "{}");
    return data.sessions[0].solves;
  });
}

const actions = (page: Page) => page.getByTestId("last-solve-actions");
const plus2 = (page: Page) => page.getByRole("button", { name: "+2 penalty" });
const dnf = (page: Page) => page.getByRole("button", { name: "DNF", exact: true });

test.describe("penalty buttons after a solve", () => {
  test.skip(Boolean(process.env.SMOKE_TARGET), "seeds localStorage");

  test("typing mode: +2 and DNF toggle the last solve and its shown time", async ({ page }) => {
    await seed(page, { inputMode: "typing" });
    await page.goto("/");
    const input = page.getByTestId("typed-time-input");
    await expect(input).toBeVisible();
    // Old solves in the session don't count as "just solved".
    await expect(actions(page)).toHaveCount(0);

    await input.fill("1234");
    await input.press("Enter");
    await expect(actions(page)).toBeVisible();
    await expect(input).toHaveAttribute("placeholder", "12.34");

    await plus2(page).click();
    await expect(plus2(page)).toHaveAttribute("aria-pressed", "true");
    await expect(input).toHaveAttribute("placeholder", "14.34+");
    await expect.poll(async () => (await storedSolves(page)).at(-1)).toMatchObject({ penalty: 1, dnf: false });

    // DNF clears +2.
    await dnf(page).click();
    await expect(dnf(page)).toHaveAttribute("aria-pressed", "true");
    await expect(plus2(page)).toHaveAttribute("aria-pressed", "false");
    await expect(input).toHaveAttribute("placeholder", "DNF");
    await expect.poll(async () => (await storedSolves(page)).at(-1)).toMatchObject({ penalty: 0, dnf: true });

    // The buttons are type="button": clicking them saved nothing new.
    expect(await storedSolves(page)).toHaveLength(2);
  });

  test("delete removes the last solve and Undo brings it back", async ({ page }) => {
    await seed(page, { inputMode: "typing" });
    await page.goto("/");
    const input = page.getByTestId("typed-time-input");
    await input.fill("1234");
    await input.press("Enter");

    await page.getByRole("button", { name: "Delete last solve" }).click();
    await expect(actions(page)).toHaveCount(0);
    await expect.poll(async () => (await storedSolves(page)).length).toBe(1);

    await page.getByTestId("solve-deleted-toast").getByRole("button", { name: "Undo" }).click();
    await expect(actions(page)).toBeVisible();
    await expect.poll(async () => (await storedSolves(page)).map((s) => s.timeMs)).toEqual([20000, 12340]);
  });

  test("keyboard: hidden while timing, and space after a click still starts the timer", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    const display = page.getByTestId("timer-display");
    await expect(display).toBeVisible();
    await expect(actions(page)).toHaveCount(0);

    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    await expect(page.getByText("Solving...")).toBeVisible();
    await expect(actions(page)).toHaveCount(0);
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    await expect(actions(page)).toBeVisible();

    const shown = (await display.textContent())!;
    await plus2(page).click();
    await expect(display).toHaveText(/\+$/);
    expect(await display.textContent()).not.toBe(shown);

    // Space with the +2 button focused starts the next solve, not a toggle.
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    await expect(page.getByText("Solving...")).toBeVisible();
    await expect(actions(page)).toHaveCount(0);
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    await expect(actions(page)).toBeVisible();

    const solves = await storedSolves(page);
    expect(solves).toHaveLength(3);
    expect(solves[1]).toMatchObject({ penalty: 1, dnf: false });
    expect(solves[2]).toMatchObject({ penalty: 0, dnf: false });
  });

  test.describe("phone", () => {
    test.use(PHONE);

    test("tapping +2 / DNF never arms the timer", async ({ page }) => {
      await seed(page);
      await page.goto("/");
      const pad = page.getByTestId("start-pad");
      await expect(pad).toBeVisible();

      // startDelayMs 0: a tap on the pad starts, the next tap stops.
      await pad.tap();
      await expect(pad).toHaveAttribute("data-state", "running");
      await pad.tap();
      await expect(actions(page)).toBeVisible();
      await expect(pad).toHaveAttribute("data-state", "idle");

      // Buttons sit outside the start pad.
      expect(await pad.locator('[data-testid="last-solve-actions"]').count()).toBe(0);

      await dnf(page).tap();
      await expect(page.getByTestId("timer-display")).toHaveText("DNF");
      await page.waitForTimeout(300);
      await expect(pad).toHaveAttribute("data-state", "idle");
      await expect(page.getByText("Hold here to start")).toBeVisible();

      await plus2(page).tap();
      await expect(page.getByTestId("timer-display")).toHaveText(/\+$/);
      await page.waitForTimeout(300);
      await expect(pad).toHaveAttribute("data-state", "idle");
      await expect.poll(async () => (await storedSolves(page)).length).toBe(2);
      await expect.poll(async () => (await storedSolves(page)).at(-1)).toMatchObject({ penalty: 1, dnf: false });
    });
  });
});
