import { ApiError } from "@zinovia/contracts";

import { ApiClientError } from "./api/client";
import { getApiBaseUrl } from "./apiBase";

export type ApiErrorKind = "unauthorized" | "network" | "timeout" | "error";

export type ApiErrorMessage = {
  kind: ApiErrorKind;
  message: string;
  status?: number;
  /** Correlation ID from the API response (X-Request-Id), if available. */
  requestId?: string;
};

/** Well-known API error codes mapped to user-friendly messages. */
const FRIENDLY_MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  account_locked: "This account has been locked. Please contact support.",
  email_not_verified: "Please verify your email before signing in.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  handle_taken: "That handle is already taken. Choose another.",
  handle_length_invalid: "Handle must be between 2 and 64 characters.",
  handle_format_invalid:
    "Handle can only use letters, numbers, hyphens and underscores.",
  handle_reserved: "That handle is reserved.",
  creator_not_found: "Creator not found.",
  profile_not_found: "Profile not found.",
  email_already_registered: "An account with this email already exists.",
  cannot_follow_self: "You cannot follow yourself.",
};

/**
 * Extract the error code string from an API error response.
 * Handles both legacy `{detail: "code"}` and structured `{detail: {code, message}}`.
 */
export function getApiErrorCode(err: unknown): string {
  const body =
    (err instanceof ApiClientError || err instanceof ApiError)
      ? (err.body as { detail?: unknown } | undefined)
      : undefined;
  const raw = body && typeof body === "object" && "detail" in body ? body.detail : null;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "code" in (raw as Record<string, unknown>)) {
    return String((raw as Record<string, string>).code);
  }
  return "";
}

/**
 * Normalize API failures into a consistent shape for UI.
 *
 * Handles both the `ApiError` class from @zinovia/contracts (used by OpenAPI
 * generated services) and the newer `ApiClientError` from `lib/api/client`.
 */
export function getApiErrorMessage(err: unknown): ApiErrorMessage {
  // Handle ApiClientError (from apiFetch / apiFetchServer)
  if (err instanceof ApiClientError) {
    if (err.kind === "timeout") {
      return { kind: "timeout", message: "The request timed out. Please try again." };
    }
    if (err.kind === "network") {
      return {
        kind: "network",
        message:
          process.env.NODE_ENV === "development"
            ? `API unreachable. Is the API running at ${getApiBaseUrl()}?`
            : "API unreachable. Please try again later.",
      };
    }
    // Extract the error code from the response body.
    // API returns { detail: { code: "invalid_credentials", message: "..." } }
    // parseDetail() prefers `message` over `code`, so err.detail is the message.
    // We need the code to look up FRIENDLY_MESSAGES.
    const bodyObj = err.body as { detail?: unknown } | undefined;
    const rawBodyDetail = bodyObj && typeof bodyObj === "object" && "detail" in bodyObj ? bodyObj.detail : null;
    const errorCode =
      typeof rawBodyDetail === "string"
        ? rawBodyDetail
        : rawBodyDetail && typeof rawBodyDetail === "object" && "code" in (rawBodyDetail as Record<string, unknown>)
          ? String((rawBodyDetail as Record<string, string>).code)
          : "";
    const detail = err.detail || "";
    // Check for a known error code BEFORE the generic 401 fallback so that
    // login failures (invalid_credentials, email_not_verified, etc.) show
    // the correct message instead of the generic "Sign in to continue."
    const friendly = FRIENDLY_MESSAGES[errorCode] || FRIENDLY_MESSAGES[detail];
    if (friendly) {
      return {
        kind: err.status === 401 ? "unauthorized" : "error",
        message: friendly,
        status: err.status,
        requestId: err.requestId,
      };
    }
    if (err.status === 401) {
      return { kind: "unauthorized", message: "Sign in to continue.", status: 401 };
    }
    return {
      kind: "error",
      message: detail || err.message || `Request failed (${err.status})`,
      status: err.status,
      requestId: err.requestId,
    };
  }

  // Handle ApiError (from @zinovia/contracts OpenAPI client)
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | undefined;
    const rawDetail = body && typeof body === "object" && "detail" in body ? body.detail : null;
    // detail can be a string ("invalid_credentials") or object ({code: "...", message: "..."})
    const detailCode =
      typeof rawDetail === "string"
        ? rawDetail
        : rawDetail && typeof rawDetail === "object" && "code" in (rawDetail as Record<string, unknown>)
          ? String((rawDetail as Record<string, string>).code)
          : "";
    const friendly = detailCode ? FRIENDLY_MESSAGES[detailCode] : undefined;
    if (friendly) {
      return {
        kind: err.status === 401 ? "unauthorized" : "error",
        message: friendly,
        status: err.status,
      };
    }
    if (err.status === 401) {
      return { kind: "unauthorized", message: "Sign in to continue." };
    }
    const fallbackMsg = detailCode || (typeof rawDetail === "string" ? rawDetail : err.statusText);
    return {
      kind: "error",
      message: fallbackMsg || `Request failed (${err.status})`,
      status: err.status,
    };
  }

  // Handle raw network errors (e.g. from fetch)
  const isNetworkError =
    err instanceof TypeError &&
    (err.message === "Failed to fetch" || err.message.includes("fetch"));
  if (isNetworkError) {
    return {
      kind: "network",
      message:
        process.env.NODE_ENV === "development"
          ? `API unreachable. Is the API running at ${getApiBaseUrl()}?`
          : "API unreachable. Please try again later.",
    };
  }

  return {
    kind: "error",
    message: err instanceof Error ? err.message : "Something went wrong.",
  };
}
