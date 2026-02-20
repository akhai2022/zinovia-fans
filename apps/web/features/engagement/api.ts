import { apiFetch } from "@/lib/apiFetch";

export interface LikeSummary {
  post_id: string;
  count: number;
  viewer_liked: boolean;
}

export interface CommentOut {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface CommentPage {
  items: CommentOut[];
  next_cursor: string | null;
  total: number;
}

export interface NotificationOut {
  id: string;
  type: string;
  payload_json: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPage {
  items: NotificationOut[];
  next_cursor: string | null;
  unread_count: number;
}

export interface MediaMineItem {
  id: string;
  content_type: string;
  created_at: string;
}

export interface MediaMinePage {
  items: MediaMineItem[];
  next_cursor: string | null;
}

export async function likePost(postId: string): Promise<void> {
  await apiFetch(`/posts/${postId}/like`, { method: "POST" });
}

export async function unlikePost(postId: string): Promise<void> {
  await apiFetch(`/posts/${postId}/like`, { method: "DELETE" });
}

export async function getLikeSummary(postId: string): Promise<LikeSummary> {
  return apiFetch(`/posts/${postId}/likes`);
}

export async function listComments(postId: string, cursor?: string): Promise<CommentPage> {
  return apiFetch(`/posts/${postId}/comments`, { params: cursor ? { cursor } : undefined });
}

export async function createComment(postId: string, body: string): Promise<CommentOut> {
  return apiFetch(`/posts/${postId}/comments`, {
    method: "POST",
    body: { body },
  });
}

export async function listNotifications(cursor?: string): Promise<NotificationPage> {
  return apiFetch("/notifications", { params: cursor ? { cursor } : undefined });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiFetch(`/notifications/${notificationId}/read`, { method: "POST" });
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiFetch("/notifications/read-all", { method: "POST" });
}

export async function listVaultMedia(cursor?: string, type?: "image" | "video"): Promise<MediaMinePage> {
  const params: Record<string, string> = {};
  if (cursor) params.cursor = cursor;
  if (type) params.type = type;
  return apiFetch("/media/mine", { params });
}
