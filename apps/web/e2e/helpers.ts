/**
 * Shared helpers for Playwright E2E tests.
 * Reads configuration from environment or falls back to local defaults.
 */

import { type Page, expect } from "@playwright/test";

/* --------------- env / config --------------- */

export const WEB_BASE =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.WEB_BASE_URL ??
  "http://localhost:3000";

export const API_BASE =
  process.env.API_BASE_URL ?? "http://127.0.0.1:8000";

export const E2E_SECRET = process.env.E2E_SECRET ?? "e2e-dev-secret";

/** True when running against the real production deployment. */
export const IS_PROD = API_BASE.includes("api.zinovia.ai");

/* --------------- unique ids --------------- */

const RUN_ID = Date.now().toString(36);
let counter = 0;

/** Generate a unique email for test isolation. */
export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}+${RUN_ID}${++counter}@test.zinovia.ai`;
}

/** Generate a unique handle for creator registration. */
export function uniqueHandle(prefix = "e2e"): string {
  return `${prefix}${RUN_ID}${++counter}`.slice(0, 20);
}

/* --------------- API helpers (direct fetch) --------------- */

interface ApiResponse {
  ok: boolean;
  status: number;
  body: any;
  headers: Headers;
}

/** Raw API fetch — use for direct endpoint testing. */
export async function apiFetch(
  path: string,
  opts: {
    method?: string;
    body?: any;
    cookies?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<ApiResponse> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.cookies ? { Cookie: opts.cookies } : {}),
    ...(opts.headers ?? {}),
  };
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let body: any;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { ok: res.ok, status: res.status, body, headers: res.headers };
}

/** Call an E2E-only endpoint (adds X-E2E-Secret header). */
export async function e2eApi(
  subpath: string,
  opts: {
    method?: string;
    body?: any;
    query?: Record<string, string>;
  } = {},
): Promise<ApiResponse> {
  let url = `${API_BASE}/__e2e__${subpath}`;
  if (opts.query) {
    const params = new URLSearchParams(opts.query);
    url += `?${params.toString()}`;
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-E2E-Secret": E2E_SECRET,
  };
  const res = await fetch(url, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let body: any;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { ok: res.ok, status: res.status, body, headers: res.headers };
}

/* --------------- cookie helpers --------------- */

/** Extract cookies string from set-cookie header. */
export function extractCookies(setCookie: string): string {
  return setCookie
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .join("; ");
}

/* --------------- auth helpers --------------- */

/**
 * Sign up a fan via the API and return session cookies.
 * Uses direct API calls to avoid flaky UI interactions.
 */
export async function signupFan(
  email: string,
  password: string,
  displayName = "E2E Fan",
): Promise<{ cookies: string }> {
  const signup = await apiFetch("/auth/signup", {
    method: "POST",
    body: { email, password, display_name: displayName },
  });
  if (!signup.ok && signup.status !== 409) {
    throw new Error(`Fan signup failed: ${signup.status} ${JSON.stringify(signup.body)}`);
  }

  const login = await apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (!login.ok) {
    throw new Error(`Fan login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }
  const setCookie = login.headers.get("set-cookie") ?? "";
  return { cookies: extractCookies(setCookie) };
}

/**
 * Register a creator via the API and return session info.
 */
