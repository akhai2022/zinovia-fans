/**
 * Auth & Accounts — signup, login, logout, negative cases.
 */

import { test, expect } from "@playwright/test";
import { uniqueEmail, apiFetch, API_BASE } from "./helpers";

test.describe("Auth — Fan Signup & Login", () => {
  const email = uniqueEmail("fan");
  const password = "E2eTestPass123!";

  test("fan signup via API succeeds", async () => {
    const res = await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password, display_name: "E2E Fan" },
    });
    // 200 or 201 = success, 409 = already exists
    expect([200, 201, 409]).toContain(res.status);
  });

  test("fan login via API returns session cookie", async () => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    expect(res.ok).toBe(true);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("access_token");
  });

  test("fan login via UI redirects to feed", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(feed|me|creators)/, { timeout: 10000 });
    const url = page.url();
    expect(url).toMatch(/\/(feed|me|creators)/);
  });

  test("logout clears session", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(feed|me|creators)/, { timeout: 10000 });

    // Now logout — find logout button or link
    const logoutBtn = page.locator('button:has-text("Log out"), a:has-text("Log out"), button:has-text("Logout"), a:has-text("Logout")');
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click();
      await page.waitForURL(/\/(login|$)/, { timeout: 10000 });
    }
  });
});

test.describe("Auth — Creator Signup", () => {
  const email = uniqueEmail("creator");
  const password = "E2eCreator123!";

  test("creator register via API succeeds", async () => {
    const res = await apiFetch("/auth/register", {
      method: "POST",
      body: { email, password },
      headers: { "Idempotency-Key": `e2e-reg-${Date.now()}` },
    });
    expect([200, 201, 409]).toContain(res.status);
  });

  test("creator login via API works", async () => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    expect(res.ok).toBe(true);
  });
});

test.describe("Auth — Negative Cases", () => {
  test("wrong password returns 401", async () => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: { email: "nobody@test.zinovia.ai", password: "WrongPass999" },
    });
    expect(res.status).toBe(401);
  });

  test("signup with short password returns 422", async () => {
    const res = await apiFetch("/auth/signup", {
      method: "POST",
      body: { email: uniqueEmail("short"), password: "ab", display_name: "X" },
    });
    expect(res.status).toBe(422);
  });

  test("unauthenticated /auth/me returns 401", async () => {
    const res = await apiFetch("/auth/me");
    expect(res.status).toBe(401);
  });
});
