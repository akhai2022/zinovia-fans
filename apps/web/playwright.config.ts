import { defineConfig, devices } from "@playwright/test";
import path from "path";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? process.env.WEB_BASE_URL ?? "http://localhost:3000";

const apiBaseURL =
  process.env.API_BASE_URL ?? "http://127.0.0.1:8000";

const demoArtifactsDir = path.join(__dirname, "demo-artifacts");

export default defineConfig({
  testDir: "./e2e",
  outputDir: "/tmp/zinovia-pw-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "/tmp/zinovia-pw-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Realistic browser headers to avoid CloudFront WAF bot detection
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  },
  projects: [
    {
      name: "smoke",
      grep: /@smoke/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "regression",
      grepInvert: /@nightly/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "nightly",
      grep: /@nightly/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Demo — records video for stakeholder-facing walkthroughs.
    {
      name: "demo",
      grep: /@demo/,
      use: {
        ...devices["Desktop Chrome"],
        video: {
          mode: "on",
          size: { width: 1280, height: 720 },
        },
        screenshot: "on",
        trace: "on",
        viewport: { width: 1280, height: 720 },
      },
    },
    // Mobile — smoke coverage on mobile viewport.
    {
      name: "mobile",
      grep: /@mobile/,
      use: { ...devices["Pixel 5"] },
    },
    // Unfiltered — runs everything including @nightly. Use for local dev only.
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  timeout: 30_000,
  expect: { timeout: 10_000 },
});
