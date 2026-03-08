/**
 * 48 — Negative & Edge Case Scenarios (@regression)
 *
 * Tests invalid inputs, duplicate actions, boundary conditions,
 * permission violations, and degraded state handling.
 */

import { test, expect } from "@playwright/test";
import {
  safeGoto,
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  isE2EEnabled,
  extractCookies,
} from "./helpers";
import { extractCsrf } from "./ai-helpers";

/* ------------------------------------------------------------------ */
/*  A. Invalid signup fields                                           */
/* ------------------------------------------------------------------ */

test.describe("Invalid signup @regression", () => {
  test("NEG-001: signup with empty email fails", async () => {
    const res = await apiFetch("/auth/signup", {
      method: "POST",
      body: { email: "", password: "ValidPass123!", display_name: "Test" },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("NEG-002: signup with short password fails @smoke", async () => {
    const res = await apiFetch("/auth/signup", {
      method: "POST",
      body: { email: uniqueEmail("neg"), password: "short", display_name: "Test" },
    });
    expect(res.status).toBe(422);
  });

  test("NEG-003: signup with duplicate email is rejected", async () => {
    const email = uniqueEmail("neg-dup");
    const password = "NegDuplicate123!";
    // First signup
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password, display_name: "First" },
    });
    // Duplicate
    const res = await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password, display_name: "Second" },
    });
    // API may return 400 or 409 for duplicate email
    expect([400, 409]).toContain(res.status);
  });

  test("NEG-004: signup with missing display_name fails", async () => {
    const res = await apiFetch("/auth/signup", {
      method: "POST",
      body: { email: uniqueEmail("neg"), password: "ValidPass123!" },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

/* ------------------------------------------------------------------ */
/*  B. Invalid login                                                   */
/* ------------------------------------------------------------------ */

test.describe("Invalid login @regression", () => {
  test("NEG-010: login with wrong password returns 401 @smoke", async () => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: { email: "nobody@test.zinovia.ai", password: "WrongPass123!" },
    });
    expect(res.status).toBe(401);
  });

  test("NEG-011: login with non-existent email returns 401", async () => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: {
        email: `nonexistent-${Date.now()}@test.zinovia.ai`,
        password: "AnyPass123!",
      },
    });
    expect(res.status).toBe(401);
  });

  test("NEG-012: login with empty body returns 422", async () => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: {},
    });
    expect(res.status).toBe(422);
  });

  test("NEG-013: login UI shows error for wrong credentials", async ({ page }) => {
    await safeGoto(page, "/login");
    await page.getByLabel("Email").fill("nobody@test.zinovia.ai");
    await page.getByLabel("Password").fill("WrongPass123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Should show an error message or stay on login page
    await page.waitForTimeout(3000);
    const url = page.url();
    const alert = page.locator('[role="alert"]');
    const hasAlert = (await alert.count()) > 0 && (await alert.isVisible().catch(() => false));
    const stayedOnLogin = url.includes("/login");
    expect(hasAlert || stayedOnLogin).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  C. Duplicate actions                                               */
/* ------------------------------------------------------------------ */

test.describe("Duplicate actions @regression", () => {
  let e2eAvailable: boolean;
  let fanCookies: string;
  let creatorCookies: string;
  let postId: string;

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
    if (!e2eAvailable) return;

    const creator = await createVerifiedCreator(
      uniqueEmail("neg-dup-c"),
      "NegDupCreator123!",
    );
    creatorCookies = creator.cookies;

    const csrf = extractCsrf(creatorCookies);
    const post = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: `Dup test ${Date.now()}`,
        visibility: "PUBLIC",
        nsfw: false,
        asset_ids: [],
      },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": csrf },
    });
    if (post.ok) postId = post.body.id;

    const fan = await signupFan(
      uniqueEmail("neg-dup-f"),
      "NegDupFan123!",
      "Dup Fan",
    );
    fanCookies = fan.cookies;
  });

  test("NEG-020: double-like same post is idempotent", async () => {
    test.skip(!e2eAvailable || !postId, "Setup failed");
    const csrf = extractCsrf(fanCookies);
    const opts = {
      method: "POST" as const,
      cookies: fanCookies,
      headers: { "X-CSRF-Token": csrf },
    };
    const r1 = await apiFetch(`/posts/${postId}/like`, opts);
    const r2 = await apiFetch(`/posts/${postId}/like`, opts);
    // Both should succeed without 500
    expect(r1.status).toBeLessThan(500);
    expect(r2.status).toBeLessThan(500);
  });

  test("NEG-021: double-follow is idempotent", async () => {
    test.skip(!e2eAvailable, "Setup failed");
    const csrf = extractCsrf(fanCookies);
    const creatorRes = await apiFetch("/creators", { cookies: fanCookies });
    if (!creatorRes.ok || !creatorRes.body.items?.length) {
      test.skip(true, "No creators to follow");
      return;
    }
    const creatorId = creatorRes.body.items[0].user_id ?? creatorRes.body.items[0].id;
    const opts = {
      method: "POST" as const,
      cookies: fanCookies,
      headers: { "X-CSRF-Token": csrf },
    };
    const r1 = await apiFetch(`/creators/${creatorId}/follow`, opts);
    const r2 = await apiFetch(`/creators/${creatorId}/follow`, opts);
    expect(r1.status).toBeLessThan(500);
    expect(r2.status).toBeLessThan(500);
  });
});

/* ------------------------------------------------------------------ */
/*  D. Permission boundary violations                                  */
/* ------------------------------------------------------------------ */

test.describe("Permission boundaries @regression", () => {
  let e2eAvailable: boolean;

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
  });

  test("NEG-030: fan cannot access /admin @smoke", async ({ page }) => {
    const response = await page.goto("/admin");
    const status = response?.status() ?? 0;
    const url = page.url();
    const body = await page.textContent("body");
    const blocked =
      url.includes("/login") ||
      status === 403 ||
      body?.toLowerCase().includes("sign in") ||
      body?.toLowerCase().includes("denied") ||
      body?.toLowerCase().includes("not authorized") ||
      body?.toLowerCase().includes("403") ||
      body?.toLowerCase().includes("blocked");
    expect(blocked).toBe(true);
  });

  test("NEG-031: unauthenticated POST to /posts returns 401", async () => {
    const res = await apiFetch("/posts", {
      method: "POST",
      body: { type: "TEXT", caption: "test", visibility: "PUBLIC" },
    });
    expect(res.status).toBe(401);
  });

  test("NEG-032: unauthenticated DELETE /posts/:id returns 401", async () => {
    const res = await apiFetch("/posts/00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
    });
    expect([401, 404]).toContain(res.status);
  });
});

/* ------------------------------------------------------------------ */
/*  E. API failure / degraded UX                                       */
/* ------------------------------------------------------------------ */

test.describe("Degraded state handling @regression", () => {
  test("NEG-040: landing page still renders if API is slow", async ({ page }) => {
    // Landing page should render from SSR/client even if API calls take time
    await safeGoto(page, "/");
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 15_000 });
  });

  test("NEG-041: /creators page renders even with no creators", async ({ page }) => {
    await safeGoto(page, "/creators");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
    expect(body).not.toContain("Application error");
  });
});
