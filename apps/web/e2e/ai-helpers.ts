/**
 * AI-specific test helpers for E2E tests.
 * Extends the base helpers.ts with upload, polling, and AI seeding utilities.
 */

import { apiFetch, e2eApi, API_BASE } from "./helpers";

/* --------------- media upload --------------- */

/**
 * Request a presigned upload URL and return the media asset ID.
 * Does NOT actually upload a file — just creates the DB record for the asset.
 */
export async function requestUploadUrl(
  cookies: string,
  csrfToken: string,
  opts?: { contentType?: string; sizeBytes?: number; filename?: string },
): Promise<{ assetId: string; uploadUrl: string }> {
  const res = await apiFetch("/media/upload-url", {
    method: "POST",
    body: {
      content_type: opts?.contentType ?? "image/jpeg",
      size_bytes: opts?.sizeBytes ?? 1024,
      filename: opts?.filename ?? `e2e-test-${Date.now()}.jpg`,
    },
    cookies,
    headers: { "X-CSRF-Token": csrfToken },
  });
  if (!res.ok) {
    throw new Error(
      `requestUploadUrl failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return { assetId: res.body.asset_id, uploadUrl: res.body.upload_url };
}

/* --------------- job polling --------------- */

export interface PollResult {
  status: string;
  result_url?: string;
  error?: string;
  body: any;
}

/**
 * Poll a job status endpoint until it reaches a terminal state or times out.
 */
export async function pollJobStatus(
  path: string,
  cookies: string,
  opts?: { maxAttempts?: number; intervalMs?: number },
): Promise<PollResult> {
  const maxAttempts = opts?.maxAttempts ?? 30;
  const intervalMs = opts?.intervalMs ?? 2000;

  for (let i = 0; i < maxAttempts; i++) {
    const res = await apiFetch(path, { cookies });
    if (!res.ok) {
      return {
        status: "error",
        error: `HTTP ${res.status}`,
        body: res.body,
      };
    }
    const status = res.body.status;
    if (status === "ready" || status === "READY" || status === "failed" || status === "FAILED") {
      return {
        status,
        result_url: res.body.result_url ?? res.body.download_url,
        error: res.body.error ?? res.body.error_message,
        body: res.body,
      };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: "timeout", error: "Polling timed out", body: null };
}

/* --------------- AI safety seeding --------------- */

/**
 * Seed an AI safety scan result via E2E bypass endpoint.
 * Useful for testing admin review flow without running ML pipeline.
 */
export async function seedSafetyScan(
  mediaAssetId: string,
  overrides?: {
    nsfw_score?: number;
    nsfw_label?: string;
    age_range_prediction?: string;
    underage_likelihood_proxy?: number;
    risk_level?: string;
    decision?: string;
  },
): Promise<{ scanId: string }> {
  const query: Record<string, string> = {
    media_asset_id: mediaAssetId,
  };
  if (overrides?.nsfw_score !== undefined) query.nsfw_score = String(overrides.nsfw_score);
  if (overrides?.nsfw_label) query.nsfw_label = overrides.nsfw_label;
  if (overrides?.age_range_prediction) query.age_range_prediction = overrides.age_range_prediction;
  if (overrides?.underage_likelihood_proxy !== undefined)
    query.underage_likelihood_proxy = String(overrides.underage_likelihood_proxy);
  if (overrides?.risk_level) query.risk_level = overrides.risk_level;
  if (overrides?.decision) query.decision = overrides.decision;

  const res = await e2eApi("/ai-safety/seed-scan", { query });
  if (!res.ok) {
    throw new Error(
      `seedSafetyScan failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return { scanId: res.body.scan_id };
}

/* --------------- image ref --------------- */

/**
 * Create an image-ref token for deep-linking a media asset into an AI tool page.
 */
export async function createImageRef(
  cookies: string,
  csrfToken: string,
  mediaAssetId: string,
): Promise<{ token: string; expiresAt: string }> {
  const res = await apiFetch("/ai-tools/image-ref", {
    method: "POST",
    body: { media_asset_id: mediaAssetId },
    cookies,
    headers: { "X-CSRF-Token": csrfToken },
  });
  if (!res.ok) {
    throw new Error(
      `createImageRef failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return { token: res.body.token, expiresAt: res.body.expires_at };
}

/* --------------- download & verify helpers --------------- */

/**
 * Download bytes from a URL and return a Buffer.
 * Works with presigned S3 URLs.
 */
export async function downloadBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * Compute a hex SHA-256 hash of a Buffer using Node's crypto module.
 */
export async function sha256hex(buf: Buffer): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Check if a PNG buffer has an alpha channel by inspecting the IHDR chunk.
 * PNG color types with alpha: 4 (grayscale+alpha) or 6 (RGBA).
 * Returns true if the PNG has alpha, false otherwise.
 * Returns null if the buffer doesn't look like a valid PNG.
 */
export function pngHasAlpha(buf: Buffer): boolean | null {
  // PNG signature: 8 bytes (137 80 78 71 13 10 26 10)
  if (buf.length < 26) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    return null; // Not a PNG
  }
  // IHDR chunk starts at byte 8 (4 bytes length + 4 bytes "IHDR" + data)
  // Color type is at offset 25 (8 sig + 4 len + 4 type + 4 width + 4 height + 1 bit_depth = 25)
  const colorType = buf[25];
  return colorType === 4 || colorType === 6;
}

/**
 * Get Content-Type of a URL via HEAD request.
 */
export async function getContentType(url: string): Promise<string | null> {
  const res = await fetch(url, { method: "HEAD" });
  return res.headers.get("content-type");
}

/* --------------- rate limit helpers --------------- */

/**
 * Reset rate-limit counters via E2E bypass endpoint.
 * Pass the exact Redis key or a pattern with wildcards.
 *
 * Common patterns:
 *   - `login:*:${email}` — reset login rate limit for an email
 *   - `password_reset:*:${email}` — reset forgot-password limit
 *   - `ai:tool:rmbg:${userId}` — reset remove-bg daily limit
 *   - `ai:tool:cartoon:${userId}` — reset cartoonize daily limit
 */
export async function resetRateLimit(keyPattern: string): Promise<number> {
  const res = await e2eApi("/rate-limit/reset", {
    query: { key_pattern: keyPattern },
  });
  if (!res.ok) {
    throw new Error(
      `resetRateLimit failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return res.body.deleted ?? 0;
}

/* --------------- CSRF helper --------------- */

/**
 * Extract CSRF token from a cookie string.
 * Handles URL-encoded values and multiple csrf_token occurrences.
 */
export function extractCsrf(cookies: string): string {
  return cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
}
