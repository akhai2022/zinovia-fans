"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/hooks/useSession";

type Role = "creator" | "admin" | "super_admin" | "fan";

const KYC_DONE_STATES = new Set(["KYC_APPROVED", "COMPLETED"]);

/**
 * Client-side role guard. Reads the session from the root layout's SSR call
 * (via SessionProvider context) and redirects to `redirectTo` (default `/`)
 * if the user's role does not match `requiredRole`.
 *
 * For creators, also checks that KYC is complete. If not, redirects
 * to `/onboarding` so they can finish identity verification.
 *
 * Returns `{ user, authorized }` so pages can render conditionally.
 */
export function useRequireRole(
  requiredRole: Role | Role[],
  redirectTo = "/",
) {
  const router = useRouter();
  const { user } = useSession();

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const hasRole = !!user && roles.includes(user.role as Role);

  // Creators must complete KYC; admins bypass
  const needsKyc =
    hasRole &&
    user?.role === "creator" &&
    !KYC_DONE_STATES.has(user.onboarding_state ?? "");

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
    if (needsKyc) {
      router.replace("/onboarding");
    }
  }, [user, hasRole, needsKyc, router, redirectTo]);

  return {
    user: hasRole && !needsKyc ? user : null,
    isLoading: false,
    authorized: hasRole && !needsKyc,
  };
}
