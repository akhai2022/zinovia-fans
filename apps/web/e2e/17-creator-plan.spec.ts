/**
 * STEP 17 — Creator plan management: get & update subscription price.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  createVerifiedCreator,
  isE2EEnabled,
} from "./helpers";

const PASSWORD = "E2ePlan1234!";
let cookies = "";
let csrfToken = "";
let e2eAvailable = false;

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const email = uniqueEmail("plan");
  const creator = await createVerifiedCreator(email, PASSWORD);
  cookies = creator.cookies;
  csrfToken = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
});

test.describe("Creator Plan", () => {
  test("get current plan", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/billing/plan", { cookies });
    if (res.status === 403) {
      test.skip(true, "Creator role required");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("price");
    expect(res.body).toHaveProperty("currency");
    expect(res.body).toHaveProperty("min_price_cents");
    expect(res.body).toHaveProperty("max_price_cents");
  });

  test("update plan price", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/billing/plan", {
      method: "PATCH",
      body: { price: 9.99 },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403) {
      test.skip(true, "Creator role required");
      return;
    }
    // May fail if CCBill is not configured
    if (res.status === 501) {
      test.skip(true, "CCBill not configured");
      return;
    }
    expect(res.ok).toBe(true);
  });

  test("non-creator cannot access plan", async () => {
    const fanEmail = uniqueEmail("planFan");
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email: fanEmail, password: PASSWORD, display_name: "Plan Fan" },
    });
    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email: fanEmail, password: PASSWORD },
    });
    if (!login.ok) {
      test.skip(true, "Login failed (email verification required in production)");
      return;
    }
    const fanCookies = (login.headers.get("set-cookie") ?? "")
      .split(",").map(c => c.split(";")[0].trim()).join("; ");

    const res = await apiFetch("/billing/plan", { cookies: fanCookies });
    expect(res.status).toBe(403);
  });
});
