/**
 * Page Object: Onboarding page (/onboarding)
 */

import { type Locator, type Page, expect } from "@playwright/test";
import { safeGoto } from "../helpers";

export class OnboardingPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emailVerificationStep: Locator;
  readonly kycStep: Locator;
  readonly profileStep: Locator;
  readonly firstPostStep: Locator;
  readonly startVerificationButton: Locator;
  readonly kycStatusBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1, h2").first();
    this.emailVerificationStep = page.locator("text=Email").first();
    this.kycStep = page.locator("text=KYC, text=Identity, text=Verification").first();
    this.profileStep = page.locator("text=Profile").first();
    this.firstPostStep = page.locator("text=Post, text=Content").first();
    this.startVerificationButton = page.getByRole("button", {
      name: /start|verify|begin/i,
    });
    this.kycStatusBadge = page.locator(
      'text=pending, text=approved, text=rejected',
    ).first();
  }

  async goto() {
    await safeGoto(this.page, "/onboarding");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async expectPageLoaded() {
    const body = await this.page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
    expect(body).not.toContain("Application error");
  }
}
