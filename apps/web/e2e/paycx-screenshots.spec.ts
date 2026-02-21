/**
 * Paycx Merchant Application — Screenshot Capture
 *
 * Usage:
 *   PLAYWRIGHT_BASE_URL=https://zinovia.ai \
 *   API_BASE_URL=https://api.zinovia.ai \
 *   ADMIN_EMAIL=admin@zinovia.ai \
 *   ADMIN_PASSWORD=yourpassword \
 *   npx --package=@playwright/test@1.49.0 playwright test e2e/paycx-screenshots.spec.ts
 *
 * Screenshots saved to: /tmp/paycx-screenshots/
 */

import { test, type BrowserContext, type Page } from "@playwright/test";

const WEB_BASE =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.WEB_BASE_URL ??
  "http://localhost:3000";

const API_BASE = process.env.API_BASE_URL ?? "https://api.zinovia.ai";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const OUTPUT_DIR = "/tmp/paycx-screenshots";

let cachedToken: string | null = null;

async function getAuthToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok)
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  cachedToken = data.access_token;
  return cachedToken;
}

/**
 * Set up authenticated browser context:
 * 1. Set cookies using URL-based approach (most reliable for Playwright)
 * 2. Pre-navigate to activate cookies in the browser cookie jar
 * 3. Set up route interception to proxy /api/* through Node.js
 */
async function setupAuthenticatedPage(
  context: BrowserContext,
  page: Page
): Promise<void> {
  const token = await getAuthToken();

  // Use URL-based cookie setting (most reliable for Playwright)
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
      sameSite: "None",
    },
    {
      name: "csrf_token",
      value: "pw-csrf",
      url: WEB_BASE,
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    },
  ]);

  // Intercept ALL /api/* requests and proxy through Node.js
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
      for (const key of [
        "content-type",
        "accept",
        "x-csrf-token",
        "x-request-id",
      ]) {
        if (reqHeaders[key]) headers[key] = reqHeaders[key];
      }

      const res = await fetch(targetUrl, {
        method: request.method(),
        headers,
        body:
          request.method() !== "GET"
            ? request.postData() ?? undefined
            : undefined,
      });

      const body = Buffer.from(await res.arrayBuffer());
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        if (
          !["content-encoding", "transfer-encoding", "content-length"].includes(
            key
          )
        )
          responseHeaders[key] = value;
      });

      await route.fulfill({ status: res.status, headers: responseHeaders, body });
    } catch {
      await route.abort("connectionfailed");
    }
  });

  // Pre-navigate to activate cookies before going to protected pages
  await page.goto(`${WEB_BASE}/login`, { waitUntil: "commit" });
  await page.waitForTimeout(500);
}

