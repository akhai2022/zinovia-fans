/**
 * Page Object: Messaging / DM pages (/messages/*)
 */

import { type Locator, type Page, expect } from "@playwright/test";
import { safeGoto } from "../helpers";

export class MessagesListPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly conversationItems: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1, h2").first();
    this.conversationItems = page.locator("a[href*='/messages/']");
  }

  async goto() {
    await safeGoto(this.page, "/messages");
    await this.page.waitForLoadState("networkidle");
  }

  async expectPageLoaded() {
    const body = await this.page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  }
}

export class ConversationPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly messageList: Locator;
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly backLink: Locator;
  readonly ppvLockCheckbox: Locator;
  readonly ppvPriceInput: Locator;
  readonly vaultButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1, h2").first();
    this.messageList = page.locator("ul");
    this.messageInput = page.locator('input[placeholder*="Type a message"]');
    this.sendButton = page.locator('button:has-text("Send text")');
    this.backLink = page.locator('a:has-text("Back")');
    this.ppvLockCheckbox = page.locator('text=Lock media');
    this.ppvPriceInput = page.locator('input[placeholder*="Price"]');
    this.vaultButton = page.locator('button:has-text("Choose from Vault")');
  }

  async goto(conversationId: string) {
    await safeGoto(this.page, `/messages/${conversationId}`);
    await this.page.waitForLoadState("networkidle");
  }

  async sendMessage(text: string) {
    await this.messageInput.fill(text);
    await this.sendButton.click();
  }

  async expectMessageVisible(textFragment: string) {
    const msg = this.page.locator(`text=${textFragment}`);
    await expect(msg).toBeVisible({ timeout: 10_000 });
  }
}
