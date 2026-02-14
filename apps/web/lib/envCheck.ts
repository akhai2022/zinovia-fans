/**
 * Validate critical environment variables at build time / startup.
 * Import this module early (e.g., in layout.tsx) to fail fast.
 *
 * Note: NEXT_PUBLIC_* vars are inlined at build time. Missing vars will be
 * empty strings, not undefined.
 */

type EnvCheckResult = {
  valid: boolean;
  warnings: string[];
};

export function checkEnv(): EnvCheckResult {
  const warnings: string[] = [];

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!apiBaseUrl) {
    warnings.push("NEXT_PUBLIC_API_BASE_URL is not set; API calls may fail.");
  }

  if (typeof window === "undefined") {
    // Server-side only checks
    const serverApiUrl =
      process.env.API_BASE_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
    if (!serverApiUrl) {
      warnings.push("API_BASE_URL is not set for server-side rendering.");
    }
  }

  return { valid: warnings.length === 0, warnings };
}

// Run the check at module load time (server only — browser has already built-in values).
if (typeof window === "undefined") {
  const result = checkEnv();
  if (!result.valid) {
    for (const w of result.warnings) {
      console.warn(`[env-check] ${w}`);
    }
  }
}
