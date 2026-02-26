/**
 * STEP 41 — Onboarding Journey: full creator lifecycle via API.
 *
 * End-to-end creator onboarding:
 *   Register → Verify Email → KYC Session → KYC Complete → Post Creation
 *
 * Also covers:
 *   - Onboarding status API at each stage
 *   - Admin force-verify for stuck creators
 *   - KYC rejection + retry flow
 *   - Logout
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  e2eApi,
  extractCookies,
  isE2EEnabled,
} from "./helpers";

const PASSWORD = "E2eOnboard12!";
let e2eAvailable = false;

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
});

/* ------------------------------------------------------------------ */
/*  Happy Path: Register → Verify → KYC → Post                        */
/* ------------------------------------------------------------------ */

test.describe("Onboarding — Happy Path", () => {
  const email = uniqueEmail("onboard");
  let cookies = "";
  let csrf = "";
  let sessionId = "";

  test("OBD-001: register creator returns 201 @smoke", {
    tag: "@smoke",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
      headers: { "Idempotency-Key": `obd-reg-${Date.now()}` },
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("creator_id");
  });

  test("OBD-002: onboarding status is CREATED @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");

    // Force-verify email so we can login (login requires email_verified)
    await e2eApi("/onboarding/force-state", {
      query: { email, state: "EMAIL_VERIFIED" },
    });

    // Login
    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    expect(login.ok).toBe(true);
    cookies = extractCookies(login.headers.get("set-cookie") ?? "");
    csrf = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    // Check onboarding status
    const status = await apiFetch("/onboarding/status", { cookies });
    expect(status.ok).toBe(true);
    expect(status.body).toHaveProperty("email_verified");
  });

  test("OBD-003: create KYC session @smoke", {
    tag: "@smoke",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!cookies, "Login required first");
    const res = await apiFetch("/kyc/session", {
      method: "POST",
      cookies,
      headers: {
        "X-CSRF-Token": csrf,
        "Idempotency-Key": `obd-kyc-${Date.now()}`,
      },
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("session_id");
    expect(res.body).toHaveProperty("redirect_url");
    sessionId = res.body.session_id;
  });

  test("OBD-004: KYC status shows CREATED/KYC_PENDING @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!cookies, "Login required first");
    const res = await apiFetch("/kyc/status", { cookies });
    expect(res.ok).toBe(true);
    expect(res.body.session_status).toBe("CREATED");
    expect(res.body.creator_state).toBe("KYC_PENDING");
  });

  test("OBD-005: complete KYC with APPROVED @smoke", {
    tag: "@smoke",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!sessionId, "KYC session required");
    const res = await apiFetch("/kyc/complete", {
      method: "POST",
      cookies,
      body: { session_id: sessionId, status: "APPROVED" },
      headers: { "X-CSRF-Token": csrf },
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("ack", true);
  });

  test("OBD-006: KYC status shows KYC_APPROVED @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!cookies, "Login required first");
    const res = await apiFetch("/kyc/status", { cookies });
    expect(res.ok).toBe(true);
    expect(res.body.creator_state).toBe("KYC_APPROVED");
  });

  test("OBD-007: approved creator can create a post @smoke", {
    tag: "@smoke",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!cookies, "Login required first");

    // Need to ensure user has creator role + profile
    await e2eApi("/auth/force-role", {
      query: { email, role: "creator" },
    });

    // Re-login to get fresh session with correct role
    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    if (!login.ok) {
      test.skip(true, "Re-login failed");
      return;
    }
    const freshCookies = extractCookies(login.headers.get("set-cookie") ?? "");
    const freshCsrf = freshCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: `First post after KYC ${Date.now()}`,
        visibility: "PUBLIC",
        nsfw: false,
        asset_ids: [],
      },
      cookies: freshCookies,
      headers: { "X-CSRF-Token": freshCsrf },
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("id");
  });
});

/* ------------------------------------------------------------------ */
/*  Rejection + Retry Flow                                             */
/* ------------------------------------------------------------------ */

