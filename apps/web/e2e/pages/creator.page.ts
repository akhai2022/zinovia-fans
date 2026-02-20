/**
 * Page Object: Creator Profile (/creators/[handle])
 */

import { type Locator, type Page, expect } from "@playwright/test";
import { safeGoto } from "../helpers";

export class CreatorProfilePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly handle: Locator;
  readonly subscribeButton: Locator;
  readonly followButton: Locator;
  readonly messageButton: Locator;
  readonly postsSection: Locator;
  readonly verifiedBadge: Locator;
  readonly subscriberBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1").first();
    this.handle = page.locator("text=@").first();
    this.subscribeButton = page.locator(
      'button:has-text("Subscribe"), a:has-text("Subscribe")',
    ).first();
    this.followButton = page.locator(
      'button:has-text("Follow"), button:has-text("Unfollow")',
    ).first();
    this.messageButton = page.locator(
      'button:has-text("Message"), a:has-text("Message")',
    ).first();
    this.postsSection = page.locator('text=Posts').first();
    this.verifiedBadge = page.locator('text=Verified').first();
    this.subscriberBadge = page.locator('text=Subscribed').first();
  }

  async goto(handle: string) {
    await safeGoto(this.page, `/creators/${handle}`);
    await this.page.waitForLoadState("networkidle");
  }

  async expectProfileLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
    const text = await this.heading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  }

  async expectNoError() {
    const errorText = this.page.locator("text=Something went wrong");
    expect(await errorText.count()).toBe(0);
  }

  async expectPostsSectionVisible() {
    await expect(this.postsSection).toBeVisible({ timeout: 10_000 });
  }

  async expectSubscribeButtonVisible() {
    await expect(this.subscribeButton).toBeVisible({ timeout: 10_000 });
  }

  async clickSubscribe() {
    await this.subscribeButton.click();
  }
}

export class CreatorDiscoveryPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly creatorCards: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1, h2").first();
    this.creatorCards = page.locator('[class*="card"], [class*="Card"]');
    this.searchInput = page.locator(
      'input[type="search"], input[placeholder*="earch"]',
    ).first();
  }

  async goto() {
    await safeGoto(this.page, "/creators");
    await this.page.waitForLoadState("networkidle");
  }

  async expectPageLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }
}
