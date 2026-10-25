import { test, expect, type Page } from "@playwright/test";

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

/** Fire a fake Chromium beforeinstallprompt; `window.__prompted` counts prompt() calls. */
async function fireInstallPrompt(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __prompted: number };
    w.__prompted = 0;
    const e = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(e, {
      prompt: async () => {
        w.__prompted++;
      },
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    window.dispatchEvent(e);
  });
}

/** Make `(display-mode: standalone)` match, as in the Installed app. */
async function mockStandalone(page: Page) {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => {
      if (!q.includes("display-mode: standalone")) return real(q);
      const mql = real("all"); // a live MediaQueryList that always matches
      return Object.defineProperty(mql, "media", { value: q });
    };
  });
}

const install = (page: Page) => page.getByRole("button", { name: "Install" });
const menu = (page: Page) => page.getByRole("button", { name: "Menu" });
const nav = (page: Page) => page.getByRole("navigation");

test.describe("phone", () => {
  test.use(PHONE);

  test("links and theme toggle live only in the ☰ Nav menu", async ({ page }) => {
    await page.goto("/");
    await expect(menu(page)).toBeVisible();
    await expect(menu(page)).toHaveAttribute("aria-expanded", "false");
    for (const name of ["Timer", "Stats", "Settings"]) {
      await expect(nav(page).getByRole("link", { name, exact: true })).toBeHidden();
    }
    await expect(nav(page).getByRole("button", { name: /^Theme:/ })).toBeHidden();

    await menu(page).click();
    await expect(menu(page)).toHaveAttribute("aria-expanded", "true");
    const dropdown = page.locator("#nav-menu");
    for (const name of ["Timer", "Stats", "Settings"]) {
      await expect(dropdown.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(dropdown.getByRole("button", { name: /^Theme:/ })).toBeVisible();

    // Link click navigates and closes.
    await dropdown.getByRole("link", { name: "Stats" }).click();
    await expect(page).toHaveURL(/\/stats/);
    await expect(dropdown).toBeHidden();

    // Escape closes.
    await menu(page).click();
    await expect(dropdown).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dropdown).toBeHidden();

    // Outside click closes.
    await menu(page).click();
    await expect(dropdown).toBeVisible();
    await page.mouse.click(200, 700);
    await expect(dropdown).toBeHidden();
  });

  test("sessions toggle is separate from the Nav menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle sessions" }).click();
    await expect(menu(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("Install button shows in a browser tab once beforeinstallprompt fires", async ({ page }) => {
    await page.goto("/");
    await expect(menu(page)).toBeVisible(); // hydrated
    await expect(install(page)).toBeHidden(); // nothing to install with yet
    await fireInstallPrompt(page);
    await expect(install(page)).toBeVisible();
    await install(page).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted: number }).__prompted)).toBe(1);

    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(install(page)).toBeHidden();
  });

  test("Install button is hidden in the installed app", async ({ page }) => {
    await mockStandalone(page);
    await page.goto("/");
    await expect(menu(page)).toBeVisible();
    await fireInstallPrompt(page);
    await page.waitForTimeout(300);
    await expect(install(page)).toBeHidden();
  });
});

test.describe("iPhone", () => {
  test.use({ ...PHONE, userAgent: IPHONE_UA });

  test("Install opens the Add to Home Screen sheet", async ({ page }) => {
    await page.goto("/");
    await expect(install(page)).toBeVisible();
    await install(page).click();
    const sheet = page.getByRole("dialog", { name: "Install CubTimer" });
    await expect(sheet).toContainText("Share");
    await expect(sheet).toContainText("Add to Home Screen");
    await sheet.getByRole("button", { name: "Got it" }).click();
    await expect(sheet).toBeHidden();
    await expect(install(page)).toBeVisible(); // not dismissable
  });

  test("Install is hidden when navigator.standalone is true", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "standalone", { get: () => true, configurable: true });
    });
    await page.goto("/");
    await expect(menu(page)).toBeVisible();
    await page.waitForTimeout(300);
    await expect(install(page)).toBeHidden();
  });
});

test("desktop navbar keeps inline links and no Nav menu or Install", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Timer", "Stats", "Settings"]) {
    await expect(nav(page).getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(nav(page).getByRole("button", { name: /^Theme:/ })).toBeVisible();
  await expect(menu(page)).toBeHidden();
  await fireInstallPrompt(page);
  await page.waitForTimeout(300);
  await expect(install(page)).toBeHidden();
});
