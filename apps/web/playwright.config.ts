import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the CIE web app smoke suite.
 *
 * Scope: deliberately tiny. We only verify that key surfaces render
 * and contain the controls a demo presenter relies on. Full-system
 * integration (SSE → canvas → publish toast) is out of scope here
 * because it requires the FastAPI services on :8100.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