export async function registerCreator(
  email: string,
  password: string,
): Promise<{ cookies: string; userId?: string }> {
  const idempotencyKey = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const reg = await apiFetch("/auth/register", {
    method: "POST",
    body: { email, password },
    headers: { "Idempotency-Key": idempotencyKey },
  });
  if (!reg.ok && reg.status !== 409) {
    throw new Error(`Creator register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  }

  const login = await apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (!login.ok) {
    throw new Error(`Creator login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }
  const setCookie = login.headers.get("set-cookie") ?? "";
  return { cookies: extractCookies(setCookie), userId: login.body?.id };
}

/**
 * Get email verification token via dev endpoint.
 * Works only in non-production environments.
 */
export async function getVerificationToken(email: string): Promise<string | null> {
  const res = await apiFetch(`/auth/dev/tokens?email=${encodeURIComponent(email)}`);
  if (!res.ok) return null;
  return res.body?.verification_token ?? null;
}

/**
 * Get password reset token via dev endpoint.
 */
export async function getResetToken(email: string): Promise<string | null> {
  const res = await apiFetch(`/auth/dev/tokens?email=${encodeURIComponent(email)}`);
  if (!res.ok) return null;
  return res.body?.password_reset_token ?? null;
}

/**
 * Create a fully-verified creator with profile via E2E bypass.
 */
export async function createVerifiedCreator(
  email: string,
  password: string,
): Promise<{ cookies: string; userId: string }> {
  // Register
  const idempotencyKey = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await apiFetch("/auth/register", {
    method: "POST",
    body: { email, password },
    headers: { "Idempotency-Key": idempotencyKey },
  });

  // Force role to creator with KYC_APPROVED via E2E endpoint
  const forceResult = await e2eApi("/auth/force-role", {
    query: { email, role: "creator" },
  });
  if (!forceResult.ok) {
    throw new Error(`Force role failed: ${forceResult.status} ${JSON.stringify(forceResult.body)}`);
  }

  // Login
  const login = await apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (!login.ok) {
    throw new Error(`Creator login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }
  const setCookie = login.headers.get("set-cookie") ?? "";
  return {
    cookies: extractCookies(setCookie),
    userId: forceResult.body?.user_id ?? login.body?.id,
  };
}

/**
 * Create an admin user via E2E bypass.
 */
export async function createAdminUser(
  email: string,
  password: string,
): Promise<{ cookies: string; userId: string }> {
  // Signup as fan first
  await apiFetch("/auth/signup", {
    method: "POST",
    body: { email, password, display_name: "E2E Admin" },
  });

  // Force role to admin
  const forceResult = await e2eApi("/auth/force-role", {
    query: { email, role: "admin" },
  });
  if (!forceResult.ok) {
    throw new Error(`Force admin failed: ${forceResult.status} ${JSON.stringify(forceResult.body)}`);
  }

  // Login
  const login = await apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (!login.ok) {
    throw new Error(`Admin login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }
  const setCookie = login.headers.get("set-cookie") ?? "";
  return {
    cookies: extractCookies(setCookie),
    userId: forceResult.body?.user_id,
  };
}

/* --------------- page helpers --------------- */

/** Login via the web UI form. */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await safeGoto(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Wait for navigation away from login page
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });
}

/** Assert page has no uncaught JS errors. */
export function collectJSErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

/** Wait for API response on a given path pattern. */
export async function waitForApi(
  page: Page,
  pathPattern: string | RegExp,
  opts?: { status?: number },
) {
  return page.waitForResponse(
    (res) => {
      const matches =
        typeof pathPattern === "string"
          ? res.url().includes(pathPattern)
          : pathPattern.test(res.url());
      if (!matches) return false;
      if (opts?.status !== undefined) return res.status() === opts.status;
      return true;
    },
    { timeout: 15000 },
  );
}

/** Wait for app to be ready (health check). */
export async function waitForAppReady(): Promise<void> {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("API not ready after 30 seconds");
}

/**
 * Activate a PPV post purchase via E2E bypass.
 */
export async function activatePostPurchase(
  fanEmail: string,
  postId: string,
): Promise<ApiResponse> {
  return e2eApi("/ppv/activate-post-purchase", {
    query: { fan_email: fanEmail, post_id: postId },
  });
}

/**
 * Resilient page.goto() — retries once on transient network errors
 * (ERR_NETWORK_CHANGED, ERR_CONNECTION_RESET) that occur against remote hosts.
 */
export async function safeGoto(page: Page, path: string): Promise<void> {
  try {
    await page.goto(path);
  } catch (err: any) {
    const msg = err?.message ?? "";
    if (
      msg.includes("ERR_NETWORK_CHANGED") ||
      msg.includes("ERR_CONNECTION_RESET") ||
      msg.includes("ERR_NETWORK_IO_SUSPENDED")
    ) {
      await page.waitForTimeout(500);
      await page.goto(path);
    } else {
      throw err;
    }
  }
}

/** Check if E2E endpoints are available. */
export async function isE2EEnabled(): Promise<boolean> {
  try {
    // Use cleanup with a prefix that matches nothing — returns 200 if E2E enabled
    const res = await e2eApi("/cleanup", {
      query: { email_prefix: "e2e_probe_nonexistent_" },
    });
    return res.ok; // 200 = E2E enabled, 404 = not enabled, 403 = bad secret
  } catch {
    return false;
  }
}
