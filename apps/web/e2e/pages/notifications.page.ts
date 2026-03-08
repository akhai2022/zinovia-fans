/**
 * Page Object: Notifications page (/notifications)
 */

import { type Locator, type Page, expect } from "@playwright/test";
import { safeGoto } from "../helpers";

export class NotificationsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly notificationItems: Locator;
  readonly emptyState: Locator;
  readonly markAllReadButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1, h2").first();
    this.notificationItems = page.locator("[class*='notification'], li");
    this.emptyState = page.locator(
      "text=No notifications, text=no new, text=empty",
    ).first();
    this.markAllReadButton = page.getByRole("button", {
      name: /mark.*read/i,
    });
  }

  async goto() {
    await safeGoto(this.page, "/notifications");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async expectPageLoaded() {
    const body = await this.page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  }
}
