"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FeedService, type FeedPage } from "@/features/posts/api";
import { FeedCard } from "@/features/posts/components/FeedCard";
import { getApiErrorMessage } from "@/lib/errors";
import { getApiBaseUrl } from "@/lib/apiBase";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import "@/lib/api";

/** Simple SVG placeholder for empty feed (no external image). */
function EmptyFeedIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="16" y="24" width="64" height="48" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M16 40h64" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="56" r="4" fill="currentColor" opacity="0.5" />
      <path d="M44 52h36" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading feed">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-premium-lg border border-border bg-card p-4 shadow-premium-sm"
        >
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="mt-4 h-20 w-full rounded-premium-sm" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

type FeedError = "unauthorized" | "error";

export default function FeedPage() {
  const router = useRouter();
  const [data, setData] = useState<FeedPage | null>(null);
  const [status, setStatus] = useState<"loading" | "ok">("loading");
  const [feedError, setFeedError] = useState<FeedError | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const loadFeed = useCallback(() => {
    setStatus("loading");
    setFeedError(null);
    setErrorDetail(null);
    FeedService.feedList(1, 20)
      .then((res) => {
        setData(res);
        setStatus("ok");
      })
      .catch((err: unknown) => {
        const parsed = getApiErrorMessage(err);
        if (parsed.kind === "unauthorized") {
          setFeedError("unauthorized");
        } else {
          setFeedError("error");
          setErrorDetail(parsed.message);
        }
        setStatus("ok");
      });
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  if (status === "loading") {
    return (
      <Page>
        <h1 className="text-premium-h2 font-semibold tracking-tight text-foreground">
          Feed
        </h1>
        <div className="mt-6">
          <FeedSkeleton />
        </div>
      </Page>
    );
  }

  if (feedError === "unauthorized") {
    return (
      <Page>
        <div
          className="rounded-premium-lg border border-border bg-surface-2/50 py-12 text-center shadow-soft"
          role="status"
          aria-label="Sign in to view feed"
        >
          <p className="text-premium-body text-muted-foreground">
            Sign in to see your feed.
          </p>
          <Button variant="brand" size="sm" className="mt-4 rounded-premium-sm" asChild>
            <Link href="/login">Log in</Link>
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="mt-4 rounded-premium-sm" asChild>
          <Link href="/">Back to home</Link>
        </Button>
        {process.env.NODE_ENV === "development" && (
          <p className="mt-4 text-xs text-muted-foreground">
            API base URL: {getApiBaseUrl()}
          </p>
        )}
      </Page>
    );
  }

  if (feedError === "error") {
    return (
      <Page>
        <div
          className="rounded-premium-lg border border-border bg-surface-2/50 py-10 text-center shadow-soft"
          role="alert"
        >
          <p className="font-display text-premium-h3 font-semibold text-foreground">
            Something went wrong
          </p>
          <p className="mt-2 text-premium-body text-destructive">
            Failed to load feed.
          </p>
          {errorDetail && (
            <p className="mt-2 text-sm text-muted-foreground">{errorDetail}</p>
          )}
          <Button variant="outline" size="sm" className="mt-6 rounded-premium-sm" onClick={loadFeed}>
            Retry
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="mt-4 rounded-premium-sm" asChild>
          <Link href="/">Back to home</Link>
        </Button>
        {process.env.NODE_ENV === "development" && (
          <p className="mt-4 text-xs text-muted-foreground">
            API base URL: {getApiBaseUrl()}
          </p>
        )}
      </Page>
    );
  }

  const items = data?.items ?? [];
  const empty = items.length === 0;

  return (
    <Page className="space-y-6">
      <h1 className="text-premium-h2 font-semibold tracking-tight text-foreground">
        Feed
      </h1>

      {empty && (
        <div
          className="rounded-premium-lg border border-border bg-surface-2/50 py-16 text-center shadow-soft"
          role="status"
          aria-label="No posts yet"
        >
          <EmptyFeedIllustration className="mx-auto h-24 w-24 text-muted-foreground/50" />
          <p className="mt-4 font-display text-premium-h3 font-semibold text-foreground">
            Your feed is empty
          </p>
          <p className="mt-2 text-premium-body text-muted-foreground">
            Follow or subscribe to creators to see their posts here.
          </p>
          <Button variant="brand" size="sm" className="mt-6 rounded-premium-sm" asChild>
            <Link href="/creators">Discover creators</Link>
          </Button>
        </div>
      )}

      {!empty && (
        <ul className="space-y-4" aria-label="Feed">
          {items.map((post) => (
            <li key={post.id}>
              <FeedCard
                post={post}
                locked={post.visibility === "SUBSCRIBERS"}
                creator={post.creator}
                onUnlockClick={
                  post.visibility === "SUBSCRIBERS" && post.creator
                    ? () => router.push(`/creators/${post.creator!.handle}`)
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}

      <Button variant="ghost" size="sm" className="rounded-premium-sm" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </Page>
  );
}
