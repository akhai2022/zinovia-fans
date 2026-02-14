/**
 * SWR-based hooks for client-side data fetching with automatic caching,
 * revalidation, and deduplication.
 *
 * Usage:
 *   const { data, error, isLoading, mutate } = useApiFetch<MyType>("/my-endpoint");
 *   const { data, error } = useApiFetch<MyType>("/my-endpoint", { query: { page: 1 } });
 */
import useSWR, { type SWRConfiguration, type SWRResponse } from "swr";
import useSWRInfinite, { type SWRInfiniteConfiguration } from "swr/infinite";
import { apiFetch } from "@/lib/api/client";

type QueryParams = Record<string, string | number | boolean | null | undefined>;

/**
 * Build a cache key from path + query params.
 * Returns null to disable fetching when path is null/undefined.
 */
function buildKey(path: string | null | undefined, query?: QueryParams): string | null {
  if (!path) return null;
  if (!query || Object.keys(query).length === 0) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v != null) params.set(k, String(v));
  }
  return `${path}?${params.toString()}`;
}

/** SWR fetcher that uses our `apiFetch` wrapper. */
async function fetcher<T>(key: string): Promise<T> {
  const [path, queryString] = key.split("?", 2);
  const query: QueryParams = {};
  if (queryString) {
    const params = new URLSearchParams(queryString);
    params.forEach((v, k) => {
      query[k] = v;
    });
  }
  return apiFetch<T>(path, { method: "GET", query });
}

/**
 * SWR hook for single API requests with caching.
 * Pass `null` as path to conditionally disable fetching.
 */
export function useApiFetch<T>(
  path: string | null | undefined,
  options?: { query?: QueryParams; config?: SWRConfiguration<T> },
): SWRResponse<T> {
  const key = buildKey(path, options?.query);
  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    ...options?.config,
  });
}

/**
 * SWR Infinite hook for cursor-based pagination / infinite scroll.
 *
 * @param basePath  - API path (e.g. "/feed")
 * @param getNextCursor - Extract next cursor from the last page of data
 * @param options - Query params and SWR config
 */
export function useApiInfinite<T>(
  basePath: string | null,
  getNextCursor: (lastPage: T) => string | null | undefined,
  options?: {
    query?: QueryParams;
    config?: SWRInfiniteConfiguration<T>;
    pageSize?: number;
  },
) {
  const pageSize = options?.pageSize ?? 20;

  const getKey = (pageIndex: number, previousPageData: T | null) => {
    if (!basePath) return null;
    if (pageIndex > 0 && previousPageData) {
      const cursor = getNextCursor(previousPageData);
      if (!cursor) return null; // No more pages
      return buildKey(basePath, { ...options?.query, cursor, page_size: pageSize });
    }
    return buildKey(basePath, { ...options?.query, page_size: pageSize });
  };

  return useSWRInfinite<T>(getKey, fetcher, {
    revalidateOnFocus: false,
    revalidateFirstPage: false,
    ...options?.config,
  });
}
