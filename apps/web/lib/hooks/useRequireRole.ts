"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { UserOut } from "@zinovia/contracts";
import { useApiFetch } from "@/lib/hooks/useApiFetch";

type Role = "creator" | "admin" | "fan";

/**
 * Client-side role guard. Fetches the current user via `/auth/me` and
 * redirects to `redirectTo` (default `/`) if the user's role does not
 * match `requiredRole`.
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

  useEffect(() => {
    if (isLoading) return;
    // Not authenticated — middleware should already redirect, but handle edge case
    if (!user || error) {
      router.replace("/login");
      return;
    }
    if (!hasRole) {
      router.replace(redirectTo);
    }
  }, [isLoading, user, error, hasRole, router, redirectTo]);

  return { user: hasRole ? user : null, isLoading, authorized: hasRole && !isLoading };
}
