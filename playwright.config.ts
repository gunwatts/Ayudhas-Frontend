import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the REAL stack:
 *   backend:  uvicorn app.main:app on :8000 with a throwaway database (see docs/05_TESTING.md)
 *   frontend: the static export in out/ served on :3000
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@responsive/ },
  ],
});