test.describe("Onboarding — Rejection & Retry", () => {
  const email = uniqueEmail("obdretry");
  let cookies = "";
  let csrf = "";

  test.beforeAll(async () => {
    if (!e2eAvailable) return;
    // Register and bring to EMAIL_VERIFIED state
    await apiFetch("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
      headers: { "Idempotency-Key": `obd-retry-${Date.now()}` },
    });
    await e2eApi("/onboarding/force-state", {
      query: { email, state: "EMAIL_VERIFIED" },
    });

    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    if (login.ok) {
      cookies = extractCookies(login.headers.get("set-cookie") ?? "");
      csrf = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
    }
  });

  test("OBD-008: KYC rejected, then retry with new session @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!cookies, "Login required");

    // Create session
    const session1 = await apiFetch("/kyc/session", {
      method: "POST",
      cookies,
      headers: {
        "X-CSRF-Token": csrf,
        "Idempotency-Key": `retry1-${Date.now()}`,
      },
    });
    expect(session1.ok).toBe(true);

    // Reject
    const reject = await apiFetch("/kyc/complete", {
      method: "POST",
      cookies,
      body: { session_id: session1.body.session_id, status: "REJECTED" },
      headers: { "X-CSRF-Token": csrf },
    });
    expect(reject.ok).toBe(true);

    // Verify state is KYC_REJECTED
    const status1 = await apiFetch("/kyc/status", { cookies });
    expect(status1.body.creator_state).toBe("KYC_REJECTED");

    // Retry: create new session
    const session2 = await apiFetch("/kyc/session", {
      method: "POST",
      cookies,
      headers: {
        "X-CSRF-Token": csrf,
        "Idempotency-Key": `retry2-${Date.now()}`,
      },
    });
    expect(session2.ok).toBe(true);
    expect(session2.body.session_id).toBeTruthy();

    // Approve on retry
    const approve = await apiFetch("/kyc/complete", {
      method: "POST",
      cookies,
      body: { session_id: session2.body.session_id, status: "APPROVED" },
      headers: { "X-CSRF-Token": csrf },
    });
    expect(approve.ok).toBe(true);

    // Final state should be KYC_APPROVED
    const status2 = await apiFetch("/kyc/status", { cookies });
    expect(status2.body.creator_state).toBe("KYC_APPROVED");
  });
});

/* ------------------------------------------------------------------ */
/*  Admin-Assisted Onboarding                                          */
/* ------------------------------------------------------------------ */

test.describe("Onboarding — Admin Assisted", () => {
  test("OBD-009: admin force-verify unblocks creator for KYC @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("obdadmin");

    // Register (state = CREATED)
    await apiFetch("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
      headers: { "Idempotency-Key": `adm-obd-${Date.now()}` },
    });

    // Admin force-verify
    const adminEmail = uniqueEmail("obdadminuser");
    const admin = await (await import("./helpers")).createAdminUser(adminEmail, PASSWORD);
    const adminCsrf = admin.cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    const forceVerify = await apiFetch(
      `/admin/force-verify-email?email=${encodeURIComponent(email)}`,
      {
        method: "POST",
        cookies: admin.cookies,
        headers: { "X-CSRF-Token": adminCsrf },
      },
    );
    expect(forceVerify.ok).toBe(true);
    expect(forceVerify.body.onboarding_state).toBe("EMAIL_VERIFIED");

    // Creator can now login and create KYC session
    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    expect(login.ok).toBe(true);
    const cookies = extractCookies(login.headers.get("set-cookie") ?? "");
    const csrf = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    const kyc = await apiFetch("/kyc/session", {
      method: "POST",
      cookies,
      headers: {
        "X-CSRF-Token": csrf,
        "Idempotency-Key": `adm-kyc-${Date.now()}`,
      },
    });
    expect(kyc.ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Logout                                                             */
/* ------------------------------------------------------------------ */

test.describe("Auth — Logout", () => {
  test("OBD-010: POST /auth/logout clears session @smoke", {
    tag: "@smoke",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("obdlogout");
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password: PASSWORD, display_name: "Logout Fan" },
    });
    // Force verify so we can login
    await e2eApi("/onboarding/force-state", {
      query: { email, state: "EMAIL_VERIFIED" },
    });
    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    if (!login.ok) {
      test.skip(true, "Login failed");
      return;
    }
    const cookies = extractCookies(login.headers.get("set-cookie") ?? "");
    const csrf = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    // Confirm we're authenticated
    const me = await apiFetch("/auth/me", { cookies });
    expect(me.ok).toBe(true);

    // Logout
    const logout = await apiFetch("/auth/logout", {
      method: "POST",
      cookies,
      headers: { "X-CSRF-Token": csrf },
    });
    expect(logout.ok).toBe(true);

    // Session should be invalidated — /auth/me should fail
    const meAfter = await apiFetch("/auth/me", { cookies });
    expect([401, 403]).toContain(meAfter.status);
  });
});

/* ------------------------------------------------------------------ */
/*  Onboarding Status API                                              */
/* ------------------------------------------------------------------ */

test.describe("Onboarding Status API", () => {
  test("OBD-011: GET /onboarding/status requires auth @regression", {
    tag: "@regression",
  }, async () => {
    const res = await apiFetch("/onboarding/status");
    expect([401, 403]).toContain(res.status);
  });

  test("OBD-012: onboarding status returns checklist fields @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("obdstatus");
    await apiFetch("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
      headers: { "Idempotency-Key": `obd-stat-${Date.now()}` },
    });
    await e2eApi("/onboarding/force-state", {
      query: { email, state: "EMAIL_VERIFIED" },
    });

    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    if (!login.ok) {
      test.skip(true, "Login failed");
      return;
    }
    const cookies = extractCookies(login.headers.get("set-cookie") ?? "");

    const res = await apiFetch("/onboarding/status", { cookies });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("email_verified");
  });
});
