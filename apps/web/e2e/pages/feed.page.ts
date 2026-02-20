/**
 * Page Object: Feed page (/feed)
 */

import { type Locator, type Page, expect } from "@playwright/test";
import { safeGoto } from "../helpers";

export class FeedPage {
  readonly page: Page;
  readonly feedCards: Locator;
  readonly lockedOverlays: Locator;
  readonly likeButtons: Locator;
  readonly commentButtons: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.feedCards = page.locator('[class*="card"], [class*="Card"]');
    this.lockedOverlays = page.locator('text=Subscribe to unlock');
    this.likeButtons = page.locator('button:has-text("Like"), button:has-text("Liked")');
    this.commentButtons = page.locator('button:has-text("Comment")');
    this.emptyState = page.locator('text=No posts, text=empty, text=follow');
  }

  async goto() {
    await safeGoto(this.page, "/feed");
    await this.page.waitForLoadState("networkidle");
  }

  async expectFeedLoaded() {
    // Feed page should either show posts or an empty state — not an error
    const body = await this.page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
    expect(body).not.toContain("Application error");
  }

  async expectNoServerErrors() {
    const body = await this.page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  }
}

export class PostCreatePage {
  readonly page: Page;
  readonly captionInput: Locator;
  readonly visibilityPublic: Locator;
  readonly visibilitySubscribers: Locator;
  readonly visibilityPPV: Locator;
  readonly ppvPriceInput: Locator;
  readonly nsfwCheckbox: Locator;
  readonly publishButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.captionInput = page.locator("#caption");
    this.visibilityPublic = page.locator('button:has-text("PUBLIC")').first();
    this.visibilitySubscribers = page.locator('button:has-text("SUBSCRIBERS")').first();
    this.visibilityPPV = page.locator('button:has-text("PPV")').first();
    this.ppvPriceInput = page.locator("#ppv-price");
    this.nsfwCheckbox = page.locator("#nsfw");
    this.publishButton = page.getByRole("button", {
      name: /publish|schedule|creating/i,
    });
    this.cancelButton = page.locator('a[href="/feed"]');
  }

  async goto() {
    await safeGoto(this.page, "/creator/post/new");
    await this.page.waitForLoadState("networkidle");
  }

  async createTextPost(caption: string, visibility: "PUBLIC" | "SUBSCRIBERS" | "PPV" = "PUBLIC", ppvPrice?: number) {
    await this.captionInput.fill(caption);
    if (visibility === "PUBLIC") {
      await this.visibilityPublic.click();
    } else if (visibility === "SUBSCRIBERS") {
      await this.visibilitySubscribers.click();
    } else if (visibility === "PPV") {
      await this.visibilityPPV.click();
      if (ppvPrice) {
        await this.ppvPriceInput.fill(String(ppvPrice));
      }
    }
    await this.publishButton.click();
  }
}
