"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { UserOut } from "@zinovia/contracts";
import { useApiFetch } from "@/lib/hooks/useApiFetch";

type Role = "creator" | "admin" | "fan";

const KYC_DONE_STATES = new Set(["KYC_APPROVED", "COMPLETED"]);

/**
 * Client-side role guard. Fetches the current user via `/auth/me` and
 * redirects to `redirectTo` (default `/`) if the user's role does not
 * match `requiredRole`.
 *
 * For creators, also checks that KYC is complete. If not, redirects
 * to `/onboarding` so they can finish identity verification.
 *
 * Returns `{ user, isLoading, authorized }` so pages can show a loading
 * skeleton until the check completes.
 */
export function useRequireRole(
  requiredRole: Role | Role[],
  redirectTo = "/",
) {
  const router = useRouter();
  const { data: user, error, isLoading } = useApiFetch<UserOut>("/auth/me");

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const hasRole = !!user && roles.includes(user.role as Role);

  // Creators must complete KYC; admins bypass
  const needsKyc =
    hasRole &&
    user?.role === "creator" &&
    !KYC_DONE_STATES.has(user.onboarding_state ?? "");

  useEffect(() => {
    if (isLoading) return;
    // Not authenticated — middleware should already redirect, but handle edge case
    if (!user || error) {
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
  }, [isLoading, user, error, hasRole, needsKyc, router, redirectTo]);

  return {
    user: hasRole && !needsKyc ? user : null,
    isLoading,
    authorized: hasRole && !needsKyc && !isLoading,
  };
}
