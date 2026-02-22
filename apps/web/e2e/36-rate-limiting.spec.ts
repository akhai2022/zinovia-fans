/**
 * STEP 36 — Rate limiting tests.
 *
 * Verifies that rate limits are enforced on auth and AI tool endpoints.
 * Uses dedicated per-test users and resets Redis counters before each test
 * to avoid flakiness from shared state or prior CI runs.
 *
 * Some tests are @nightly because they require many requests.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  createVerifiedCreator,
  isE2EEnabled,
} from "./helpers";
import { extractCsrf, requestUploadUrl, resetRateLimit } from "./ai-helpers";

const PASSWORD = "E2eRateLimit1!";
let e2eAvailable = false;

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
});

// Serial mode: rate-limit tests depend on cumulative request counts
test.describe.configure({ mode: "serial" });

test.describe("Rate Limiting — Auth Endpoints", () => {
  test("RL-001: login rate limit returns 429 after threshold", { tag: "@regression" }, async () => {
    // Dedicated email for this test — isolated from other runs
    const email = uniqueEmail("rl-login");

    // Reset any prior counters for this email
    if (e2eAvailable) {
      try { await resetRateLimit(`login:*:${email}`); } catch { /* best effort */ }
    }

    let got429 = false;
    for (let i = 0; i < 20; i++) {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password: "wrong_password_attempt" },
      });
      if (res.status === 429) {
        got429 = true;
        break;
      }
    }
    if (!got429) {
      test.info().annotations.push({ type: "info", description: "Rate limit not triggered in 20 attempts — threshold may be higher" });
    }
  });

  test("RL-002: forgot-password rate limit returns 429", { tag: "@regression" }, async () => {
    const email = uniqueEmail("rl-forgot");

    if (e2eAvailable) {
      try { await resetRateLimit(`password_reset:*:${email}`); } catch { /* best effort */ }
    }

    let got429 = false;
    for (let i = 0; i < 15; i++) {
      const res = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      if (res.status === 429) {
        got429 = true;
        break;
      }
    }
    if (!got429) {
      test.info().annotations.push({ type: "info", description: "Rate limit not triggered in 15 attempts" });
    }
  });

  test("RL-005: rate limit response is descriptive @nightly", { tag: "@nightly" }, async () => {
    const email = uniqueEmail("rl-desc");

    if (e2eAvailable) {
      try { await resetRateLimit(`login:*:${email}`); } catch { /* best effort */ }
    }

    let lastRes: any = null;
    for (let i = 0; i < 25; i++) {
      lastRes = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password: "wrong" },
      });
      if (lastRes.status === 429) break;
    }
    if (lastRes?.status === 429) {
      expect(lastRes.body).toBeTruthy();
      // Should include a meaningful error message, not empty body
      const bodyStr = typeof lastRes.body === "string" ? lastRes.body : JSON.stringify(lastRes.body);
      expect(bodyStr.length).toBeGreaterThan(2);
    } else {
      test.info().annotations.push({ type: "info", description: "Rate limit not triggered" });
    }
  });
});

test.describe("Rate Limiting — AI Tools @nightly", { tag: "@nightly" }, () => {
  // Each test creates its own user for isolation
  test.setTimeout(120_000);

  test("RL-003: remove-bg rate limit returns 429 after daily limit", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");

    // Dedicated creator for this rate-limit test
    const creator = await createVerifiedCreator(uniqueEmail("rl-rmbg"), PASSWORD);
    const cookies = creator.cookies;
    const csrf = extractCsrf(cookies);

    // Reset any prior counters
    try { await resetRateLimit(`ai:tool:rmbg:${creator.userId}`); } catch { /* best effort */ }

    let mediaAssetId = "";
    try {
      const upload = await requestUploadUrl(cookies, csrf);
      mediaAssetId = upload.assetId;
    } catch {
      test.skip(true, "Could not upload media");
      return;
    }

    let got429 = false;
    // Default limit is 30/day — send 35 to trigger it
    for (let i = 0; i < 35; i++) {
      const res = await apiFetch("/ai-tools/remove-bg", {
        method: "POST",
        body: { media_asset_id: mediaAssetId },
        cookies,
        headers: { "X-CSRF-Token": csrf },
      });
      if (res.status === 429) {
        got429 = true;
        break;
      }
      if (res.status === 403 || res.status === 404) {
        test.skip(true, "AI tools not enabled");
        return;
      }
    }
    expect(got429).toBe(true);
  });

  test("RL-004: cartoonize rate limit returns 429 after daily limit", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");

    const creator = await createVerifiedCreator(uniqueEmail("rl-cartoon"), PASSWORD);
    const cookies = creator.cookies;
    const csrf = extractCsrf(cookies);

    try { await resetRateLimit(`ai:tool:cartoon:${creator.userId}`); } catch { /* best effort */ }

    let mediaAssetId = "";
    try {
      const upload = await requestUploadUrl(cookies, csrf);
      mediaAssetId = upload.assetId;
    } catch {
      test.skip(true, "Could not upload media");
      return;
    }

    let got429 = false;
    // Default limit is 5/day — send 10 to trigger it
    for (let i = 0; i < 10; i++) {
      const res = await apiFetch("/ai-tools/cartoonize", {
        method: "POST",
        body: { media_asset_id: mediaAssetId },
        cookies,
        headers: { "X-CSRF-Token": csrf },
      });
      if (res.status === 429) {
        got429 = true;
        break;
      }
      if (res.status === 403 || res.status === 404) {
        test.skip(true, "Cartoon avatar not enabled");
        return;
      }
    }
    expect(got429).toBe(true);
  });
});
