/**
 * Page Object: Billing pages (/billing/*)
 */

import { type Locator, type Page, expect } from "@playwright/test";
import { safeGoto } from "../helpers";

export class BillingManagePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly subscriptionItems: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1, h2").first();
    this.subscriptionItems = page.locator('[class*="subscription"], [class*="Subscription"]');
    this.cancelButton = page.locator('button:has-text("Cancel")').first();
  }

  async goto() {
    await safeGoto(this.page, "/billing/manage");
    await this.page.waitForLoadState("networkidle");
  }

  async expectPageLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }
}

export class BillingSuccessPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await safeGoto(this.page, "/billing/success");
    await this.page.waitForLoadState("networkidle");
  }

  async expectPageLoaded() {
    const body = await this.page.textContent("body");
    expect(body?.length).toBeGreaterThan(0);
  }
}
