/**
 * STEP 03 — Creator auth: register, email verification, onboarding state.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  getVerificationToken,
  extractCookies,
} from "./helpers";

const PASSWORD = "E2eCreator123!";

test.describe("Creator Registration & Verification", () => {
  const email = uniqueEmail("creator");

  test("creator register via API succeeds", async () => {
    const idempotencyKey = `e2e-reg-${Date.now()}`;
    const res = await apiFetch("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
      headers: { "Idempotency-Key": idempotencyKey },
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty("creator_id");
    expect(res.body).toHaveProperty("email_delivery_status");
  });

  test("creator register without idempotency-key fails", async () => {
    const res = await apiFetch("/auth/register", {
      method: "POST",
      body: { email: uniqueEmail("noidmp"), password: PASSWORD },
    });
    // Should require idempotency key
    expect([400, 422]).toContain(res.status);
  });

  test("verification token available after registration", async () => {
    const token = await getVerificationToken(email);
    expect(token).toBeTruthy();
  });

  test("verify-email transitions to EMAIL_VERIFIED and sets cookie", async () => {
    const token = await getVerificationToken(email);
    expect(token).toBeTruthy();

    const idempotencyKey = `e2e-verify-${Date.now()}`;
    const res = await apiFetch("/auth/verify-email", {
      method: "POST",
      body: { token },
      headers: { "Idempotency-Key": idempotencyKey },
    });
    expect(res.ok).toBe(true);
    expect(res.body.state).toBe("EMAIL_VERIFIED");
    expect(res.body.role).toBe("creator");

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("access_token");
  });

  test("creator login returns session with creator role", async () => {
    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    expect(login.ok).toBe(true);

    const cookies = extractCookies(login.headers.get("set-cookie") ?? "");
    const me = await apiFetch("/auth/me", { cookies });
    expect(me.ok).toBe(true);
    expect(me.body.role).toBe("creator");
  });
});

test.describe("Creator Onboarding State", () => {
  const email = uniqueEmail("onboard");

  test.beforeAll(async () => {
    const idempotencyKey = `e2e-onboard-${Date.now()}`;
    await apiFetch("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
      headers: { "Idempotency-Key": idempotencyKey },
    });
  });

  test("onboarding state is CREATED before verification", async () => {
    const tokens = await apiFetch(`/auth/dev/tokens?email=${encodeURIComponent(email)}`);
    expect(tokens.ok).toBe(true);
    expect(tokens.body.onboarding_state).toBe("CREATED");
  });

  test("after verify-email, state is EMAIL_VERIFIED", async () => {
    const token = await getVerificationToken(email);
    expect(token).toBeTruthy();

    const idempotencyKey = `e2e-verify-onboard-${Date.now()}`;
    const res = await apiFetch("/auth/verify-email", {
      method: "POST",
      body: { token },
      headers: { "Idempotency-Key": idempotencyKey },
    });
    expect(res.ok).toBe(true);
    expect(res.body.state).toBe("EMAIL_VERIFIED");
  });
});
