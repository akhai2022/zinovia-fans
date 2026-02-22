/**
 * STEP 06 — All public/static pages load without errors.
 */

import { test, expect } from "@playwright/test";

const PUBLIC_PAGES = [
  { path: "/", name: "Landing" },
  { path: "/creators", name: "Creators" },
  { path: "/about", name: "About" },
  { path: "/pricing", name: "Pricing" },
  { path: "/how-it-works", name: "How It Works" },
  { path: "/privacy", name: "Privacy" },
  { path: "/terms", name: "Terms" },
  { path: "/help", name: "Help" },
  { path: "/contact", name: "Contact" },
  { path: "/search", name: "Search" },
  { path: "/signup", name: "Signup" },
  { path: "/login", name: "Login" },
  { path: "/forgot-password", name: "Forgot Password" },
];

test.describe("Public Pages — HTTP 200 + No Crashes @smoke", { tag: "@smoke" }, () => {
  for (const pg of PUBLIC_PAGES) {
    test(`${pg.name} (${pg.path}) loads without error`, async ({ page }) => {
      const response = await page.goto(pg.path);
      expect(response?.status()).toBe(200);
      const body = await page.textContent("body");
      expect(body).not.toContain("Internal Server Error");
      expect(body).not.toContain("Application error");
    });
  }
});

test.describe("Auth-Gated Pages — Redirect for Anonymous", () => {
  const gatedPages = [
    "/feed",
    "/messages",
    "/notifications",
    "/settings/profile",
    "/me",
  ];

  for (const path of gatedPages) {
    test(`${path} redirects or shows login prompt for anonymous`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const url = page.url();
      const body = await page.textContent("body");
      const isHandled =
        url.includes("/login") ||
        body?.toLowerCase().includes("sign in") ||
        body?.toLowerCase().includes("log in");
      expect(isHandled).toBe(true);
    });
  }
});
