/**
 * 51 — Fan Demo Journey (@demo)
 *
 * Produces a clean, stakeholder-ready recording of the full fan experience.
 * Designed for demo video generation — uses stable data, polished happy paths,
 * and milestone screenshots.
 *
 * Run with: npx playwright test 51-demo-fan --project=demo
 *
 * Output: videos + screenshots saved to test-results and demo-artifacts/.
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import {
  safeGoto,
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  isE2EEnabled,
  loginViaUI,
  e2eApi,
  API_BASE,
} from "./helpers";
import { extractCsrf } from "./ai-helpers";

const DEMO_DIR = path.join(__dirname, "..", "demo-artifacts");

test.describe.configure({ mode: "serial" });

test.describe("Fan Demo Journey @demo", () => {
  const fanEmail = uniqueEmail("demo-fan");
  const fanPassword = "DemoFan123!";
  const creatorEmail = uniqueEmail("demo-fan-creator");
  const creatorPassword = "DemoCreator123!";
  let fanCookies: string;
  let creatorCookies: string;
  let creatorUserId: string;
  let e2eAvailable: boolean;
  let postId: string;

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
    if (!fs.existsSync(DEMO_DIR)) {
      fs.mkdirSync(DEMO_DIR, { recursive: true });
    }

    if (e2eAvailable) {
      // Seed a creator with content for the fan to discover
      const creator = await createVerifiedCreator(creatorEmail, creatorPassword);
      creatorCookies = creator.cookies;
      creatorUserId = creator.userId;

      // Create a public post from the creator
      const csrf = extractCsrf(creatorCookies);
      const postRes = await apiFetch("/posts", {
        method: "POST",
        body: {
          type: "TEXT",
          caption: "Welcome to my exclusive content! Subscribe for more premium posts.",
          visibility: "PUBLIC",
          nsfw: false,
          asset_ids: [],
        },
        cookies: creatorCookies,
        headers: { "X-CSRF-Token": csrf },
      });
      if (postRes.ok) postId = postRes.body.id;
    }
  });

  /* ---------------------------------------------------------------- */
  /*  Step 1: Fan lands on homepage                                    */
  /* ---------------------------------------------------------------- */

  test("DEMO-F01: Fan visits the homepage @demo", async ({ page }) => {
    await safeGoto(page, "/");
    await page.waitForLoadState("domcontentloaded");

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: path.join(DEMO_DIR, "fan-01-homepage.png"),
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Step 2: Fan signs up                                             */
  /* ---------------------------------------------------------------- */

  test("DEMO-F02: Fan views signup page @demo", async ({ page }) => {
    // API signup for reliability (may fail in prod without email verification)
    try {
      const fan = await signupFan(fanEmail, fanPassword, "Demo Fan User");
      fanCookies = fan.cookies;
    } catch {
      // Continue without auth
    }

    // Show the signup page for the video
    await safeGoto(page, "/signup");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "fan-02-signup-page.png"),
    });

    // Fill form visually
    const fanToggle = page.locator('[data-testid="signup-type-fan"]');
    if ((await fanToggle.count()) > 0 && (await fanToggle.isVisible())) {
      await fanToggle.click();
    }
    const displayNameInput = page.locator("#displayName");
    if ((await displayNameInput.count()) > 0 && (await displayNameInput.isVisible())) {
      await displayNameInput.fill("Demo Fan User");
    }
    const emailInput = page.locator("#email");
    if ((await emailInput.count()) > 0 && (await emailInput.isVisible())) {
      await emailInput.fill(fanEmail);
    }
    const passwordInput = page.locator("#password");
    if ((await passwordInput.count()) > 0 && (await passwordInput.isVisible())) {
      await passwordInput.fill(fanPassword);
    }
    await page.screenshot({
      path: path.join(DEMO_DIR, "fan-02-signup-filled.png"),
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Step 3: Fan discovers creators                                   */
  /* ---------------------------------------------------------------- */

  test("DEMO-F03: Fan browses creator discovery @demo", async ({ page, context }) => {
    if (fanCookies) {
      const url = new URL(API_BASE);
      const parsed = fanCookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
        const [name, ...rest] = pair.split("=");
        return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
      });
      await context.addCookies(parsed);
      await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));
    }

    await safeGoto(page, "/creators");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "fan-03-discover-creators.png"),
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Step 4: Fan views a creator profile                              */
  /* ---------------------------------------------------------------- */

  test("DEMO-F04: Fan views a creator profile @demo", async ({ page, context }) => {
    if (fanCookies) {
      const url = new URL(API_BASE);
      const parsed = fanCookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
        const [name, ...rest] = pair.split("=");
        return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
      });
      await context.addCookies(parsed);
      await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));
    }

    // Find a creator to view
    const creatorsRes = await apiFetch("/creators");
    let handle = "";
    if (creatorsRes.ok && creatorsRes.body.items?.length > 0) {
      handle = creatorsRes.body.items[0].handle;
    }

    if (handle) {
      await safeGoto(page, `/creators/${handle}`);
    } else {
      await safeGoto(page, "/creators");
    }
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "fan-04-creator-profile.png"),
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Step 5: Fan views the feed                                       */
  /* ---------------------------------------------------------------- */

  test("DEMO-F05: Fan views their feed @demo", async ({ page, context }) => {
    test.skip(!fanCookies, "Fan not logged in");

    const url = new URL(API_BASE);
    const parsed = fanCookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
    });
    await context.addCookies(parsed);
    await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));

    await safeGoto(page, "/feed");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "fan-05-feed.png"),
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Step 6: Fan interacts with content                               */
  /* ---------------------------------------------------------------- */

  test("DEMO-F06: Fan likes a post @demo", async () => {
    test.skip(!fanCookies || !postId, "Setup incomplete");

    const csrf = extractCsrf(fanCookies);
    const res = await apiFetch(`/posts/${postId}/like`, {
      method: "POST",
      cookies: fanCookies,
      headers: { "X-CSRF-Token": csrf },
    });
    // Should succeed or be already liked
    expect(res.status).toBeLessThan(500);
  });

  /* ---------------------------------------------------------------- */
  /*  Step 7: Fan views notifications                                  */
  /* ---------------------------------------------------------------- */

  test("DEMO-F07: Fan checks notifications @demo", async ({ page, context }) => {
    test.skip(!fanCookies, "Fan not logged in");

    const url = new URL(API_BASE);
    const parsed = fanCookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
    });
    await context.addCookies(parsed);
    await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));

    await safeGoto(page, "/notifications");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "fan-07-notifications.png"),
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Step 8: Fan views billing/purchases                              */
  /* ---------------------------------------------------------------- */

  test("DEMO-F08: Fan views billing page @demo", async ({ page, context }) => {
    test.skip(!fanCookies, "Fan not logged in");

    const url = new URL(API_BASE);
    const parsed = fanCookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
    });
    await context.addCookies(parsed);
    await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));

    await safeGoto(page, "/billing/manage");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "fan-08-billing.png"),
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Step 9: Fan uses search                                          */
  /* ---------------------------------------------------------------- */

  test("DEMO-F09: Fan uses search @demo", async ({ page, context }) => {
    test.skip(!fanCookies, "Fan not logged in");

    const url = new URL(API_BASE);
    const parsed = fanCookies.split(";").map((c) => c.trim()).filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name: name.trim(), value: rest.join("=").trim(), domain: url.hostname, path: "/" };
    });
    await context.addCookies(parsed);
    await context.addCookies(parsed.map((c) => ({ ...c, domain: "localhost" })));

    await safeGoto(page, "/search");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      path: path.join(DEMO_DIR, "fan-09-search.png"),
    });
  });
});
