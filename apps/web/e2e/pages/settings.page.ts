/**
 * Page Object: Settings pages (/settings/*)
 */

import { type Locator, type Page, expect } from "@playwright/test";
import { safeGoto } from "../helpers";

export class SettingsProfilePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly handleInput: Locator;
  readonly displayNameInput: Locator;
  readonly bioTextarea: Locator;
  readonly phoneInput: Locator;
  readonly countrySelect: Locator;
  readonly discoverableToggle: Locator;
  readonly nsfwToggle: Locator;
  readonly subscriptionPriceInput: Locator;
  readonly saveButton: Locator;
  readonly avatarUpload: Locator;
  readonly bannerUpload: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1, h2").first();
    this.handleInput = page.locator("#handle");
    this.displayNameInput = page.locator("#displayName");
    this.bioTextarea = page.locator("#bio");
    this.phoneInput = page.locator("#phone");
    this.countrySelect = page.locator("#country");
    this.discoverableToggle = page.locator("#discoverable");
    this.nsfwToggle = page.locator("#nsfw");
    this.subscriptionPriceInput = page.locator("#subscriptionPrice");
    this.saveButton = page.getByRole("button", { name: /save|update/i });
    this.avatarUpload = page.locator("input[type='file'][accept*='image']").first();
    this.bannerUpload = page.locator("input[type='file'][accept*='image']").nth(1);
  }

  async goto() {
    await safeGoto(this.page, "/settings/profile");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async expectPageLoaded() {
    const body = await this.page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  }

  async fillProfile(opts: {
    handle?: string;
    displayName?: string;
    bio?: string;
    phone?: string;
  }) {
    if (opts.handle) await this.handleInput.fill(opts.handle);
    if (opts.displayName) await this.displayNameInput.fill(opts.displayName);
    if (opts.bio) await this.bioTextarea.fill(opts.bio);
    if (opts.phone) await this.phoneInput.fill(opts.phone);
  }

  async save() {
    await this.saveButton.click();
  }
}

export class SettingsSecurityPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly currentPasswordInput: Locator;
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly changePasswordButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1, h2").first();
    this.currentPasswordInput = page.locator(
      'input[name="currentPassword"], input[placeholder*="urrent"]',
    ).first();
    this.newPasswordInput = page.locator(
      'input[name="newPassword"], input[placeholder*="ew password"]',
    ).first();
    this.confirmPasswordInput = page.locator(
      'input[name="confirmPassword"], input[placeholder*="onfirm"]',
    ).first();
    this.changePasswordButton = page.getByRole("button", {
      name: /change|update.*password/i,
    });
  }

  async goto() {
    await safeGoto(this.page, "/settings/security");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async expectPageLoaded() {
    const body = await this.page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  }
}
