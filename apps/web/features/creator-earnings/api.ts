/** Creator earnings API - uses apiFetch until contracts regenerated. */

import { apiFetch } from "@/lib/apiFetch";

export interface EarningsSummary {
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  currency: string;
}

export interface LedgerEventOut {
  id: string;
  type: string;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  currency: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface PayoutMethodStatus {
  stripe_account_id: string | null;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  requirements_due: Record<string, unknown> | null;
  configured: boolean;
}

export interface CreatorEarningsOut {
  summary: EarningsSummary;
  last_transactions: LedgerEventOut[];
  payout_method: PayoutMethodStatus;
}

export async function getCreatorEarnings(
  params?: { days?: number; limit?: number }
): Promise<CreatorEarningsOut> {
  return apiFetch("/creator/earnings", { params });
}
