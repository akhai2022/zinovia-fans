import type { UserOut } from "@zinovia/contracts";

import { ApiClientError, apiFetch, apiFetchServer } from "@/lib/api/client";

export type SessionResult = {
  user: UserOut | null;
  unavailable: boolean;
};

export async function getSession(cookieHeader?: string): Promise<SessionResult> {
  try {
    if (typeof window === "undefined") {
      const user = await apiFetchServer<UserOut>("/auth/me", { cookieHeader, method: "GET" });
      return { user, unavailable: false };
    }
    const user = await apiFetch<UserOut>("/auth/me", { method: "GET" });
    return { user, unavailable: false };
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      return { user: null, unavailable: false };
    }
    return { user: null, unavailable: true };
  }
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}
