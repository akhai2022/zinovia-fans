/**
 * Page Object Models for AI Tools pages.
 */

import { type Page, type Locator } from "@playwright/test";

export class AiToolsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly uploadArea: Locator;
  readonly processButton: Locator;
  readonly downloadButton: Locator;
  readonly resultImage: Locator;
  readonly processingIndicator: Locator;
  readonly errorMessage: Locator;
  readonly backLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1, h2").first();
    this.uploadArea = page.locator("[data-testid='upload-area'], input[type='file']").first();
    this.processButton = page.getByRole("button", { name: /remove|process|start/i });
    this.downloadButton = page.getByRole("button", { name: /download/i });
    this.resultImage = page.locator("img[alt*='result'], img[alt*='processed']").first();
    this.processingIndicator = page.locator("[data-testid='processing'], [role='progressbar']").first();
    this.errorMessage = page.locator("[role='alert'], [data-testid='error']").first();
    this.backLink = page.getByRole("link", { name: /back|studio/i });
  }

  async goto(tool: "remove-bg" | "cartoon-avatar"): Promise<void> {
    await this.page.goto(`/ai/tools/${tool}`);
    await this.page.waitForLoadState("networkidle");
  }

  async expectPageLoaded(): Promise<void> {
    await this.heading.waitFor({ state: "visible", timeout: 10000 });
  }
}

export class AiStudioLandingPage {
  readonly page: Page;
  readonly heroHeading: Locator;
  readonly featureCards: Locator;
  readonly ctaButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroHeading = page.locator("h1").first();
    this.featureCards = page.locator("[data-testid='feature-card'], .feature-card, section article, section .card");
    this.ctaButtons = page.getByRole("link", { name: /get started|sign up|create/i });
  }

  async goto(): Promise<void> {
    await this.page.goto("/ai");
    await this.page.waitForLoadState("networkidle");
  }

  async expectHeroVisible(): Promise<void> {
    await this.heroHeading.waitFor({ state: "visible", timeout: 10000 });
  }
}
