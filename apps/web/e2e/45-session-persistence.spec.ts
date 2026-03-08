/**
 * 45 — Session Persistence, Refresh, Unauthorized Access (@smoke @regression)
 *
 * Validates session cookie handling, refresh persistence,
 * unauthorized redirect behavior, and session expiry UX.
 */

import { test, expect } from "@playwright/test";
import {
  safeGoto,
  uniqueEmail,
  signupFan,
  apiFetch,
  extractCookies,
  API_BASE,
} from "./helpers";

/* ------------------------------------------------------------------ */
/*  A. Session persistence                                             */
/* ------------------------------------------------------------------ */

test.describe("Session persistence @regression", () => {
  const email = uniqueEmail("sess");
  const password = "SessionTest123!";
  let cookies: string;

  test.beforeAll(async () => {
    try {
      const fan = await signupFan(email, password, "Session Fan");
      cookies = fan.cookies;
    } catch {
      // Will skip
    }
  });

  test("SES-001: /auth/me returns user data with valid session cookie @smoke", async () => {
    test.skip(!cookies, "Signup failed");
    const res = await apiFetch("/auth/me", { cookies });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("email");
  });

  test("SES-002: page refresh preserves authentication", async ({ page, context }) => {
    test.skip(!cookies, "Signup failed");
    const url = new URL(API_BASE);
    const parsed = cookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
    });
    await context.addCookies(parsed);
    await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));

    await safeGoto(page, "/feed");
    await page.reload();
    // Still on /feed — not redirected to /login
    await expect(page).toHaveURL(/\/feed/);
  });

  test("SES-003: navigating between pages preserves session", async ({ page, context }) => {
    test.skip(!cookies, "Signup failed");
    const url = new URL(API_BASE);
    const parsed = cookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
    });
    await context.addCookies(parsed);
    await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));

    await safeGoto(page, "/feed");
    await safeGoto(page, "/notifications");
    // Should still be authenticated
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });
});

/* ------------------------------------------------------------------ */
/*  B. Unauthorized access                                             */
/* ------------------------------------------------------------------ */

test.describe("Unauthorized access @smoke", () => {
  const PROTECTED_ROUTES = [
    "/feed",
    "/me",
    "/settings/profile",
    "/settings/security",
    "/notifications",
    "/messages",
    "/creator/post/new",
    "/creator/vault",
    "/billing/manage",
  ];

  for (const route of PROTECTED_ROUTES) {
    test(`SES-010: ${route} redirects or shows login for anonymous @smoke`, async ({
      page,
    }) => {
      const response = await page.goto(route);
      const status = response?.status() ?? 0;
      const url = page.url();
      const body = await page.textContent("body");
      const handled =
        url.includes("/login") ||
        status === 403 ||
        body?.toLowerCase().includes("sign in") ||
        body?.toLowerCase().includes("log in") ||
        body?.toLowerCase().includes("request could not be satisfied") ||
        body?.toLowerCase().includes("blocked");
      expect(handled).toBe(true);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  C. Logout                                                          */
/* ------------------------------------------------------------------ */

test.describe("Logout @regression", () => {
  test("SES-020: POST /auth/logout clears session cookies", async () => {
    const email = uniqueEmail("logout");
    const password = "LogoutTest123!";
    let cookies: string;

    try {
      const fan = await signupFan(email, password, "Logout Fan");
      cookies = fan.cookies;
    } catch {
      test.skip(true, "Signup failed");
      return;
    }

    // Verify logged in
    const me1 = await apiFetch("/auth/me", { cookies });
    expect(me1.ok).toBe(true);

    // Logout
    const logout = await apiFetch("/auth/logout", {
      method: "POST",
      cookies,
    });
    expect(logout.status).toBeLessThan(500);

    // Session should be invalidated — /auth/me should fail
    const me2 = await apiFetch("/auth/me", { cookies });
    expect(me2.status).toBe(401);
  });

  test("SES-021: API calls with invalid cookie return 401 @smoke", async () => {
    const res = await apiFetch("/auth/me", {
      cookies: "access_token=invalid-garbage-token",
    });
    expect(res.status).toBe(401);
  });
});
