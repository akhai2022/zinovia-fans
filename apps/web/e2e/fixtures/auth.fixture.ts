/**
 * Playwright fixtures providing pre-authenticated browser contexts.
 *
 * Usage in tests:
 *   import { test } from "../fixtures/auth.fixture";
 *   test("fan can see feed", async ({ fanPage }) => { ... });
 */

import { test as base, type Page, type BrowserContext } from "@playwright/test";
import {
  uniqueEmail,
  signupFan,
  createVerifiedCreator,
  createAdminUser,
  isE2EEnabled,
  API_BASE,
} from "../helpers";

const PASSWORD = "E2eFixture123!";

/** Parse set-cookie-style cookies into Playwright cookie format. */
function parseCookiesForContext(
  cookieString: string,
  baseUrl: string,
): { name: string; value: string; domain: string; path: string }[] {
  const url = new URL(baseUrl);
  return cookieString
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((pair) => {
      const [name, ...rest] = pair.split("=");
      return {
        name: name.trim(),
        value: rest.join("=").trim(),
        domain: url.hostname,
        path: "/",
      };
    });
}

type AuthFixtures = {
  /** Page with a logged-in fan user. */
  fanPage: Page;
  /** Page with a logged-in, verified creator. */
  creatorPage: Page;
  /** Page with a logged-in admin user. */
  adminPage: Page;
  /** Whether E2E bypass endpoints are available. */
  e2eAvailable: boolean;
  /** Credentials for the fan user created by fanPage. */
  fanCredentials: { email: string; password: string; cookies: string };
  /** Credentials for the creator created by creatorPage. */
  creatorCredentials: {
    email: string;
    password: string;
    cookies: string;
    userId: string;
  };
};

export const test = base.extend<AuthFixtures>({
  e2eAvailable: async ({}, use) => {
    const available = await isE2EEnabled();
    await use(available);
  },

  fanCredentials: async ({}, use) => {
    const email = uniqueEmail("fix-fan");
    const { cookies } = await signupFan(email, PASSWORD, "Fixture Fan");
    await use({ email, password: PASSWORD, cookies });
  },

  fanPage: async ({ browser, fanCredentials }, use) => {
    const context = await browser.newContext();
    const apiUrl = new URL(API_BASE);
    const webCookies = parseCookiesForContext(
      fanCredentials.cookies,
      API_BASE,
    );
    // Set cookies for both API and web domains
    await context.addCookies(webCookies);
    // Also set for localhost
    await context.addCookies(
      webCookies.map((c) => ({ ...c, domain: "localhost" })),
    );
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  creatorCredentials: async ({ e2eAvailable }, use) => {
    const email = uniqueEmail("fix-creator");
    if (e2eAvailable) {
      const { cookies, userId } = await createVerifiedCreator(email, PASSWORD);
      await use({ email, password: PASSWORD, cookies, userId });
    } else {
      // Fallback: register without E2E bypass, limited functionality
      const { cookies } = await signupFan(email, PASSWORD, "Creator Fallback");
      await use({ email, password: PASSWORD, cookies, userId: "" });
    }
  },

  creatorPage: async ({ browser, creatorCredentials }, use) => {
    const context = await browser.newContext();
    const webCookies = parseCookiesForContext(
      creatorCredentials.cookies,
      API_BASE,
    );
    await context.addCookies(webCookies);
    await context.addCookies(
      webCookies.map((c) => ({ ...c, domain: "localhost" })),
    );
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  adminPage: async ({ browser, e2eAvailable }, use) => {
    if (!e2eAvailable) {
      // Cannot create admin without E2E bypass; provide empty page
      const context = await browser.newContext();
      const page = await context.newPage();
      await use(page);
      await context.close();
      return;
    }
    const email = uniqueEmail("fix-admin");
    const { cookies } = await createAdminUser(email, PASSWORD);
    const context = await browser.newContext();
    const webCookies = parseCookiesForContext(cookies, API_BASE);
    await context.addCookies(webCookies);
    await context.addCookies(
      webCookies.map((c) => ({ ...c, domain: "localhost" })),
    );
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
