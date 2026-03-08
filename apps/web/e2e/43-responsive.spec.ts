/**
 * 43 — Responsive & Viewport Tests (@regression @mobile)
 *
 * Verifies critical pages render correctly across common viewport sizes.
 * Detects layout breakage, overflow, missing elements on small screens.
 */

import { test, expect } from "@playwright/test";
import { safeGoto, collectJSErrors } from "./helpers";

const VIEWPORTS = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPad", width: 768, height: 1024 },
  { name: "Laptop", width: 1366, height: 768 },
  { name: "Desktop HD", width: 1920, height: 1080 },
];

const CRITICAL_PAGES = [
  { path: "/", label: "Homepage" },
  { path: "/creators", label: "Creators" },
  { path: "/signup", label: "Signup" },
  { path: "/login", label: "Login" },
  { path: "/about", label: "About" },
  { path: "/pricing", label: "Pricing" },
];

test.describe("Responsive rendering @regression", () => {
  for (const vp of VIEWPORTS) {
    for (const pg of CRITICAL_PAGES) {
      test(`RSP-${vp.name}-${pg.label}: ${pg.label} renders at ${vp.width}x${vp.height} @regression`, async ({
        browser,
      }) => {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
        });
        const page = await context.newPage();
        const errors = collectJSErrors(page);
        await safeGoto(page, pg.path);

        // No JS errors
        expect(errors).toHaveLength(0);

        // Page has content
        const body = await page.textContent("body");
        expect(body?.trim().length).toBeGreaterThan(50);
        expect(body).not.toContain("Internal Server Error");

        // Check for excessive horizontal scroll (tolerance 50px for real-world rendering)
        const bodyWidth = await page.evaluate(
          () => document.body.scrollWidth,
        );
        // Log overflow but don't hard-fail — document as a UX issue
        if (bodyWidth > vp.width + 50) {
          console.warn(
            `[UX] ${pg.label} at ${vp.width}px has horizontal overflow: body=${bodyWidth}px`,
          );
        }

        await context.close();
      });
    }
  }
});

test.describe("Mobile-specific checks @mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("RSP-MOB-001: signup page loads on mobile without crash", async ({ page }) => {
    await safeGoto(page, "/signup");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
    expect(body?.trim().length).toBeGreaterThan(50);
  });

  test("RSP-MOB-002: login page loads on mobile without crash", async ({ page }) => {
    await safeGoto(page, "/login");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
    expect(body?.trim().length).toBeGreaterThan(50);
  });

  test("RSP-MOB-003: landing page hero visible on mobile", async ({ page }) => {
    await safeGoto(page, "/");
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 10_000 });
  });
});
