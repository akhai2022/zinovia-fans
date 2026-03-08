"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/hooks/useSession";

const KYC_DONE_STATES = new Set(["KYC_APPROVED", "COMPLETED"]);

export function KycReminderBanner() {
  const { user } = useSession();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (!user) return null;
  if (user.role !== "creator") return null;
  if (KYC_DONE_STATES.has(user.onboarding_state ?? "")) return null;

  return (
    <div className="w-full border-b border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-center text-sm">
      <span className="text-amber-200">
        Complete your identity verification to unlock posting.{" "}
        <Link
          href="/onboarding"
          className="font-medium underline underline-offset-2 hover:text-amber-100"
        >
          Verify now
        </Link>
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-3 text-amber-300/60 hover:text-amber-200 text-xs"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
