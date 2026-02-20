/**
 * Page Object: Landing Page (/)
 */

import { type Locator, type Page, expect } from "@playwright/test";
import { safeGoto } from "../helpers";

export class LandingPage {
  readonly page: Page;
  readonly heroHeading: Locator;
  readonly ctaCreator: Locator;
  readonly ctaFan: Locator;
  readonly ctaGetStarted: Locator;
  readonly ctaBrowseCreators: Locator;
  readonly navbar: Locator;
  readonly signInButton: Locator;
  readonly signUpButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroHeading = page.locator("h1").first();
    this.ctaCreator = page.locator('a[href="/signup"]:has-text("Creator"), a[href="/signup"]:has-text("creator")').first();
    this.ctaFan = page.locator('a[href="/signup"]:has-text("Fan"), a[href="/signup"]:has-text("fan")').first();
    this.ctaGetStarted = page.locator('a[href="/signup"]').first();
    this.ctaBrowseCreators = page.locator('a[href="/creators"]').first();
    this.navbar = page.locator('[data-testid="navbar"]');
    this.signInButton = page.locator('a[href="/login"]').first();
    this.signUpButton = page.locator('a[href="/signup"]').first();
  }

  async goto() {
    await safeGoto(this.page, "/");
    await this.page.waitForLoadState("networkidle");
  }

  async expectHeroVisible() {
    await expect(this.heroHeading).toBeVisible({ timeout: 10_000 });
    const text = await this.heroHeading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  }

  async expectCtaVisible() {
    // At least one CTA button linking to /signup should be visible
    const signupLinks = this.page.locator('a[href="/signup"]');
    await expect(signupLinks.first()).toBeVisible({ timeout: 10_000 });
  }

  async expectNavbarVisible() {
    await expect(this.navbar).toBeVisible({ timeout: 10_000 });
  }

  async expectNoEmptyHero() {
    const body = await this.page.textContent("body");
    expect(body?.trim().length).toBeGreaterThan(100);
  }
}
