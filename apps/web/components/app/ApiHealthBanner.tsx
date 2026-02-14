"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";

type HealthResponse = { ok?: boolean; status?: string };

export function ApiHealthBanner() {
  const [offline, setOffline] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await apiFetch<HealthResponse>("/health", {
        method: "GET",
        timeoutMs: 4000,
      });
      setOffline(!(res.ok === true || res.status === "ok"));
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [check]);

  if (!offline) return null;
  return (
    <div className="w-full border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
      API is currently unreachable. Retrying automatically.
      <button
        type="button"
        onClick={check}
        className="ml-2 underline underline-offset-2"
      >
        Retry now
      </button>
    </div>
  );
}
