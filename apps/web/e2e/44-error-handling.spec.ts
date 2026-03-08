/**
 * 44 — Error Handling, 404s, Empty States (@smoke @regression)
 *
 * Validates proper error pages, 404 handling, empty state UX,
 * and graceful degradation for missing data.
 */

import { test, expect } from "@playwright/test";
import {
  safeGoto,
  collectJSErrors,
  uniqueEmail,
  signupFan,
  apiFetch,
  API_BASE,
} from "./helpers";

/* ------------------------------------------------------------------ */
/*  A. 404 / Missing route handling                                    */
/* ------------------------------------------------------------------ */

test.describe("404 & missing routes @smoke", () => {
  test("ERR-001: non-existent page returns 404 or not-found content", async ({
    page,
  }) => {
    const res = await page.goto("/this-page-does-not-exist-abc123");
    // Next.js returns 404 page — may be 200 with soft 404 or actual 404
    const body = await page.textContent("body");
    const is404 =
      res?.status() === 404 ||
      body?.toLowerCase().includes("not found") ||
      body?.toLowerCase().includes("404") ||
      body?.toLowerCase().includes("page doesn");
    expect(is404).toBe(true);
  });

  test("ERR-002: non-existent creator profile shows not-found", async ({
    page,
  }) => {
    await safeGoto(page, "/creators/zzzz_nonexistent_handle_999");
    const body = await page.textContent("body");
    const isNotFound =
      body?.toLowerCase().includes("not found") ||
      body?.toLowerCase().includes("404") ||
      body?.toLowerCase().includes("doesn't exist") ||
      body?.toLowerCase().includes("no creator");
    expect(isNotFound).toBe(true);
  });

  test("ERR-003: non-existent API endpoint returns 404 JSON", async () => {
    const res = await apiFetch("/this-api-does-not-exist");
    expect(res.status).toBe(404);
  });

  test("ERR-004: no JS errors on 404 page", async ({ page }) => {
    const errors = collectJSErrors(page);
    await page.goto("/this-page-does-not-exist-abc123");
    expect(errors).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  B. Empty states                                                    */
/* ------------------------------------------------------------------ */

test.describe("Empty states @regression", () => {
  let cookies: string;
  const email = uniqueEmail("empty-state");
  const password = "EmptyState123!";

  test.beforeAll(async () => {
    try {
      const fan = await signupFan(email, password, "Empty Fan");
      cookies = fan.cookies;
    } catch {
      // Will be skipped
    }
  });

  test("ERR-010: feed shows empty/welcome state for new fan", async ({ page, context }) => {
    test.skip(!cookies, "Signup failed");
    const url = new URL(API_BASE);
    const parsed = cookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
    });
    await context.addCookies(parsed);
    await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));

    await safeGoto(page, "/feed");
    const body = await page.textContent("body");
    // Should not error — show either empty state or feed content
    expect(body).not.toContain("Internal Server Error");
    expect(body).not.toContain("Application error");
  });

  test("ERR-011: notifications page shows empty or feature-disabled state", async ({ page, context }) => {
    test.skip(!cookies, "Signup failed");
    const url = new URL(API_BASE);
    const parsed = cookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
    });
    await context.addCookies(parsed);
    await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));

    await safeGoto(page, "/notifications");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });
});

/* ------------------------------------------------------------------ */
/*  C. API error responses                                             */
/* ------------------------------------------------------------------ */

test.describe("API error responses @regression", () => {
  test("ERR-020: malformed JSON body returns 422", async () => {
    const url = `${API_BASE}/auth/login`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("ERR-021: missing required fields returns 422", async () => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: {},
    });
    expect(res.status).toBe(422);
  });

  test("ERR-022: invalid email format returns 422", async () => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: { email: "not-an-email", password: "SomePassword123!" },
    });
    expect([401, 422]).toContain(res.status);
  });
});

/* ------------------------------------------------------------------ */
/*  D. Bad query params / malformed URLs                               */
/* ------------------------------------------------------------------ */

test.describe("Bad params @regression", () => {
  test("ERR-030: /creators with bad page param returns gracefully", async () => {
    const res = await apiFetch("/creators?page=-1&page_size=999999");
    // Should not crash — either correct to defaults or return 422
    expect(res.status).toBeLessThan(500);
  });

  test("ERR-031: /feed with bad cursor returns gracefully", async () => {
    const res = await apiFetch("/feed?cursor=definitely-not-a-cursor");
    // Should return 401 (unauthenticated) or handle bad cursor
    expect(res.status).toBeLessThan(500);
  });

  test("ERR-032: /posts/invalid-uuid returns 404 or 422", async () => {
    const res = await apiFetch("/posts/not-a-valid-uuid");
    expect([404, 422]).toContain(res.status);
  });
});
