/**
 * Single source of truth for API base URL used by the browser.
 * All @zinovia/contracts calls use this via OpenAPI.BASE set in lib/api.ts.
 */

const DEV_DEFAULT = "http://127.0.0.1:8000";

/**
 * Resolves the API base URL for client-side requests.
 * - Uses NEXT_PUBLIC_API_BASE_URL when set.
 * - In the browser: if configured URL is localhost/127.0.0.1 but the page was opened
 *   via another host (e.g. http://192.168.x.x:3000), use same host with port 8000
 *   so the API is reachable (avoids "API unreachable" when not on same machine as localhost).
 * - In production, throws if unset.
 */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const trimmed = raw.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && !trimmed) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL must be set in production. Set it in your deployment environment."
    );
  }

  let base = trimmed || DEV_DEFAULT;

  if (typeof window !== "undefined" && !isProduction) {
    const isConfigLoopback =
      base.startsWith("http://localhost:") || base.startsWith("http://127.0.0.1:");
    if (isConfigLoopback) {
      base = `${window.location.protocol}//${window.location.hostname}:8000`;
    }
  }

  return base;
}
