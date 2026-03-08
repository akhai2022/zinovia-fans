/**
 * 50 — Creator Demo Journey (@demo)
 *
 * Produces a clean, stakeholder-ready recording of the full creator experience.
 * Designed for demo video generation — uses stable data, polished happy paths,
 * and milestone screenshots.
 *
 * Run with: npx playwright test 50-demo-creator --project=demo
 *
 * Output: videos + screenshots saved to test-results and demo-artifacts/.
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import {
  safeGoto,
  uniqueEmail,
  uniqueHandle,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  isE2EEnabled,
  loginViaUI,
  API_BASE,
} from "./helpers";
import { extractCsrf } from "./ai-helpers";

const DEMO_DIR = path.join(__dirname, "..", "demo-artifacts");

test.describe.configure({ mode: "serial" });

test.describe("Creator Demo Journey @demo", () => {
  const email = uniqueEmail("demo-creator");
  const password = "DemoCreator123!";
  const displayName = "Demo Creator";
  let cookies: string;
  let userId: string;
  let e2eAvailable: boolean;
  let postId: string;

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
    // Ensure demo-artifacts dir exists
    if (!fs.existsSync(DEMO_DIR)) {
      fs.mkdirSync(DEMO_DIR, { recursive: true });
    }
  });

  /* ---------------------------------------------------------------- */
  /*  Step 1: Creator signup or login                                  */
  /* ---------------------------------------------------------------- */

  test("DEMO-C01: Creator signs up or logs in @demo", async ({ page }) => {
    if (e2eAvailable) {
      // Use API bypass for clean setup
      const creator = await createVerifiedCreator(email, password);
      cookies = creator.cookies;
      userId = creator.userId;

      // Now login via UI for the video recording
      await loginViaUI(page, email, password);
      await page.screenshot({
        path: path.join(DEMO_DIR, "creator-01-logged-in.png"),
      });
    } else {
      // Try UI signup
      await safeGoto(page, "/signup");
      await page.screenshot({
        path: path.join(DEMO_DIR, "creator-01-signup-page.png"),
      });
      await page.locator('[data-testid="signup-type-creator"]').click();
      await page.locator("#displayName").fill(displayName);
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await page.getByRole("button", { name: /create.*account/i }).click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(DEMO_DIR, "creator-01-after-signup.png"),
      });
    }
  });

  /* ---------------------------------------------------------------- */
  /*  Step 2: View onboarding / dashboard                              */
  /* ---------------------------------------------------------------- */

  test("DEMO-C02: Creator views onboarding or dashboard @demo", async ({ page, context }) => {
    test.skip(!cookies && !e2eAvailable, "Creator setup failed");

    if (cookies) {
      const url = new URL(API_BASE);
      const parsed = cookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
        const [name, ...rest] = pair.split("=");
        return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
      });
      await context.addCookies(parsed);
      await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));
    }

    // Check if onboarding page exists
    await safeGoto(page, "/onboarding");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "creator-02-onboarding.png"),
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Step 3: Edit creator profile                                     */
  /* ---------------------------------------------------------------- */

  test("DEMO-C03: Creator edits profile settings @demo", async ({ page, context }) => {
    test.skip(!cookies, "Creator not logged in");

    const url = new URL(API_BASE);
    const parsed = cookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
    });
    await context.addCookies(parsed);
    await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));

    await safeGoto(page, "/settings/profile");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "creator-03-settings-profile.png"),
    });

    // Try to fill in profile details
    const bioField = page.locator("#bio");
    if ((await bioField.count()) > 0 && (await bioField.isVisible())) {
      await bioField.fill("Welcome to my page! Premium content coming soon.");
    }

    const displayNameField = page.locator("#displayName");
    if ((await displayNameField.count()) > 0 && (await displayNameField.isVisible())) {
      await displayNameField.fill(displayName);
    }

    await page.screenshot({
      path: path.join(DEMO_DIR, "creator-03-profile-filled.png"),
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Step 4: Create a post                                            */
  /* ---------------------------------------------------------------- */

  test("DEMO-C04: Creator creates a text post @demo", async ({ page, context }) => {
    test.skip(!cookies, "Creator not logged in");

    const url = new URL(API_BASE);
    const parsed = cookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
    });
    await context.addCookies(parsed);
    await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));

    // Navigate to post creation
    await safeGoto(page, "/creator/post/new");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "creator-04-new-post-page.png"),
    });

    // Fill in caption
    const caption = page.locator("#caption");
    if ((await caption.count()) > 0) {
      await caption.fill("Excited to share my first post! 🎉 Stay tuned for more.");
      await page.screenshot({
        path: path.join(DEMO_DIR, "creator-04-post-filled.png"),
      });

      // Select PUBLIC visibility
      const publicBtn = page.locator('button:has-text("PUBLIC")').first();
      if ((await publicBtn.count()) > 0) {
        await publicBtn.click();
      }

      // Also create via API for reliability
      const csrf = extractCsrf(cookies);
      const res = await apiFetch("/posts", {
        method: "POST",
        body: {
          type: "TEXT",
          caption: "Excited to share my first post! Stay tuned for more.",
          visibility: "PUBLIC",
          nsfw: false,
          asset_ids: [],
        },
        cookies,
        headers: { "X-CSRF-Token": csrf },
      });
      if (res.ok) {
        postId = res.body.id;
      }
    }
  });

  /* ---------------------------------------------------------------- */
  /*  Step 5: View vault                                               */
  /* ---------------------------------------------------------------- */

  test("DEMO-C05: Creator views vault @demo", async ({ page, context }) => {
    test.skip(!cookies, "Creator not logged in");

    const url = new URL(API_BASE);
    const parsed = cookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
    });
    await context.addCookies(parsed);
    await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));

    await safeGoto(page, "/creator/vault");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "creator-05-vault.png"),
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Step 6: View earnings                                            */
  /* ---------------------------------------------------------------- */

  test("DEMO-C06: Creator views earnings page @demo", async ({ page, context }) => {
    test.skip(!cookies, "Creator not logged in");

    const url = new URL(API_BASE);
    const parsed = cookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
    });
    await context.addCookies(parsed);
    await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));

    await safeGoto(page, "/creator/earnings");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "creator-06-earnings.png"),
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Step 7: View AI Studio                                           */
  /* ---------------------------------------------------------------- */

  test("DEMO-C07: Creator explores AI Studio @demo", async ({ page, context }) => {
    test.skip(!cookies, "Creator not logged in");

    const url = new URL(API_BASE);
    const parsed = cookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
    });
    await context.addCookies(parsed);
    await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));

    await safeGoto(page, "/ai");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "creator-07-ai-studio.png"),
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Step 8: View public creator page                                 */
  /* ---------------------------------------------------------------- */

  test("DEMO-C08: View public creator page @demo", async ({ page }) => {
    // Browse the creators discovery page as anonymous
    await safeGoto(page, "/creators");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "creator-08-discovery.png"),
    });
  });
});
