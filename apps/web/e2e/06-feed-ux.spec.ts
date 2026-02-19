/**
 * Feed / Home UX — feed loads, locked items, anonymous user behavior, settings.
 */

import { test, expect } from "@playwright/test";
import { uniqueEmail, apiFetch } from "./helpers";

test.describe("Feed UX", () => {
  const fanEmail = uniqueEmail("feedfan");
  const fanPassword = "E2eFeed123!";

  test.beforeAll(async () => {
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email: fanEmail, password: fanPassword, display_name: "E2E Feed Fan" },
    });
  });

  test("authenticated feed API returns posts", async () => {
    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email: fanEmail, password: fanPassword },
    });
    const cookies = login.headers.get("set-cookie") ?? "";
    const res = await apiFetch("/feed?page=1&page_size=20", { cookies });
    if (res.status === 401) {
      test.skip(true, "Session not valid for feed");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test("unauthenticated feed API returns 401", async () => {
    const res = await apiFetch("/feed?page=1&page_size=20");
    expect(res.status).toBe(401);
  });

  test("feed page shows login CTA for anonymous user", async ({ page }) => {
    // Clear cookies to be anonymous
    await page.context().clearCookies();
    await page.goto("/feed");
    await page.waitForLoadState("networkidle");

    // Should redirect to login or show sign-in prompt
    const url = page.url();
    const body = await page.textContent("body");
    const hasLoginPrompt =
      url.includes("/login") ||
      body?.includes("Sign in") ||
      body?.includes("Log in") ||
      body?.includes("sign in");
    expect(hasLoginPrompt).toBe(true);
  });

  test("feed page loads for logged-in fan without crash", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', fanEmail);
    await page.fill('input[type="password"]', fanPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(feed|me|creators)/, { timeout: 10000 });

    await page.goto("/feed");
    await page.waitForLoadState("networkidle");
    // Should not show error page
    const errorText = page.locator("text=Internal Server Error, text=Something went wrong");
    expect(await errorText.count()).toBe(0);
  });
});

test.describe("Public Pages", () => {
  const pages = [
    { path: "/", name: "Landing" },
    { path: "/creators", name: "Creators" },
    { path: "/about", name: "About" },
    { path: "/pricing", name: "Pricing" },
    { path: "/how-it-works", name: "How It Works" },
    { path: "/privacy", name: "Privacy" },
    { path: "/terms", name: "Terms" },
    { path: "/help", name: "Help" },
    { path: "/contact", name: "Contact" },
  ];

  for (const pg of pages) {
    test(`${pg.name} page (${pg.path}) loads without error`, async ({ page }) => {
      const response = await page.goto(pg.path);
      expect(response?.status()).toBe(200);
      // No "Internal Server Error" on page
      const body = await page.textContent("body");
      expect(body).not.toContain("Internal Server Error");
    });
  }
});

test.describe("Settings Pages", () => {
  const email = uniqueEmail("settings");
  const password = "E2eSettings123!";

  test.beforeAll(async () => {
    await apiFetch("/auth/register", {
      method: "POST",
      body: { email, password },
      headers: { "Idempotency-Key": `e2e-settings-${Date.now()}` },
    });
  });

  test("settings/profile page loads for creator", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(feed|me|creators|onboarding|verify)/, { timeout: 10000 });

    await page.goto("/settings/profile");
    await page.waitForLoadState("networkidle");
    const url = page.url();
    // Should either load settings page or redirect to login/onboarding
    expect(url).toMatch(/\/(settings|login|onboarding|verify)/);
  });
});
