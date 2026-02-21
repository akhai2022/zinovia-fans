"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { listNotifications, markAllNotificationsRead, markNotificationRead, type NotificationOut } from "@/features/engagement/api";
import { Page } from "@/components/brand/Page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NOTIFICATION_META: Record<string, { icon: string; color: string }> = {
  COMMENT_ON_POST: { icon: "chat_bubble", color: "text-blue-400 bg-blue-500/10" },
  LIKE_ON_POST: { icon: "favorite", color: "text-pink-400 bg-pink-500/10" },
  NEW_FOLLOWER: { icon: "person_add", color: "text-emerald-400 bg-emerald-500/10" },
  NEW_SUBSCRIBER: { icon: "credit_card", color: "text-primary bg-primary/10" },
  POST_PUBLISHED: { icon: "send", color: "text-violet-400 bg-violet-500/10" },
  MESSAGE_RECEIVED: { icon: "chat_bubble", color: "text-sky-400 bg-sky-500/10" },
  TIP_RECEIVED: { icon: "credit_card", color: "text-amber-400 bg-amber-500/10" },
  PPV_UNLOCKED: { icon: "lock_open", color: "text-emerald-400 bg-emerald-500/10" },
  ADMIN_MESSAGE: { icon: "campaign", color: "text-amber-400 bg-amber-500/10" },
};

const DEFAULT_META = { icon: "notifications", color: "text-muted-foreground bg-muted" };

function formatNotification(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case "COMMENT_ON_POST":
      return "Someone commented on your post.";
    case "LIKE_ON_POST":
      return "Someone liked your post.";
    case "NEW_FOLLOWER":
      return "You have a new follower.";
    case "NEW_SUBSCRIBER":
      return "You have a new subscriber.";
    case "POST_PUBLISHED":
      return "Your scheduled post has been published.";
    case "MESSAGE_RECEIVED":
      return "You received a new message.";
    case "TIP_RECEIVED":
      return "You received a tip.";
    case "PPV_UNLOCKED":
      return "Your content was unlocked.";
    case "ADMIN_MESSAGE": {
      const title = payload?.title;
      const msg = payload?.message;
      if (typeof title === "string" && typeof msg === "string")
        return `${title}: ${msg}`;
      if (typeof title === "string") return title;
      if (typeof msg === "string") return msg;
      return "Message from Zinovia team.";
    }
    default: {
      const msg = payload?.message;
      if (typeof msg === "string") return msg;
      return type.replace(/_/g, " ").toLowerCase();
    }
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    const isInitial = !cursor;
    if (isInitial) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const res = await listNotifications(cursor);
      if (isInitial) {
        setItems(res.items);
      } else {
        setItems((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          return [...prev, ...res.items.filter((n) => !existingIds.has(n.id))];
        });
      }
      setNextCursor(res.next_cursor);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        router.replace("/login?next=/notifications");
        return;
      }
      setError("Unable to load notifications.");
    } finally {
      if (isInitial) setLoading(false);
      else setLoadingMore(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  };

  const markAll = async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <Page className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-premium-h2 font-semibold text-foreground">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">{unreadCount} unread</p>
          )}
        </div>
        {items.length > 0 && (
          <Button size="sm" variant="outline" onClick={markAll} className="gap-1.5">
            <Icon name="check_circle" className="icon-sm" />
            Mark all read
          </Button>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {!loading && !error && items.length === 0 && (
        <Card className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Icon name="notifications" className="icon-lg text-muted-foreground" />
          </div>
          <p className="font-display text-lg font-semibold text-foreground">No notifications yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            When someone interacts with your content, you&apos;ll see it here.
          </p>
        </Card>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const meta = NOTIFICATION_META[item.type] || DEFAULT_META;
            const isUnread = !item.read_at;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => { if (isUnread) markRead(item.id); }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  isUnread
                    ? "border-primary/20 bg-primary/5 hover:bg-primary/[0.07]"
                    : "border-border bg-card hover:bg-white/[0.02]",
                )}
              >
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", meta.color.split(" ").slice(1).join(" "))}>
                  <Icon name={meta.icon} className={cn("icon-md", meta.color.split(" ")[0])} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", isUnread ? "font-medium text-foreground" : "text-foreground/80")}>
                    {formatNotification(item.type, item.payload_json as Record<string, unknown>)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatRelativeTime(item.created_at)}
                  </p>
                </div>
                {isUnread && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {nextCursor && !loadingMore && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => load(nextCursor)}>
            Load more
          </Button>
        </div>
      )}
      {loadingMore && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" disabled>
            Loading...
          </Button>
        </div>
      )}

      <Button variant="ghost" size="sm" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </Page>
  );
}
