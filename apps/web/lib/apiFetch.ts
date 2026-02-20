/**
 * Backwards-compatible wrapper around canonical API client.
 * New code should import from "@/lib/api/client".
 */

import { apiFetch as canonicalApiFetch } from "@/lib/api/client";

export type ApiFetchOptions = {
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
} & Omit<RequestInit, "body">;

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { params, ...rest } = options;
  return canonicalApiFetch<T>(path, {
    ...rest,
    query: params,
  });
}
