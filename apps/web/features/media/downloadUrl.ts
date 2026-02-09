import { OpenAPI } from "@zinovia/contracts";

export type SignedUrlResponse = { download_url?: string | null };

/**
 * Fetch signed download URL for a media asset. Optional variant (e.g. "poster" for video poster).
 * Uses same base URL and credentials as contract client.
 */
export async function getMediaDownloadUrl(
  assetId: string,
  variant?: string
): Promise<string | null> {
  const path = `/media/${encodeURIComponent(assetId)}/download-url`;
  const query = variant ? `?variant=${encodeURIComponent(variant)}` : "";
  const url = `${OpenAPI.BASE}${path}${query}`;
  const res = await fetch(url, {
    credentials: OpenAPI.WITH_CREDENTIALS ? "include" : "same-origin",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as SignedUrlResponse;
  return data.download_url ?? null;
}
