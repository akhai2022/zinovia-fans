/**
 * Shared helpers for Playwright E2E tests.
 * Reads configuration from environment or falls back to production defaults.
 */

import { type Page, expect } from "@playwright/test";

/* --------------- env / config --------------- */

export const WEB_BASE =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.BASE_URL ??
  "https://zinovia.ai";

export const API_BASE =
  process.env.API_BASE_URL ?? "https://api.zinovia.ai";

/** True when running against the real production deployment. */
export const IS_PROD = API_BASE.includes("api.zinovia.ai");

/* --------------- unique ids --------------- */

const TS = Date.now();
let counter = 0;

/** Generate a unique email for test isolation. */
export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}+${TS}${++counter}@test.zinovia.ai`;
}

/** Generate a unique handle for creator registration. */
export function uniqueHandle(prefix = "e2e"): string {
  return `${prefix}${TS}${++counter}`.slice(0, 20);
}

/* --------------- API helpers (direct fetch) --------------- */

interface ApiResponse {
  ok: boolean;
  status: number;
  body: any;
  headers: Headers;
}

/** Raw API fetch with cookies forwarded from Playwright page context. */
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
    credentials: "include",
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

/* --------------- auth helpers --------------- */

/**
 * Sign up a fan via the API and return session cookies.
 * Uses direct API calls to avoid flaky UI interactions.
 */
export async function signupFan(
  email: string,
  password: string,
): Promise<{ cookies: string }> {
  const signup = await apiFetch("/auth/signup", {
    method: "POST",
    body: { email, password, display_name: "E2E Fan" },
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
  return { cookies: setCookie };
}

/**
 * Register a creator via the API and return session info.
 */
export async function registerCreator(
  email: string,
  password: string,
): Promise<{ cookies: string; userId?: string }> {
  const idempotencyKey = `e2e-${Date.now()}`;
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
  return { cookies: setCookie, userId: login.body?.id };
}

/* --------------- page helpers --------------- */

/** Login via the web UI form. */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for navigation away from login page
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10000,
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
