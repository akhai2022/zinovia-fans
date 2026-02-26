/**
 * Promotional Video Generator — Per-Persona Walkthroughs
 *
 * Generates 4 demo videos (WebM) + key-moment screenshots (PNG) for each persona:
 *   1. Creator Journey: signup → onboarding → post → vault → earnings → AI studio
 *   2. Fan Journey: signup → feed → discover → profile → messages → billing
 *   3. Admin Journey: login → dashboard → creators → transactions → posts
 *   4. Anonymous Visitor: landing → discover → pricing → AI studio → login
 *
 * Usage:
 *   API_BASE_URL=https://api.zinovia.ai \
 *   PLAYWRIGHT_BASE_URL=https://zinovia.ai \
 *   ADMIN_EMAIL=admin@zinovia.ai \
 *   ADMIN_PASSWORD=yourpassword \
 *   npx --package=@playwright/test@1.49.0 playwright test e2e/promo-videos.spec.ts
 *
 * Output: /tmp/zinovia-promo-videos/ (videos + screenshots)
 */

import { test, type BrowserContext, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const WEB_BASE =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.WEB_BASE_URL ??
  "http://localhost:3000";

const API_BASE = process.env.API_BASE_URL ?? "https://api.zinovia.ai";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

const OUTPUT_DIR = "/tmp/zinovia-promo-videos";

// Enable video recording for all tests in this file
test.use({
  video: { mode: "on", size: { width: 1280, height: 720 } },
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 50 },
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Ensure output directory exists. */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/** Take a labeled screenshot. */
async function snap(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${name}.png`),
    fullPage: false,
  });
}

/** Take a full-page screenshot. */
async function snapFull(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${name}.png`),
    fullPage: true,
  });
}

