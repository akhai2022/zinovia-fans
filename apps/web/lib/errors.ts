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
 * Normalize API failures into a consistent shape for UI.
 *
 * Handles both the `ApiError` class from @zinovia/contracts (used by OpenAPI
 * generated services) and the newer `ApiClientError` from `lib/api/client`.
 */
export function getApiErrorMessage(err: unknown): ApiErrorMessage {
  // Handle ApiClientError (from apiFetch / apiFetchServer)
  if (err instanceof ApiClientError) {
    if (err.status === 401) {
      return { kind: "unauthorized", message: "Sign in to continue.", status: 401 };
    }
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
    const detail = err.detail || "";
    const friendly = FRIENDLY_MESSAGES[detail];
    return {
      kind: "error",
      message: friendly || detail || err.message || `Request failed (${err.status})`,
      status: err.status,
      requestId: err.requestId,
    };
  }

  // Handle ApiError (from @zinovia/contracts OpenAPI client)
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return { kind: "unauthorized", message: "Sign in to continue." };
    }
    const detail =
      err.body &&
      typeof err.body === "object" &&
      "detail" in err.body
        ? String((err.body as { detail?: unknown }).detail)
        : err.statusText;
    const friendly = detail ? FRIENDLY_MESSAGES[detail] : undefined;
    return {
      kind: "error",
      message: friendly || detail || `Request failed (${err.status})`,
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
