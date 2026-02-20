/**
 * Page Object: Auth pages (signup, login, verify-email)
 */

import { type Locator, type Page, expect } from "@playwright/test";
import { safeGoto } from "../helpers";

export class SignupPage {
  readonly page: Page;
  readonly displayNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly fanToggle: Locator;
  readonly creatorToggle: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.displayNameInput = page.locator("#displayName");
    this.emailInput = page.locator("#email");
    this.passwordInput = page.locator("#password");
    this.fanToggle = page.locator('[data-testid="signup-type-fan"]');
    this.creatorToggle = page.locator('[data-testid="signup-type-creator"]');
    this.submitButton = page.getByRole("button", {
      name: /create.*account/i,
    });
    this.errorAlert = page.locator('[role="alert"]');
    this.loginLink = page.locator('a[href="/login"]');
  }

  async goto() {
    await safeGoto(this.page, "/signup");
    await this.page.waitForLoadState("networkidle");
  }

  async selectFanType() {
    await this.fanToggle.click();
  }

  async selectCreatorType() {
    await this.creatorToggle.click();
  }

  async fillForm(displayName: string, email: string, password: string) {
    await this.displayNameInput.fill(displayName);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async signupFan(displayName: string, email: string, password: string) {
    await this.goto();
    await this.selectFanType();
    await this.fillForm(displayName, email, password);
    await this.submit();
  }

  async signupCreator(displayName: string, email: string, password: string) {
    await this.goto();
    await this.selectCreatorType();
    await this.fillForm(displayName, email, password);
    await this.submit();
  }
}

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;
  readonly signupLink: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Password");
    this.submitButton = page.getByRole("button", { name: /sign in/i });
    this.errorAlert = page.locator('[role="alert"]');
    this.signupLink = page.locator('a[href="/signup"]');
    this.forgotPasswordLink = page.locator('a[href="/forgot-password"]');
  }

  async goto() {
    await safeGoto(this.page, "/login");
    await this.page.waitForLoadState("networkidle");
  }

  async login(email: string, password: string) {
    await this.goto();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15_000,
    });
  }

  async expectLoginSuccess() {
    expect(this.page.url()).not.toContain("/login");
  }

  async expectLoginError() {
    await expect(this.errorAlert).toBeVisible({ timeout: 5_000 });
  }
}
