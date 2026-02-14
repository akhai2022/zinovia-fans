import { getApiBaseUrl, getServerApiBaseUrl } from "@/lib/env";

type Primitive = string | number | boolean;
type QueryParams = Record<string, Primitive | null | undefined>;

export class ApiClientError extends Error {
  status?: number;
  detail?: string;
  body?: unknown;
  kind: "http" | "network" | "timeout";
  /** Correlation ID from X-Request-Id header for error reporting. */
  requestId?: string;

  constructor(
    message: string,
    kind: "http" | "network" | "timeout",
    options: { status?: number; detail?: string; body?: unknown; requestId?: string } = {}
  ) {
    super(message);
    this.name = "ApiClientError";
    this.kind = kind;
    this.status = options.status;
    this.detail = options.detail;
    this.body = options.body;
    this.requestId = options.requestId;
  }
}

export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  query?: QueryParams;
  body?: unknown;
  timeoutMs?: number;
  baseUrl?: string;
  cookieHeader?: string;
};

function buildUrl(path: string, query?: QueryParams, baseUrl?: string): string {
  const base = baseUrl || getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function parseDetail(body: unknown): string | undefined {
  if (!body) return undefined;
  if (typeof body === "string") return body;
  if (typeof body === "object" && body !== null && "detail" in body) {
    return String((body as { detail?: unknown }).detail ?? "");
  }
  return undefined;
}

function parseResponseBody(text: string, contentType: string | null): unknown {
  if (contentType?.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function logFetchFailure(method: string, path: string, error: ApiClientError): void {
  if (process.env.NODE_ENV === "development") {
    // Dev-only debugging details.
    console.warn("[apiFetch] request failed", {
      method,
      path,
      kind: error.kind,
      status: error.status,
      detail: error.detail || error.message,
    });
  }
}

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const {
    query,
    body,
    timeoutMs = 10_000,
    headers,
    method = "GET",
    baseUrl,
    cookieHeader,
    credentials,
    ...rest
  } = options;
  const url = buildUrl(path, query, baseUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const finalHeaders = new Headers(headers ?? {});
    if (cookieHeader) {
      finalHeaders.set("cookie", cookieHeader);
    }
    let requestBody: BodyInit | undefined;
    if (body !== undefined) {
      if (body instanceof FormData) {
        requestBody = body;
      } else {
        if (!finalHeaders.has("content-type")) {
          finalHeaders.set("content-type", "application/json");
        }
        requestBody = JSON.stringify(body);
      }
    }
    const response = await fetch(url, {
      ...rest,
      method,
      headers: finalHeaders,
      body: requestBody,
      credentials: credentials ?? "include",
      signal: controller.signal,
      cache: rest.cache ?? "no-store",
    });
    const text = await response.text();
    const parsed = parseResponseBody(text, response.headers.get("content-type"));
    if (!response.ok) {
      const detail = parseDetail(parsed);
      const requestId = response.headers.get("x-request-id") ?? undefined;
      const error = new ApiClientError(
        detail || response.statusText || `Request failed (${response.status})`,
        "http",
        { status: response.status, detail, body: parsed, requestId }
      );
      logFetchFailure(method, path, error);
      throw error;
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    const normalized =
      error instanceof DOMException && error.name === "AbortError"
        ? new ApiClientError("Request timed out.", "timeout")
        : new ApiClientError("API unreachable. Please try again.", "network");
    logFetchFailure(method, path, normalized);
    throw normalized;
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiFetchServer<T = unknown>(
  path: string,
  options: Omit<ApiFetchOptions, "baseUrl"> & { cookieHeader?: string } = {}
): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    baseUrl: getServerApiBaseUrl(),
  });
}
