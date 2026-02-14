/** Messaging API (DMs) - uses apiFetch until contracts regenerated. */

import { apiFetch } from "@/lib/apiFetch";

export interface ConversationCreate {
  creator_handle?: string;
  creator_id?: string;
  fan_id?: string;
}

export interface ConversationOut {
  id: string;
  creator_user_id: string;
  fan_user_id: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  other_party: {
    handle: string;
    display_name: string;
    avatar_asset_id: string | null;
  };
}

export interface ConversationListOut {
  items: ConversationOut[];
}

export interface MessageMediaOut {
  id: string;
  media_asset_id: string;
  is_locked: boolean;
  price_cents: number | null;
  currency: string;
  unlocked: boolean;
  viewer_has_unlocked?: boolean;
}

export interface MessageOut {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "CREATOR" | "FAN";
  message_type: "TEXT" | "MEDIA" | "SYSTEM";
  text: string | null;
  media: MessageMediaOut[];
  created_at: string;
}

export interface MessagePageOut {
  items: MessageOut[];
  next_cursor: string | null;
}

export interface MessageCreate {
  type: "TEXT";
  text: string;
}

export interface MessageCreateMedia {
  type: "MEDIA";
  media_ids: string[];
  lock?: { price_cents: number; currency: string };
}

export type MessageCreateBody = MessageCreate | MessageCreateMedia;

export async function createConversation(
  body: ConversationCreate
): Promise<{ conversation_id: string }> {
  return apiFetch("/dm/conversations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listConversations(): Promise<ConversationListOut> {
  return apiFetch("/dm/conversations");
}

export async function getMessages(
  conversationId: string,
  cursor?: string
): Promise<MessagePageOut> {
  return apiFetch(`/dm/conversations/${conversationId}/messages`, {
    params: cursor ? { cursor } : undefined,
  });
}

export async function sendMessage(
  conversationId: string,
  body: MessageCreateBody
): Promise<MessageOut> {
  return apiFetch(`/dm/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getMediaDownloadUrl(
  messageMediaId: string
): Promise<{ download_url: string }> {
  return apiFetch(`/dm/message-media/${messageMediaId}/download-url`);
}
