/** Payments API (tips, PPV) - uses apiFetch until contracts regenerated. */

import { apiFetch } from "@/lib/apiFetch";

export interface TipCreateIntent {
  creator_id: string;
  amount_cents: number;
  currency?: string;
  conversation_id?: string;
  message_id?: string;
}

export interface TipIntentOut {
  client_secret: string;
  tip_id: string;
}

export interface PpvCreateIntent {
  message_media_id: string;
}

export interface PpvIntentOut {
  client_secret: string;
  purchase_id: string;
}

export async function createTipIntent(
  body: TipCreateIntent
): Promise<TipIntentOut> {
  return apiFetch("/payments/tips/create-intent", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createPpvIntent(
  body: PpvCreateIntent
): Promise<PpvIntentOut> {
  return apiFetch("/payments/ppv/create-intent", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
