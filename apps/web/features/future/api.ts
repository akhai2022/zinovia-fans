import { apiFetch } from "@/lib/apiFetch";

export const FutureApi = {
  promotionsSchema: () => apiFetch("/future/promotions/schema"),
  broadcastSchema: () => apiFetch("/future/broadcast/schema"),
  ppvPostsSchema: () => apiFetch("/future/ppv-posts/schema"),
  moderationSchema: () => apiFetch("/future/moderation/schema"),
  analyticsSchema: () => apiFetch("/future/analytics/schema"),
};

