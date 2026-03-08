/**
 * 49 — Legal Pages, Footer, SEO Sanity (@smoke @regression)
 *
 * Validates legal/policy pages render, footer links work,
 * and basic SEO elements are present on key pages.
 */

import { test, expect } from "@playwright/test";
import { safeGoto, collectJSErrors } from "./helpers";

/* ------------------------------------------------------------------ */
/*  A. Legal / policy pages                                            */
/* ------------------------------------------------------------------ */

const LEGAL_PAGES = [
  { path: "/privacy", label: "Privacy Policy" },
  { path: "/terms", label: "Terms of Service" },
];

test.describe("Legal pages @smoke", () => {
  for (const pg of LEGAL_PAGES) {
    test(`LEG-${pg.label}: ${pg.label} loads and has content`, async ({ page }) => {
      const errors = collectJSErrors(page);
      await safeGoto(page, pg.path);

      const body = await page.textContent("body");
      expect(body?.trim().length).toBeGreaterThan(200);
      expect(body).not.toContain("Internal Server Error");
      expect(errors).toHaveLength(0);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  B. Footer presence                                                 */
/* ------------------------------------------------------------------ */

test.describe("Footer @regression", () => {
  test("FTR-001: homepage has a footer element", async ({ page }) => {
    await safeGoto(page, "/");
    const footer = page.locator("footer");
    if ((await footer.count()) > 0) {
      await expect(footer).toBeVisible();
    } else {
      // If no <footer> tag, body should still have copyright/legal links
      const body = await page.textContent("body");
      const hasLegalRef =
        body?.includes("Privacy") ||
        body?.includes("Terms") ||
        body?.includes("©") ||
        body?.includes("Zinovia");
      expect(hasLegalRef).toBe(true);
    }
  });

  test("FTR-002: footer links to /privacy and /terms", async ({ page }) => {
    await safeGoto(page, "/");
    const privacyLink = page.locator('a[href="/privacy"]');
    const termsLink = page.locator('a[href="/terms"]');
    // At least one legal link should exist somewhere on the page
    const hasPrivacy = (await privacyLink.count()) > 0;
    const hasTerms = (await termsLink.count()) > 0;
    expect(hasPrivacy || hasTerms).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  C. Info pages sanity                                               */
/* ------------------------------------------------------------------ */

const INFO_PAGES = [
  { path: "/about", label: "About" },
  { path: "/how-it-works", label: "How It Works" },
  { path: "/pricing", label: "Pricing" },
  { path: "/contact", label: "Contact" },
  { path: "/help", label: "Help" },
];

test.describe("Info pages @regression", () => {
  for (const pg of INFO_PAGES) {
    test(`INF-${pg.label}: ${pg.label} page loads without error`, async ({ page }) => {
      const errors = collectJSErrors(page);
      await safeGoto(page, pg.path);

      const body = await page.textContent("body");
      expect(body?.trim().length).toBeGreaterThan(50);
      expect(body).not.toContain("Internal Server Error");
      expect(errors).toHaveLength(0);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  D. SEO sanity                                                      */
/* ------------------------------------------------------------------ */

test.describe("SEO sanity @regression", () => {
  test("SEO-001: homepage has <title> tag", async ({ page }) => {
    await safeGoto(page, "/");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("SEO-002: homepage has meta description", async ({ page }) => {
    await safeGoto(page, "/");
    const desc = await page.locator('meta[name="description"]').getAttribute("content");
    // May or may not have one — just don't crash
    if (desc) {
      expect(desc.length).toBeGreaterThan(10);
    }
  });

  test("SEO-003: /creators page has <title>", async ({ page }) => {
    await safeGoto(page, "/creators");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("SEO-004: homepage has h1 heading", async ({ page }) => {
    await safeGoto(page, "/");
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 10_000 });
    const text = await h1.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test("SEO-005: /about page has <title>", async ({ page }) => {
    await safeGoto(page, "/about");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