/** Smooth scroll to bottom of page. */
async function smoothScrollDown(page: Page, pixels = 800, duration = 1500) {
  await page.evaluate(
    ([px, ms]) => {
      return new Promise<void>((resolve) => {
        const start = window.scrollY;
        const startTime = performance.now();
        function step(currentTime: number) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / ms, 1);
          const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          window.scrollTo(0, start + px * eased);
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    },
    [pixels, duration] as const,
  );
  await page.waitForTimeout(500);
}

/** Smooth scroll to top. */
async function smoothScrollTop(page: Page) {
  await page.evaluate(() =>
    window.scrollTo({ top: 0, behavior: "smooth" }),
  );
  await page.waitForTimeout(800);
}

/** Type text with visible keystrokes (demo effect). */
async function demoType(page: Page, selector: string, text: string) {
  await page.click(selector);
  await page.type(selector, text, { delay: 60 });
  await page.waitForTimeout(300);
}

/** Pause for the viewer to see the current screen. */
async function pause(page: Page, ms = 2000) {
  await page.waitForTimeout(ms);
}

/** Navigate with a settling pause. */
async function navigateTo(page: Page, path: string, settleMs = 2000) {
  await page.goto(`${WEB_BASE}${path}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(settleMs);
}

/** Login via API and set cookies on the browser context. */
async function loginViaCookies(
  context: BrowserContext,
  page: Page,
  email: string,
  password: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return false;

    const setCookie = res.headers.get("set-cookie") ?? "";
    const cookies = setCookie
      .split(",")
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean);

    const webUrl = new URL(WEB_BASE);
    for (const cookie of cookies) {
      const [nameVal] = [cookie];
      const eqIdx = nameVal.indexOf("=");
      if (eqIdx < 0) continue;
      const name = nameVal.slice(0, eqIdx).trim();
      const value = nameVal.slice(eqIdx + 1).trim();
      await context.addCookies([
        {
          name,
          value,
          domain: webUrl.hostname,
          path: "/",
          httpOnly: name === "access_token",
          secure: webUrl.protocol === "https:",
          sameSite: "Lax",
        },
      ]);
    }
    return true;
  } catch {
    return false;
  }
}

/** Login via API using access_token from response body. */
async function loginWithToken(
  context: BrowserContext,
  page: Page,
  email: string,
  password: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as Record<string, any>;
    const token = data.access_token;
    if (!token) return false;

    await context.addCookies([
      {
        name: "access_token",
        value: token,
        url: WEB_BASE,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
      {
        name: "access_token",
        value: token,
        url: API_BASE,
        httpOnly: true,
        secure: true,
        sameSite: "None" as const,
      },
      {
        name: "csrf_token",
        value: "pw-promo",
        url: WEB_BASE,
        httpOnly: false,
        secure: true,
        sameSite: "Lax",
      },
    ]);

    // Intercept /api/* requests and proxy through Node.js
    await page.route(/\/api\//, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const apiPath = url.pathname.replace(/^\/api/, "");
      const targetUrl = `${API_BASE}${apiPath}${url.search}`;
      try {
        const headers: Record<string, string> = {
          cookie: `access_token=${token}`,
        };
        const reqHeaders = request.headers();
        for (const key of ["content-type", "accept", "x-csrf-token"]) {
          if (reqHeaders[key]) headers[key] = reqHeaders[key];
        }
        const fetchRes = await fetch(targetUrl, {
          method: request.method(),
          headers,
          body: request.method() !== "GET" ? request.postData() ?? undefined : undefined,
        });
        const body = Buffer.from(await fetchRes.arrayBuffer());
        const responseHeaders: Record<string, string> = {};
        fetchRes.headers.forEach((v, k) => {
          if (!["content-encoding", "transfer-encoding", "content-length"].includes(k))
            responseHeaders[k] = v;
        });
        await route.fulfill({ status: fetchRes.status, headers: responseHeaders, body });
      } catch {
        await route.abort("connectionfailed");
      }
    });

    // Pre-navigate to activate cookies
    await page.goto(`${WEB_BASE}/login`, { waitUntil: "commit" });
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

/** Save the video after test completes. */
async function saveVideo(page: Page, testInfo: any, filename: string) {
  const video = page.video();
  if (video) {
    const videoPath = await video.path();
    if (videoPath && fs.existsSync(videoPath)) {
      const dest = path.join(OUTPUT_DIR, filename);
      fs.copyFileSync(videoPath, dest);
      console.log(`Video saved: ${dest}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

test.beforeAll(() => {
  ensureOutputDir();
});

/* ------------------------------------------------------------------ */
/*  Video 1: Creator Journey                                           */
/* ------------------------------------------------------------------ */

test.describe("Promo Videos", () => {
  test("Creator Journey — Signup to AI Studio", async ({ page, context }, testInfo) => {
    test.setTimeout(180_000);

    // --- Step 1: Landing page ---
    await navigateTo(page, "/");
    await smoothScrollDown(page, 400);
    await snap(page, "01_creator_landing");
    await smoothScrollTop(page);
    await pause(page, 1500);

    // --- Step 2: Navigate to signup ---
    const signupLink = page.locator('a[href="/signup"]').first();
    if (await signupLink.isVisible()) {
      await signupLink.click();
      await page.waitForLoadState("networkidle").catch(() => {});
    } else {
      await navigateTo(page, "/signup");
    }
    await pause(page, 1500);

    // Select Creator type
    const creatorToggle = page.locator('[data-testid="signup-type-creator"]');
    if (await creatorToggle.isVisible()) {
      await creatorToggle.click();
      await pause(page, 800);
    }
    await snap(page, "02_creator_signup_type");

    // --- Step 3: Fill form with slow typing ---
    const displayNameInput = page.locator("#displayName");
    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");

    if (await displayNameInput.isVisible()) {
      await demoType(page, "#displayName", "Sarah Creative");
    }
    if (await emailInput.isVisible()) {
      await demoType(page, "#email", "sarah@example.com");
    }
    if (await passwordInput.isVisible()) {
      await demoType(page, "#password", "MySecurePass123!");
    }
    await snap(page, "03_creator_signup_filled");
    await pause(page, 1500);

    // --- Step 4: Don't actually submit — show the filled form then transition ---
    await snap(page, "04_creator_signup_ready");
    await pause(page, 2000);

    // --- Step 5: Login as a real creator (use admin credentials or skip) ---
    const hasAuth = ADMIN_EMAIL && ADMIN_PASSWORD;
    if (hasAuth) {
      const loggedIn = await loginWithToken(context, page, ADMIN_EMAIL, ADMIN_PASSWORD);
      if (!loggedIn) {
        console.warn("Login failed — continuing with unauthenticated pages");
      }
    }

    // --- Step 6: Onboarding page ---
    await navigateTo(page, "/onboarding", 3000);
    await snap(page, "05_creator_onboarding");
    await smoothScrollDown(page, 300);
    await pause(page, 1500);

    // --- Step 7: Create post page ---
    await navigateTo(page, "/creator/post/new", 3000);
    await snap(page, "06_creator_post_new");
    // Demo: type a caption
    const captionInput = page.locator("#caption");
    if (await captionInput.isVisible()) {
      await demoType(page, "#caption", "Just launched my new collection! Check it out 🎨✨");
      await pause(page, 1500);
    }
    await snap(page, "06b_creator_post_caption");

    // --- Step 8: Media vault ---
    await navigateTo(page, "/creator/vault", 3000);
    await snap(page, "07_creator_vault");
    await smoothScrollDown(page, 300);
    await pause(page, 1500);

    // --- Step 9: Earnings dashboard ---
    await navigateTo(page, "/creator/earnings", 3000);
    await snap(page, "08_creator_earnings");
    await smoothScrollDown(page, 400);
    await pause(page, 2000);

    // --- Step 10: Settings ---
    await navigateTo(page, "/settings/profile", 3000);
    await snap(page, "09_creator_settings");
    await smoothScrollDown(page, 300);
    await pause(page, 1500);

    // --- Step 11: AI Studio ---
    await navigateTo(page, "/ai", 3000);
    await snap(page, "10_creator_ai_studio");
    await smoothScrollDown(page, 500);
    await pause(page, 2000);

    // Save video
    await saveVideo(page, testInfo, "creator-journey.webm");
  });

  /* ------------------------------------------------------------------ */
  /*  Video 2: Fan Journey                                               */
  /* ------------------------------------------------------------------ */

  test("Fan Journey — Signup to Messaging", async ({ page, context }, testInfo) => {
    test.setTimeout(120_000);

    // --- Step 1: Landing page ---
    await navigateTo(page, "/");
    await pause(page, 1500);

    // Navigate to signup
    const signupBtn = page.locator('a[href="/signup"]').first();
    if (await signupBtn.isVisible()) {
      await signupBtn.click();
      await page.waitForLoadState("networkidle").catch(() => {});
    } else {
      await navigateTo(page, "/signup");
    }
    await snap(page, "11_fan_signup_page");

    // --- Step 2: Select Fan type and fill form ---
    const fanToggle = page.locator('[data-testid="signup-type-fan"]');
    if (await fanToggle.isVisible()) {
      await fanToggle.click();
      await pause(page, 800);
    }

    const displayNameInput = page.locator("#displayName");
    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");

    if (await displayNameInput.isVisible()) {
      await demoType(page, "#displayName", "Alex Fan");
    }
    if (await emailInput.isVisible()) {
      await demoType(page, "#email", "alex@example.com");
    }
    if (await passwordInput.isVisible()) {
      await demoType(page, "#password", "FanPass12345!");
    }
    await snap(page, "12_fan_signup_filled");
    await pause(page, 2000);

    // --- Step 3: Login with real credentials ---
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      await loginWithToken(context, page, ADMIN_EMAIL, ADMIN_PASSWORD);
    }

    // --- Step 4: Feed ---
    await navigateTo(page, "/feed", 3000);
    await snap(page, "13_fan_feed");
    await smoothScrollDown(page, 500);
    await pause(page, 2000);

    // --- Step 5: Discover creators ---
    await navigateTo(page, "/creators", 3000);
    await snap(page, "14_fan_creators");
    await smoothScrollDown(page, 300);
    await pause(page, 1500);

    // --- Step 6: Click first creator profile ---
    const creatorLink = page.locator('a[href*="/creators/"]').first();
    if (await creatorLink.isVisible()) {
      await creatorLink.click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await pause(page, 2000);
      await snap(page, "15_fan_creator_profile");
      await smoothScrollDown(page, 400);
      await pause(page, 1500);
    }

    // --- Step 7: Messages ---
    await navigateTo(page, "/messages", 3000);
    await snap(page, "16_fan_messages");
    await pause(page, 1500);

    // --- Step 8: Billing / subscriptions ---
    await navigateTo(page, "/billing/manage", 3000);
    await snap(page, "17_fan_billing");
    await pause(page, 1500);

    // --- Step 9: Notifications ---
    await navigateTo(page, "/notifications", 3000);
    await snap(page, "18_fan_notifications");
    await pause(page, 1500);

    // --- Step 10: Settings ---
    await navigateTo(page, "/settings/profile", 3000);
    await snap(page, "19_fan_settings");
    await smoothScrollDown(page, 300);
    await pause(page, 1500);

    await saveVideo(page, testInfo, "fan-journey.webm");
  });

  /* ------------------------------------------------------------------ */
  /*  Video 3: Admin Journey                                             */
  /* ------------------------------------------------------------------ */

  test("Admin Journey — Dashboard Walkthrough", async ({ page, context }, testInfo) => {
    test.setTimeout(120_000);
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set ADMIN_EMAIL and ADMIN_PASSWORD env vars");

    // --- Step 1: Login ---
    const loggedIn = await loginWithToken(context, page, ADMIN_EMAIL, ADMIN_PASSWORD);
    if (!loggedIn) {
      test.skip(true, "Admin login failed");
      return;
    }

    // --- Step 2: Admin dashboard ---
    await page.goto(`${WEB_BASE}/admin`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);
    await snap(page, "20_admin_dashboard");
    await smoothScrollDown(page, 400);
    await pause(page, 2000);

    // --- Step 3: Creators tab (default) ---
    await smoothScrollTop(page);
    await snap(page, "21_admin_creators_tab");
    await smoothScrollDown(page, 600);
    await pause(page, 2000);

    // --- Step 4: Transactions tab ---
    const txBtn = page.getByRole("button", { name: /transactions/i });
    if (await txBtn.isVisible()) {
      await txBtn.click();
      await page.waitForTimeout(2000);
      await snap(page, "22_admin_transactions_tab");
      await smoothScrollDown(page, 400);
      await pause(page, 2000);
    }

    // --- Step 5: Posts tab ---
    await smoothScrollTop(page);
    const postsBtn = page.getByRole("button", { name: /posts/i });
    if (await postsBtn.isVisible()) {
      await postsBtn.click();
      await page.waitForTimeout(2000);
      await snap(page, "23_admin_posts_tab");
      await smoothScrollDown(page, 400);
      await pause(page, 2000);
    }

    // --- Step 6: Users tab (if exists) ---
    const usersBtn = page.getByRole("button", { name: /users/i });
    if (await usersBtn.isVisible()) {
      await usersBtn.click();
      await page.waitForTimeout(2000);
      await snap(page, "23b_admin_users_tab");
      await smoothScrollDown(page, 400);
      await pause(page, 2000);
    }

    // --- Step 7: Emails tab (if exists) ---
    const emailsBtn = page.getByRole("button", { name: /emails/i });
    if (await emailsBtn.isVisible()) {
      await emailsBtn.click();
      await page.waitForTimeout(2000);
      await snap(page, "23c_admin_emails_tab");
      await pause(page, 2000);
    }

    // --- Step 8: Creator earnings (admin has access) ---
    await page.goto(`${WEB_BASE}/creator/earnings`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(3000);
    await snap(page, "24_admin_earnings");
    await smoothScrollDown(page, 400);
    await pause(page, 2000);

    await saveVideo(page, testInfo, "admin-journey.webm");
  });

  /* ------------------------------------------------------------------ */
  /*  Video 4: Anonymous Visitor Journey                                 */
  /* ------------------------------------------------------------------ */

  test("Anonymous Visitor — Landing to Login", async ({ page }, testInfo) => {
    test.setTimeout(120_000);

    // --- Step 1: Landing page with full scroll ---
    await navigateTo(page, "/", 3000);
    await snap(page, "25_anon_landing_top");

    // Smooth scroll through the entire landing page
    await smoothScrollDown(page, 600, 2000);
    await pause(page, 1000);
    await smoothScrollDown(page, 600, 2000);
    await pause(page, 1000);
    await smoothScrollDown(page, 600, 2000);
    await snap(page, "25b_anon_landing_mid");
    await pause(page, 1000);
    await smoothScrollDown(page, 600, 2000);
    await pause(page, 1000);
    await smoothScrollDown(page, 600, 2000);
    await snapFull(page, "25c_anon_landing_full");
    await pause(page, 1500);

    // --- Step 2: Discover creators ---
    await navigateTo(page, "/creators", 3000);
    await snap(page, "26_anon_discover");
    await smoothScrollDown(page, 400);
    await pause(page, 2000);

    // --- Step 3: Pricing ---
    await navigateTo(page, "/pricing", 3000);
    await snap(page, "27_anon_pricing");
    await smoothScrollDown(page, 400);
    await pause(page, 2000);

    // --- Step 4: How it works ---
    await navigateTo(page, "/how-it-works", 3000);
    await snap(page, "28_anon_how_it_works");
    await smoothScrollDown(page, 500);
    await pause(page, 2000);

    // --- Step 5: AI Studio landing ---
    await navigateTo(page, "/ai", 3000);
    await snap(page, "29_anon_ai_studio");
    await smoothScrollDown(page, 500);
    await pause(page, 2000);

    // --- Step 6: Login page ---
    await navigateTo(page, "/login", 2000);
    await snap(page, "30_anon_login");
    await pause(page, 2000);

    // --- Step 7: Signup page ---
    await navigateTo(page, "/signup", 2000);
    await snap(page, "31_anon_signup");
    await pause(page, 2000);

    await saveVideo(page, testInfo, "anonymous-journey.webm");
  });
});
