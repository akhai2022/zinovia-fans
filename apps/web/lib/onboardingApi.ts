/**
 * Typed API client for creator onboarding (Feature 1).
 * Uses fetch with credentials. Regenerate @zinovia/contracts for full OpenAPI client.
 */

import { getApiBaseUrl } from "./apiBase";

const base = () =>
  typeof window !== "undefined" ? getApiBaseUrl() : process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type CreatorRegisterResponse = {
  creator_id: string;
  email_delivery_status?: "sent" | "failed" | string;
  email_delivery_error_code?: string | null;
};
export type VerifyEmailResponse = { creator_id: string; state: string };
export type OnboardingStatusResponse = { state: string; checklist: Record<string, boolean> };
export type KycSessionResponse = { redirect_url: string; session_id: string };
export type KycStatusResponse = { session_status: string; creator_state: string };
export type KycMockCompleteResponse = { ack: boolean };
export type ResendVerificationEmailResponse = {
  email_delivery_status: "sent" | "failed" | string;
  email_delivery_error_code?: string | null;
};

type FetchJsonOpts = Omit<RequestInit, "body"> & {
  jsonBody?: Record<string, unknown>;
  idempotencyKey?: string;
};

async function fetchJson<T>(path: string, opts: FetchJsonOpts = {}): Promise<T> {
  const { jsonBody, idempotencyKey, ...rest } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string>),
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const fetchOpts: RequestInit = {
    ...rest,
    headers,
    credentials: "include",
  };
  if (jsonBody !== undefined) {
    fetchOpts.body = JSON.stringify(jsonBody);
  }
  const res = await fetch(`${base()}${path}`, fetchOpts);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: unknown };
    const d = err.detail;
    if (typeof d === "object" && d && "message" in d) {
      throw new Error(String((d as { message?: string }).message ?? res.statusText));
    }
    if (typeof d === "string") throw new Error(d);
    throw new Error(res.statusText || "Request failed");
  }
  return res.json() as Promise<T>;
}

export async function registerCreator(
  email: string,
  password: string,
  idempotencyKey: string
): Promise<CreatorRegisterResponse> {
  return fetchJson("/auth/register", {
    method: "POST",
    jsonBody: { email, password },
    idempotencyKey,
  });
}

export async function verifyEmail(
  token: string,
  idempotencyKey: string
): Promise<VerifyEmailResponse> {
  return fetchJson("/auth/verify-email", {
    method: "POST",
    jsonBody: { token },
    idempotencyKey,
  });
}

export async function resendVerificationEmail(
  email: string,
  idempotencyKey: string
): Promise<ResendVerificationEmailResponse> {
  return fetchJson("/auth/resend-verification-email", {
    method: "POST",
    jsonBody: { email },
    idempotencyKey,
  });
}

export async function getOnboardingStatus(): Promise<OnboardingStatusResponse> {
  return fetchJson("/onboarding/status", { method: "GET" });
}

export async function createKycSession(
  idempotencyKey: string
): Promise<KycSessionResponse> {
  return fetchJson("/kyc/session", {
    method: "POST",
    jsonBody: {},
    idempotencyKey,
  });
}

export async function getKycStatus(): Promise<KycStatusResponse> {
  return fetchJson("/kyc/status", { method: "GET" });
}

export async function kycMockComplete(
  sessionId: string,
  status: "APPROVED" | "REJECTED"
): Promise<KycMockCompleteResponse> {
  return fetchJson("/kyc/mock-complete", {
    method: "POST",
    jsonBody: { session_id: sessionId, status },
  });
}
