import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3000";

const apiBaseURL =
  process.env.API_BASE_URL ?? "https://api.zinovia.ai";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "/tmp/zinovia-pw-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "/tmp/zinovia-pw-report", open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    extraHTTPHeaders: {
      "Accept": "application/json",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  timeout: 30000,
  expect: { timeout: 10000 },
});
