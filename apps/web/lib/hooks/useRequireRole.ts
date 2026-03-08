"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/hooks/useSession";

type Role = "creator" | "admin" | "super_admin" | "reader" | "fan";

const KYC_DONE_STATES = new Set(["KYC_APPROVED", "COMPLETED"]);

/**
 * Client-side role guard. Reads the session from the root layout's SSR call
 * (via SessionProvider context) and redirects to `redirectTo` (default `/`)
 * if the user's role does not match `requiredRole`.
 *
 * For creators, KYC completion is NOT required for profile editing
 * (avatar, banner uploads) or media management. KYC is only enforced
 * when `requireKyc` option is explicitly set (e.g. for posting).
 *
 * Returns `{ user, authorized, needsKyc }` so pages can render conditionally.
 */
export function useRequireRole(
  requiredRole: Role | Role[],
  redirectTo = "/",
  options?: { requireKyc?: boolean },
) {
  const router = useRouter();
  const { user } = useSession();

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const hasRole = !!user && roles.includes(user.role as Role);

  // Check if creator needs KYC (informational, no longer blocks by default)
  const needsKyc =
    hasRole &&
    user?.role === "creator" &&
    !KYC_DONE_STATES.has(user.onboarding_state ?? "");

  // Only enforce KYC redirect when explicitly required (e.g. posting)
  const enforceKyc = !!options?.requireKyc && needsKyc;

  useEffect(() => {
    // Not authenticated — middleware should already redirect, but handle edge case
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!hasRole) {
      router.replace(redirectTo);
      return;
    }
    if (enforceKyc) {
      router.replace("/onboarding");
    }
  }, [user, hasRole, enforceKyc, router, redirectTo]);

  return {
    user: hasRole && !enforceKyc ? user : null,
    isLoading: false,
    authorized: hasRole && !enforceKyc,
    needsKyc,
  };
}
