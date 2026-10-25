import { defineConfig } from "@playwright/test";

const smoke = Boolean(process.env.SMOKE_TARGET);
// Override to run several checkouts' builds side by side.
const port = Number(process.env.E2E_PORT ?? 3117);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 150_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: smoke ? process.env.SMOKE_URL : `http://localhost:${port}`,
    viewport: { width: 1280, height: 900 },
  },
  webServer: smoke
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        port,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
