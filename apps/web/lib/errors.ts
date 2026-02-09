import { ApiError } from "@zinovia/contracts";

import { getApiBaseUrl } from "./apiBase";

export type ApiErrorKind = "unauthorized" | "network" | "error";

export type ApiErrorMessage = {
  kind: ApiErrorKind;
  message: string;
  status?: number;
};

/**
 * Normalize API failures into a consistent shape for UI.
 * - 401 -> Login CTA
 * - Network/fetch failure -> "API unreachable" (suggest localhost:8000 in dev)
 * - Other -> status + message for retry/details
 */
export function getApiErrorMessage(err: unknown): ApiErrorMessage {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return {
        kind: "unauthorized",
        message: "Sign in to continue.",
      };
    }
    const detail =
      err.body &&
      typeof err.body === "object" &&
      "detail" in err.body
        ? String((err.body as { detail?: unknown }).detail)
        : err.statusText;
    return {
      kind: "error",
      message: detail || `Request failed (${err.status})`,
      status: err.status,
    };
  }

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
