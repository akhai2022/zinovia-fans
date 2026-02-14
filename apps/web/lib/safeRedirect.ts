/**
 * Validate a redirect target to prevent open-redirect attacks.
 *
 * Rules:
 * - Must start with `/`
 * - Must NOT start with `//` (protocol-relative URL)
 * - Must not contain `\` (backslash bypass)
 * - Falls back to `fallback` for any invalid value
 */
export function safeRedirect(
  url: string | null | undefined,
  fallback = "/feed",
): string {
  if (!url || typeof url !== "string") return fallback;
  const trimmed = url.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\")
  ) {
    return fallback;
  }
  return trimmed;
}