test.describe("Paycx Merchant Application Screenshots", () => {
  test.beforeAll(async () => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.warn(
        "Set ADMIN_EMAIL and ADMIN_PASSWORD env vars for authenticated screenshots"
      );
    }
    const fs = await import("fs");
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  });

  test("1 — Homepage / Landing Page", async ({ page }) => {
    await page.goto(WEB_BASE);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `${OUTPUT_DIR}/01_homepage.png`,
      fullPage: true,
    });
  });

  test("2 — Creator Profile with PPV Price", async ({ page }) => {
    await page.goto(`${WEB_BASE}/creators`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `${OUTPUT_DIR}/02_creators_browse.png`,
      fullPage: true,
    });
  });

  test("3 — Login Page", async ({ page }) => {
    await page.goto(`${WEB_BASE}/login`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `${OUTPUT_DIR}/03_login_page.png`,
      fullPage: true,
    });
  });

  test("4 — Signup Page", async ({ page }) => {
    await page.goto(`${WEB_BASE}/signup`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `${OUTPUT_DIR}/04_signup_page.png`,
      fullPage: true,
    });
  });

  test("5 — Authenticated: Purchase History", async ({ page, context }) => {
    test.skip(!ADMIN_EMAIL, "No credentials provided");
    await setupAuthenticatedPage(context, page);

    await page.goto(`${WEB_BASE}/billing/purchases`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: `${OUTPUT_DIR}/05_purchase_history.png`,
      fullPage: true,
    });
  });

  test("6 — Authenticated: Subscription Management", async ({
    page,
    context,
  }) => {
    test.skip(!ADMIN_EMAIL, "No credentials provided");
    await setupAuthenticatedPage(context, page);

    await page.goto(`${WEB_BASE}/billing/manage`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: `${OUTPUT_DIR}/06_subscription_management.png`,
      fullPage: true,
    });
  });

  test("7 — Authenticated: Checkout Success Page", async ({
    page,
    context,
  }) => {
    test.skip(!ADMIN_EMAIL, "No credentials provided");
    await setupAuthenticatedPage(context, page);

    await page.goto(`${WEB_BASE}/billing/success?creator_handle=demo`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: `${OUTPUT_DIR}/07_checkout_success.png`,
      fullPage: true,
    });
  });

  test("8 — Admin: Dashboard — Creators Tab", async ({ page, context }) => {
    test.skip(!ADMIN_EMAIL, "No credentials provided");
    test.setTimeout(60_000);
    await setupAuthenticatedPage(context, page);

    await page.goto(`${WEB_BASE}/admin`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);
    await page.screenshot({
      path: `${OUTPUT_DIR}/08_admin_creators.png`,
      fullPage: true,
    });
  });

  test("9 — Admin: Dashboard — Transactions Tab", async ({
    page,
    context,
  }) => {
    test.skip(!ADMIN_EMAIL, "No credentials provided");
    test.setTimeout(60_000);
    await setupAuthenticatedPage(context, page);

    await page.goto(`${WEB_BASE}/admin`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);

    const txBtn = page.getByRole("button", { name: /transactions/i });
    if (await txBtn.isVisible()) {
      await txBtn.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({
      path: `${OUTPUT_DIR}/09_admin_transactions.png`,
      fullPage: true,
    });
  });

  test("10 — Admin: Dashboard — Posts Tab", async ({ page, context }) => {
    test.skip(!ADMIN_EMAIL, "No credentials provided");
    test.setTimeout(60_000);
    await setupAuthenticatedPage(context, page);

    await page.goto(`${WEB_BASE}/admin`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);

    const postsBtn = page.getByRole("button", { name: /posts/i });
    if (await postsBtn.isVisible()) {
      await postsBtn.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({
      path: `${OUTPUT_DIR}/10_admin_posts.png`,
      fullPage: true,
    });
  });

  test("11 — Creator: Earnings Dashboard", async ({ page, context }) => {
    test.skip(!ADMIN_EMAIL, "No credentials provided");
    await setupAuthenticatedPage(context, page);

    await page.goto(`${WEB_BASE}/creator/earnings`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: `${OUTPUT_DIR}/11_creator_earnings.png`,
      fullPage: true,
    });
  });

  test("12 — Privacy Policy", async ({ page }) => {
    await page.goto(`${WEB_BASE}/privacy`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `${OUTPUT_DIR}/12_privacy_policy.png`,
      fullPage: true,
    });
  });

  test("13 — Terms of Service", async ({ page }) => {
    await page.goto(`${WEB_BASE}/terms`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `${OUTPUT_DIR}/13_terms_of_service.png`,
      fullPage: true,
    });
  });

  test("14 — Contact / Support", async ({ page }) => {
    await page.goto(`${WEB_BASE}/contact`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `${OUTPUT_DIR}/14_contact_support.png`,
      fullPage: true,
    });
  });

  test("15 — Help Center", async ({ page }) => {
    await page.goto(`${WEB_BASE}/help`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `${OUTPUT_DIR}/15_help_center.png`,
      fullPage: true,
    });
  });
});
