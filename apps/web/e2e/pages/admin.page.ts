/**
 * Page Object: Admin Dashboard (/admin)
 */

import { type Locator, type Page, expect } from "@playwright/test";
import { safeGoto } from "../helpers";

export class AdminPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly creatorsTab: Locator;
  readonly postsTab: Locator;
  readonly creatorCards: Locator;
  readonly approveButtons: Locator;
  readonly featureButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('text=Admin Dashboard').first();
    this.creatorsTab = page.locator('button:has-text("Creators")').first();
    this.postsTab = page.locator('button:has-text("Posts")').first();
    this.creatorCards = page.locator('[class*="card"]');
    this.approveButtons = page.locator('button:has-text("Approve")');
    this.featureButtons = page.locator('button:has-text("Feature")');
  }

  async goto() {
    await safeGoto(this.page, "/admin");
    await this.page.waitForLoadState("networkidle");
  }

  async expectAdminDashboardVisible() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async switchToCreatorsTab() {
    await this.creatorsTab.click();
  }

  async switchToPostsTab() {
    await this.postsTab.click();
  }
}
