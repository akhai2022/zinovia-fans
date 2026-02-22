import { OpenAPI } from "@zinovia/contracts";
import { getBrowserApiBaseUrl } from "./env";

function getCsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

OpenAPI.BASE = getBrowserApiBaseUrl();
OpenAPI.WITH_CREDENTIALS = true;
OpenAPI.HEADERS = async (): Promise<Record<string, string>> => {
  const csrfToken = getCsrfToken();
  if (csrfToken) return { "X-CSRF-Token": csrfToken };
  return {};
};

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.info("[zinovia-fans] API base URL:", OpenAPI.BASE);
}
