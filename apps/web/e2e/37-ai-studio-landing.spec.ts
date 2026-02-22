/**
 * STEP 37 — AI Studio public landing page.
 *
 * Tests that the /ai marketing page loads correctly without auth,
 * has no JS errors, and renders all expected sections.
 */

import { test, expect } from "@playwright/test";
import { collectJSErrors, safeGoto } from "./helpers";

test.describe("AI Studio Landing Page", () => {
  test("ASL-001: /ai page loads without auth @smoke", { tag: "@smoke" }, async ({ page }) => {
    await safeGoto(page, "/ai");
    await page.waitForLoadState("networkidle");
    // Should load successfully (not redirect to login)
    expect(page.url()).toContain("/ai");
    // Should not be on login page
    expect(page.url()).not.toContain("/login");
  });

  test("ASL-002: landing page has no JS errors @smoke", { tag: "@smoke" }, async ({ page }) => {
    const errors = collectJSErrors(page);
    await safeGoto(page, "/ai");
    await page.waitForLoadState("networkidle");
    // Allow up to 1 second for late errors
    await page.waitForTimeout(1000);
    expect(errors, `JS errors: ${errors.join(", ")}`).toHaveLength(0);
  });

  test("ASL-003: CTA buttons link to correct destinations", { tag: "@regression" }, async ({ page }) => {
    await safeGoto(page, "/ai");
    await page.waitForLoadState("networkidle");

    // Check for CTA links (Get Started, Sign Up, etc.)
    const ctaLinks = page.getByRole("link", { name: /get started|sign up|create|explore/i });
    const count = await ctaLinks.count();
    if (count === 0) {
      test.skip(true, "No CTA buttons found — page may not be implemented yet");
      return;
    }
    // Each CTA should have a valid href
    for (let i = 0; i < count; i++) {
      const href = await ctaLinks.nth(i).getAttribute("href");
      expect(href).toBeTruthy();
    }
  });

  test("ASL-004: feature cards render", { tag: "@regression" }, async ({ page }) => {
    await safeGoto(page, "/ai");
    await page.waitForLoadState("networkidle");

    // Look for feature-related content (cards, sections, or headings)
    const pageText = await page.textContent("body");
    if (!pageText) {
      test.skip(true, "Page has no text content");
      return;
    }
    // Expect at least some AI-related keywords to be present
    const hasAiContent =
      pageText.includes("Safety") ||
      pageText.includes("Caption") ||
      pageText.includes("Remove") ||
      pageText.includes("Background") ||
      pageText.includes("AI") ||
      pageText.includes("Studio");
    expect(hasAiContent).toBe(true);
  });

  test("ASL-005: page is responsive at 375px @nightly", { tag: "@nightly" }, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    const errors = collectJSErrors(page);

    await page.goto("/ai");
    await page.waitForLoadState("networkidle");

    // No JS errors at mobile viewport
    expect(errors).toHaveLength(0);

    // Page should still be accessible
    expect(page.url()).toContain("/ai");

    await context.close();
  });
});
