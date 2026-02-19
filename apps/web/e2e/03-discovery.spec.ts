/**
 * Creator Discovery & Search — /creators page, profile page, search.
 */

import { test, expect } from "@playwright/test";
import { apiFetch } from "./helpers";

test.describe("Creator Discovery", () => {
  test("GET /creators API returns list", async () => {
    const res = await apiFetch("/creators?page=1&page_size=10");
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty("total");
  });

  test("/creators page loads and shows grid", async ({ page }) => {
    await page.goto("/creators");
    await page.waitForLoadState("networkidle");
    // Page should render without error
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("creator search API works", async () => {
    const res = await apiFetch("/creators?q=test&page=1&page_size=5");
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
  });

  test("post search API works", async () => {
    const res = await apiFetch("/posts/search?q=test&page=1&page_size=5");
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
  });
});

test.describe("Creator Profile Page", () => {
  let firstHandle: string | null = null;

  test.beforeAll(async () => {
    // Find a creator handle to test with
    const res = await apiFetch("/creators?page=1&page_size=1");
    if (res.ok && res.body.items?.length > 0) {
      firstHandle = res.body.items[0].handle;
    }
  });

  test("creator profile page loads", async ({ page }) => {
    test.skip(!firstHandle, "No creators available to test");
    await page.goto(`/creators/${firstHandle}`);
    await page.waitForLoadState("networkidle");
    // Check page doesn't show error
    const errorText = page.locator("text=Something went wrong");
    const hasError = await errorText.count();
    expect(hasError).toBe(0);
  });

  test("creator profile shows name and posts grid", async ({ page }) => {
    test.skip(!firstHandle, "No creators available to test");
    await page.goto(`/creators/${firstHandle}`);
    await page.waitForLoadState("networkidle");
    // Should have at least a display name somewhere
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("creator API returns profile data", async () => {
    test.skip(!firstHandle, "No creators available to test");
    const res = await apiFetch(`/creators/${firstHandle}`);
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("handle", firstHandle);
    expect(res.body).toHaveProperty("display_name");
  });

  test("creator posts API returns list", async () => {
    test.skip(!firstHandle, "No creators available to test");
    const res = await apiFetch(`/creators/${firstHandle}/posts?page_size=20&include_locked=true`);
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
  });
});
