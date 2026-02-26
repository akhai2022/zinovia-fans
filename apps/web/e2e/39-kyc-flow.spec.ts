/**
 * STEP 39 — KYC Flow: session creation, status, complete, state transitions, RBAC.
 *
 * Covers the full KYC lifecycle:
 *   CREATED → EMAIL_VERIFIED → KYC_PENDING → KYC_SUBMITTED → KYC_APPROVED/KYC_REJECTED
 *
 * Uses E2E bypass endpoints to position creators in specific onboarding states.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  e2eApi,
  extractCookies,
  isE2EEnabled,
  signupFan,
} from "./helpers";

const PASSWORD = "E2eKyc12345!";
let e2eAvailable = false;

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
});

/* ------------------------------------------------------------------ */
/*  Helper: register a creator and position to a given onboarding state */
/* ------------------------------------------------------------------ */

async function creatorAtState(
  state: string,
): Promise<{ email: string; cookies: string; csrf: string; userId: string }> {
  const email = uniqueEmail("kyc");
  const idempotencyKey = `e2e-kyc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await apiFetch("/auth/register", {
    method: "POST",
    body: { email, password: PASSWORD },
    headers: { "Idempotency-Key": idempotencyKey },
  });

  // Force to requested state via E2E bypass
  if (state !== "CREATED") {
    await e2eApi("/onboarding/force-state", {
      query: { email, state },
    });
  }

  // Force role to creator (creates profile) — but only if state isn't CREATED
  // because force-role auto-transitions CREATED → KYC_APPROVED
  if (state === "CREATED") {
    // Just set role without triggering auto-transition
    await e2eApi("/auth/force-role", {
      query: { email, role: "creator" },
    });
    // Re-set the onboarding state back to CREATED
    await e2eApi("/onboarding/force-state", {
      query: { email, state: "CREATED" },
    });
  } else {
    await e2eApi("/auth/force-role", {
      query: { email, role: "creator" },
    });
    // Re-apply desired state after force-role (which sets KYC_APPROVED)
    if (state !== "KYC_APPROVED") {
      await e2eApi("/onboarding/force-state", {
        query: { email, state },
      });
    }
  }

  // Login
  const login = await apiFetch("/auth/login", {
    method: "POST",
    body: { email, password: PASSWORD },
  });
  if (!login.ok) {
    throw new Error(`Login failed: ${login.status}`);
  }
  const cookies = extractCookies(login.headers.get("set-cookie") ?? "");
  const csrf = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
  const userId = login.body?.id ?? "";
  return { email, cookies, csrf, userId };
}

/* ------------------------------------------------------------------ */
/*  KYC Session Creation                                               */
/* ------------------------------------------------------------------ */

test.describe("KYC Session — Create", () => {
  test("KYC-001: create session for EMAIL_VERIFIED creator @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const { cookies, csrf } = await creatorAtState("EMAIL_VERIFIED");

    const res = await apiFetch("/kyc/session", {
      method: "POST",
      cookies,
      headers: {
        "X-CSRF-Token": csrf,
        "Idempotency-Key": `kyc-session-${Date.now()}`,
      },
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("redirect_url");
    expect(res.body).toHaveProperty("session_id");
    expect(res.body.redirect_url).toContain("/kyc/verify");
  });

  test("KYC-002: create session is idempotent @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const { cookies, csrf } = await creatorAtState("EMAIL_VERIFIED");
    const idempotencyKey = `kyc-idem-${Date.now()}`;

    const res1 = await apiFetch("/kyc/session", {
      method: "POST",
      cookies,
      headers: { "X-CSRF-Token": csrf, "Idempotency-Key": idempotencyKey },
    });
    expect(res1.ok).toBe(true);

    const res2 = await apiFetch("/kyc/session", {
      method: "POST",
      cookies,
      headers: { "X-CSRF-Token": csrf, "Idempotency-Key": idempotencyKey },
    });
    expect(res2.ok).toBe(true);
    expect(res2.body.session_id).toBe(res1.body.session_id);
  });

  test("KYC-003: session creation rejected for CREATED state (email not verified) @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const { cookies, csrf } = await creatorAtState("CREATED");

    const res = await apiFetch("/kyc/session", {
      method: "POST",
      cookies,
      headers: {
        "X-CSRF-Token": csrf,
        "Idempotency-Key": `kyc-created-${Date.now()}`,
      },
    });
    expect(res.status).toBe(400);
    expect(res.body?.detail?.error_code ?? res.body?.detail).toMatch(
      /invalid_state_for_kyc|email.*verified/i,
    );
  });

  test("KYC-004: session creation rejected for KYC_APPROVED (already done) @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const { cookies, csrf } = await creatorAtState("KYC_APPROVED");

    const res = await apiFetch("/kyc/session", {
      method: "POST",
      cookies,
      headers: {
        "X-CSRF-Token": csrf,
        "Idempotency-Key": `kyc-approved-${Date.now()}`,
      },
    });
    expect(res.status).toBe(400);
  });

  test("KYC-005: session creation allowed from KYC_REJECTED (retry) @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const { cookies, csrf } = await creatorAtState("KYC_REJECTED");

    const res = await apiFetch("/kyc/session", {
      method: "POST",
      cookies,
      headers: {
        "X-CSRF-Token": csrf,
        "Idempotency-Key": `kyc-retry-${Date.now()}`,
      },
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("redirect_url");
  });
});

/* ------------------------------------------------------------------ */
/*  KYC Status                                                         */
/* ------------------------------------------------------------------ */

test.describe("KYC Status", () => {
  test("KYC-006: status for fresh creator shows NONE/CREATED @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const { cookies } = await creatorAtState("EMAIL_VERIFIED");

    const res = await apiFetch("/kyc/status", { cookies });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("session_status");
    expect(res.body).toHaveProperty("creator_state");
    // Before creating a session, status is NONE
    expect(res.body.session_status).toBe("NONE");
  });

  test("KYC-007: status after session creation shows KYC_PENDING @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const { cookies, csrf } = await creatorAtState("EMAIL_VERIFIED");

    // Create session
    await apiFetch("/kyc/session", {
      method: "POST",
      cookies,
      headers: {
        "X-CSRF-Token": csrf,
        "Idempotency-Key": `kyc-stat-${Date.now()}`,
      },
    });

    const res = await apiFetch("/kyc/status", { cookies });
    expect(res.ok).toBe(true);
    expect(res.body.session_status).toBe("CREATED");
    expect(res.body.creator_state).toBe("KYC_PENDING");
  });
});

/* ------------------------------------------------------------------ */
/*  KYC Complete (submit documents)                                    */
/* ------------------------------------------------------------------ */

test.describe("KYC Complete", () => {
  test("KYC-008: complete with APPROVED transitions to KYC_APPROVED @smoke", {
    tag: "@smoke",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const { cookies, csrf } = await creatorAtState("EMAIL_VERIFIED");

    // Create session
    const session = await apiFetch("/kyc/session", {
      method: "POST",
      cookies,
      headers: {
        "X-CSRF-Token": csrf,
        "Idempotency-Key": `kyc-complete-${Date.now()}`,
      },
    });
    expect(session.ok).toBe(true);
    const sessionId = session.body.session_id;

    // Complete with APPROVED
    const res = await apiFetch("/kyc/complete", {
      method: "POST",
      cookies,
      body: { session_id: sessionId, status: "APPROVED" },
      headers: { "X-CSRF-Token": csrf },
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("ack", true);

    // Verify state transition
    const status = await apiFetch("/kyc/status", { cookies });
    expect(status.ok).toBe(true);
    expect(status.body.creator_state).toBe("KYC_APPROVED");
  });

  test("KYC-009: complete with REJECTED transitions to KYC_REJECTED @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const { cookies, csrf } = await creatorAtState("EMAIL_VERIFIED");

    // Create session
    const session = await apiFetch("/kyc/session", {
      method: "POST",
      cookies,
      headers: {
        "X-CSRF-Token": csrf,
        "Idempotency-Key": `kyc-reject-${Date.now()}`,
      },
    });
    const sessionId = session.body.session_id;

    // Complete with REJECTED
    const res = await apiFetch("/kyc/complete", {
      method: "POST",
      cookies,
      body: { session_id: sessionId, status: "REJECTED" },
      headers: { "X-CSRF-Token": csrf },
    });
    expect(res.ok).toBe(true);

    const status = await apiFetch("/kyc/status", { cookies });
    expect(status.body.creator_state).toBe("KYC_REJECTED");
  });

  test("KYC-010: complete with invalid session_id returns 400/404 @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const { cookies, csrf } = await creatorAtState("KYC_PENDING");

    const res = await apiFetch("/kyc/complete", {
      method: "POST",
      cookies,
      body: {
        session_id: "00000000-0000-0000-0000-000000000000",
        status: "APPROVED",
      },
      headers: { "X-CSRF-Token": csrf },
    });
    expect([400, 404]).toContain(res.status);
  });

  test("KYC-011: complete without session_id returns 400 @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const { cookies, csrf } = await creatorAtState("KYC_PENDING");

    const res = await apiFetch("/kyc/complete", {
      method: "POST",
      cookies,
      body: { status: "APPROVED" },
      headers: { "X-CSRF-Token": csrf },
    });
    expect(res.status).toBe(400);
  });

  test("KYC-012: complete with invalid status value returns 400 @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const { cookies, csrf } = await creatorAtState("KYC_PENDING");

    const res = await apiFetch("/kyc/complete", {
      method: "POST",
      cookies,
      body: {
        session_id: "00000000-0000-0000-0000-000000000001",
        status: "INVALID_STATUS",
      },
      headers: { "X-CSRF-Token": csrf },
    });
    expect(res.status).toBe(400);
  });
});

/* ------------------------------------------------------------------ */
/*  KYC RBAC / Access Control                                          */
/* ------------------------------------------------------------------ */

test.describe("KYC — RBAC", () => {
  test("KYC-013: fan cannot access KYC session endpoint @smoke", {
    tag: "@smoke",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const fanEmail = uniqueEmail("kycfan");
    let fanCookies = "";
    try {
      const fan = await signupFan(fanEmail, PASSWORD, "KYC Fan");
      fanCookies = fan.cookies;
    } catch {
      test.skip(true, "Fan login failed");
      return;
    }
    const csrf = fanCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    const res = await apiFetch("/kyc/session", {
      method: "POST",
      cookies: fanCookies,
      headers: {
        "X-CSRF-Token": csrf,
        "Idempotency-Key": `kyc-fan-${Date.now()}`,
      },
    });
    // Fan should get 400 (invalid_state_for_kyc) or 403
    expect([400, 403]).toContain(res.status);
  });

  test("KYC-014: unauthenticated user gets 401 on KYC endpoints @smoke", {
    tag: "@smoke",
  }, async () => {
    const res = await apiFetch("/kyc/status");
    expect([401, 403]).toContain(res.status);
  });

  test("KYC-015: creator cannot complete another creator's session @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");

    // Creator A creates a session
    const creatorA = await creatorAtState("EMAIL_VERIFIED");
    const sessionRes = await apiFetch("/kyc/session", {
      method: "POST",
      cookies: creatorA.cookies,
      headers: {
        "X-CSRF-Token": creatorA.csrf,
        "Idempotency-Key": `kyc-idor-a-${Date.now()}`,
      },
    });
    expect(sessionRes.ok).toBe(true);
    const sessionId = sessionRes.body.session_id;

    // Creator B tries to complete Creator A's session
    const creatorB = await creatorAtState("KYC_PENDING");
    const res = await apiFetch("/kyc/complete", {
      method: "POST",
      cookies: creatorB.cookies,
      body: { session_id: sessionId, status: "APPROVED" },
      headers: { "X-CSRF-Token": creatorB.csrf },
    });
    expect([403, 404]).toContain(res.status);
  });
});

/* ------------------------------------------------------------------ */
/*  KYC UI Pages                                                       */
/* ------------------------------------------------------------------ */

test.describe("KYC UI Pages", () => {
  test("KYC-016: /onboarding page loads @regression", {
    tag: "@regression",
  }, async ({ page }) => {
    const res = await page.goto("/onboarding");
    // May redirect to login if not authenticated — either is valid
    expect(res?.status()).toBeLessThan(500);
  });

  test("KYC-017: /kyc/verify page loads @regression", {
    tag: "@regression",
  }, async ({ page }) => {
    const res = await page.goto("/kyc/verify");
    // May redirect to login or show error without session_id — no 500
    expect(res?.status()).toBeLessThan(500);
  });
});
