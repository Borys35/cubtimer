import { test, expect } from "@playwright/test";

type ManifestIcon = { src: string; sizes: string; type: string; purpose?: string };

test("web manifest is linked and served with the app fields", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();

  const res = await request.get(href!);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();

  expect(manifest).toMatchObject({
    name: "CubTimer",
    short_name: "CubTimer",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0B0E11",
    theme_color: "#0B0E11",
  });

  const icons: ManifestIcon[] = manifest.icons;
  const has = (sizes: string, purpose: string) =>
    icons.some((i) => i.sizes === sizes && (i.purpose ?? "any").split(" ").includes(purpose));
  expect(has("192x192", "any")).toBe(true);
  expect(has("512x512", "any")).toBe(true);
  expect(has("512x512", "maskable")).toBe(true);

  for (const icon of icons) {
    const img = await request.get(icon.src);
    expect(img.ok(), icon.src).toBe(true);
    expect(img.headers()["content-type"], icon.src).toContain("image/png");
    const body = await img.body();
    // PNG signature, and the IHDR width/height match the declared size.
    expect(body.subarray(0, 8).toString("hex"), icon.src).toBe("89504e470d0a1a0a");
    const [w, h] = icon.sizes.split("x").map(Number);
    expect(body.readUInt32BE(16), icon.src).toBe(w);
    expect(body.readUInt32BE(20), icon.src).toBe(h);
  }
});

test("iOS standalone and theme-color meta tags are set", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
  await expect(
    page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
  ).toHaveAttribute("content", "black-translucent");
  await expect(
    page.locator('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]'),
  ).toHaveAttribute("content", "#0B0E11");
  await expect(
    page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]'),
  ).toHaveAttribute("content", "#F5F3EF");
});

test("page title is descriptive while the home-screen label stays short", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("CubTimer – Speedcubing Timer & cstimer Progress Analyzer");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /WCA scrambles/);
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    "content",
    "CubTimer",
  );
});
