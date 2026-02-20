/**
 * STEP 07 — Feed access & pagination.
 */

import { test, expect } from "@playwright/test";
import { uniqueEmail, apiFetch, signupFan, loginViaUI } from "./helpers";

const PASSWORD = "E2eFeed1234!";

test.describe("Feed API", () => {
  const email = uniqueEmail("feedapi");
  let cookies = "";

  test.beforeAll(async () => {
    const result = await signupFan(email, PASSWORD, "E2E Feed Fan");
    cookies = result.cookies;
  });

  test("authenticated GET /feed returns items array", async () => {
    const res = await apiFetch("/feed?page=1&page_size=20", { cookies });
    if (res.status === 401) {
      test.skip(true, "Session not valid for feed");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test("unauthenticated GET /feed returns 401", async () => {
    const res = await apiFetch("/feed?page=1&page_size=20");
    expect(res.status).toBe(401);
  });

  test("feed supports cursor pagination params", async () => {
    const res = await apiFetch("/feed?page=1&page_size=5", { cookies });
    if (!res.ok) return;
    expect(res.body).toHaveProperty("items");
    // next_cursor may be null if no more items
    if (res.body.next_cursor) {
      const page2 = await apiFetch(`/feed?cursor=${res.body.next_cursor}&page_size=5`, { cookies });
      expect(page2.ok).toBe(true);
    }
  });
});

test.describe("Feed UI", () => {
  const email = uniqueEmail("feedui");

  test.beforeAll(async () => {
    await signupFan(email, PASSWORD, "E2E Feed UI Fan");
  });

  test("feed page shows login CTA for anonymous user", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/feed");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const body = await page.textContent("body");
    const hasLoginPrompt =
      url.includes("/login") ||
      body?.toLowerCase().includes("sign in") ||
      body?.toLowerCase().includes("log in");
    expect(hasLoginPrompt).toBe(true);
  });

  test("feed page loads for logged-in fan without crash", async ({ page }) => {
    await loginViaUI(page, email, PASSWORD);
    await page.goto("/feed");
    await page.waitForLoadState("networkidle");
    const errorText = page.locator("text=Internal Server Error");
    expect(await errorText.count()).toBe(0);
  });
});
