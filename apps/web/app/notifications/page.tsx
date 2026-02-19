"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listNotifications, markAllNotificationsRead, markNotificationRead, type NotificationOut } from "@/features/engagement/api";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";

/** Turn a notification type + payload into a human-readable sentence. */
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
    default: {
      const msg = payload?.message;
      if (typeof msg === "string") return msg;
      return type.replace(/_/g, " ").toLowerCase();
    }
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listNotifications();
      setItems(res.items);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        router.replace("/login?next=/notifications");
        return;
      }
      setError("Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  };

  const markAll = async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  return (
    <Page>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <Button size="sm" variant="outline" onClick={markAll}>Mark all read</Button>
      </div>
      {loading && <p className="mt-4 text-muted-foreground">Loading…</p>}
      {error && <p className="mt-4 text-destructive">{error}</p>}
      {!loading && !error && (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-brand border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm">
                  {formatNotification(item.type, item.payload_json as Record<string, unknown>)}
                </p>
                {!item.read_at && (
                  <Button size="sm" variant="ghost" onClick={() => markRead(item.id)}>
                    Read
                  </Button>
                )}
              </div>
            </li>
          ))}
          {items.length === 0 && <p className="text-muted-foreground">No notifications yet.</p>}
        </ul>
      )}
      <Button variant="ghost" size="sm" className="mt-4" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </Page>
  );
}

