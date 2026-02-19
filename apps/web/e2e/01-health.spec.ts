/**
 * STEP 0 — Baseline Health & Configuration checks.
 * These must pass before any functional tests run.
 */

import { test, expect } from "@playwright/test";
import { API_BASE, WEB_BASE, apiFetch } from "./helpers";

test.describe("Baseline Health", () => {
  test("API /health returns ok", async () => {
    const res = await apiFetch("/health");
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("ok", true);
  });

  test("API /ready returns ok", async () => {
    const res = await apiFetch("/ready");
    expect(res.ok).toBe(true);
  });

  test("Web homepage loads (HTTP 200)", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("Web homepage contains Zinovia branding", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title.toLowerCase()).toContain("zinovia");
  });

  test("CORS allows web origin", async () => {
    const res = await fetch(`${API_BASE}/health`, {
      method: "OPTIONS",
      headers: {
        Origin: WEB_BASE,
        "Access-Control-Request-Method": "GET",
      },
    });
    const acao = res.headers.get("access-control-allow-origin");
    expect(acao).toBeTruthy();
  });

  test("Billing health endpoint accessible", async () => {
    const res = await apiFetch("/billing/health");
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("stripe_configured");
  });
});
