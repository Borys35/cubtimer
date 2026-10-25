import { test, expect, type BrowserContext, type Page } from "@playwright/test";

// Update-available toast (#25). A "deploy" is simulated by registering the
// worker under a new script URL (see deployUpdate): the browser installs it
// as a new worker, which waits (skipWaiting: false).
//
// Runs against the local production build only (no service worker in dev,
// and the prod smoke target can't be made to "deploy").
test.skip(Boolean(process.env.SMOKE_TARGET), "checks the local production build");

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

/**
 * Once a "deploy" has happened in this tab, every registration (Serwist's
 * client entry included) asks for the worker under a new script URL. The
 * browser treats a changed script URL as a new worker version, even with
 * identical bytes, and later page loads register the same URL again, so no
 * further update follows the reload.
 */
async function rewriteWorkerUrlAfterDeploy(context: BrowserContext) {
  await context.addInitScript(() => {
    const register = ServiceWorkerContainer.prototype.register;
    ServiceWorkerContainer.prototype.register = function (url, options) {
      const deploy = sessionStorage.getItem("e2e-deploy");
      if (deploy) {
        const u = new URL(url, location.href);
        u.searchParams.set("deploy", deploy);
        url = u.href;
      }
      return register.call(this, url, options);
    };
  });
}

/**
 * Simulates a deploy and waits until the new worker is installed and waiting.
 *
 * Playwright can't intercept the browser's own sw.js update fetch
 * (`context.route` never sees it), so a byte-changed sw.js can't be served
 * that way; a new script URL triggers the same install-and-wait path.
 */
async function deployUpdate(page: Page) {
  await page.evaluate(async () => {
    sessionStorage.setItem("e2e-deploy", "1");
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  });
  await expect
    .poll(
      () =>
        page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state ?? null),
      { timeout: 60_000 },
    )
    .toBe("installed");
}

const toast = (page: Page) => page.getByTestId("update-toast");

test.beforeEach(async ({ context }) => {
  await rewriteWorkerUrlAfterDeploy(context);
});

test("an update while idle shows the toast; Reload activates the new worker", async ({ page }) => {
  await installServiceWorker(page);
  await expect(toast(page)).toHaveCount(0);

  await deployUpdate(page);

  await expect(toast(page)).toBeVisible();
  await expect(toast(page)).toContainText("New version available");

  // Stays until Reload is tapped.
  await page.waitForTimeout(4_000);
  await expect(toast(page)).toBeVisible();

  let reloads = 0;
  page.on("load", () => reloads++);
  const reloaded = page.waitForEvent("load");
  await toast(page).getByRole("button", { name: "Reload" }).click();
  await reloaded;

  await expect(page.getByTestId("timer-display")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        const controller = navigator.serviceWorker.controller;
        return {
          waiting: Boolean(reg?.waiting),
          controllerState: controller?.state ?? null,
          controllerIsNewVersion: Boolean(controller?.scriptURL.includes("deploy=1")),
        };
      }),
    )
    .toEqual({ waiting: false, controllerState: "activated", controllerIsNewVersion: true });
  await page.waitForTimeout(1_000);
  expect(reloads).toBe(1);
  await expect(toast(page)).toHaveCount(0);
});

test("an update mid-solve waits until the timer is idle again", async ({ page }) => {
  await installServiceWorker(page);
  await expect(page.getByTestId("timer-display")).toBeVisible();

  // Hold space: armed.
  await page.keyboard.down("Space");
  await expect(page.getByText("Ready...")).toBeVisible();
  await deployUpdate(page);
  await page.waitForTimeout(1_000);
  await expect(toast(page)).toHaveCount(0);

  // Release: running.
  await page.keyboard.up("Space");
  await expect(page.getByText("Solving...")).toBeVisible();
  await page.waitForTimeout(1_000);
  await expect(toast(page)).toHaveCount(0);

  // Stop: idle, and the deferred toast appears.
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await expect(page.getByText("Solving...")).toHaveCount(0);
  await expect(toast(page)).toBeVisible();
});

test("a worker already waiting at page load shows the toast on non-timer pages", async ({ page }) => {
  await installServiceWorker(page);
  await deployUpdate(page);

  await page.goto("/stats");
  await expect(page.getByText(/no solves yet/i)).toBeVisible();
  await expect(toast(page)).toBeVisible();
});
