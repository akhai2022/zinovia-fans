const DEV_API_DEFAULT = "http://127.0.0.1:8000";

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getServerApiBaseUrl(): string {
  const raw = process.env.API_BASE_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";
  if (raw) return trimTrailingSlash(raw);
  if (process.env.NODE_ENV !== "production") return DEV_API_DEFAULT;
  return "http://api:8000";
}

export function getBrowserApiBaseUrl(): string {
  const useSameOriginProxy = process.env.NEXT_PUBLIC_API_SAME_ORIGIN_PROXY === "true";
  if (useSameOriginProxy) {
    return "/api";
  }
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";
  if (configured) {
    let base = trimTrailingSlash(configured);
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      const isLoopback =
        base.startsWith("http://localhost:") || base.startsWith("http://127.0.0.1:");
      if (isLoopback) {
        base = `${window.location.protocol}//${window.location.hostname}:8000`;
      }
    }
    return base;
  }
  if (typeof window !== "undefined") {
    if (process.env.NODE_ENV !== "production") {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    return window.location.origin;
  }
  return getServerApiBaseUrl();
}

export function getApiBaseUrl(): string {
  return typeof window === "undefined" ? getServerApiBaseUrl() : getBrowserApiBaseUrl();
}
