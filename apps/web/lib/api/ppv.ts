import { apiFetch } from "@/lib/apiFetch";

export interface PpvIntentOut {
  purchase_id: string | null;
  client_secret: string | null;
  amount_cents: number;
  currency: string;
  status: string;
}

export interface PpvStatusOut {
  is_locked: boolean;
  viewer_has_unlocked: boolean;
  price_cents: number | null;
  currency: string | null;
}

export async function createPpvIntent(messageMediaId: string): Promise<PpvIntentOut> {
  return apiFetch(`/ppv/message-media/${messageMediaId}/create-intent`, {
    method: "POST",
  });
}

export async function getPpvStatus(messageMediaId: string): Promise<PpvStatusOut> {
  return apiFetch(`/ppv/message-media/${messageMediaId}/status`);
}

