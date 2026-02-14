"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listConversations, type ConversationOut } from "@/features/messaging/api";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/errors";
import "@/lib/api";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString();
}

export default function MessagesInboxPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationOut[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    listConversations()
      .then((res) => {
        setConversations(res.items);
        setStatus("ok");
      })
      .catch((err) => {
        const { kind } = getApiErrorMessage(err);
        if (kind === "unauthorized") {
          router.replace("/login?redirect=/messages");
          return;
        }
        setErrorMessage("Failed to load conversations.");
        setStatus("error");
      });
  }, [router]);

  if (status === "loading") {
    return (
      <Page>
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">Messages</h1>
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-brand" />
          ))}
        </div>
      </Page>
    );
  }

  if (status === "error") {
    return (
      <Page>
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">Messages</h1>
        <p className="mt-4 text-destructive">{errorMessage}</p>
        <Button variant="secondary" size="sm" className="mt-4" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </Page>
    );
  }

  return (
    <Page>
      <h1 className="font-display text-premium-h2 font-semibold text-foreground">Messages</h1>
      {conversations.length === 0 ? (
        <Card className="mt-8 py-12 text-center">
          <p className="text-muted-foreground">
            No messages yet. Start a conversation from a creator&apos;s profile.
          </p>
          <Button variant="secondary" size="sm" className="mt-4" asChild>
            <Link href="/creators">Browse creators</Link>
          </Button>
        </Card>
      ) : (
        <ul className="mt-4 space-y-2" role="list">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 rounded-brand border border-border bg-card p-3 shadow-premium-sm transition-colors hover:bg-surface-alt"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="text-sm">
                    {c.other_party.display_name?.slice(0, 2).toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {c.other_party.display_name || c.other_party.handle || "User"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.last_message_preview || "No messages yet"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(c.last_message_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" size="sm" className="mt-4" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </Page>
  );
}
