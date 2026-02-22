"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { FeedCard } from "@/features/posts/components/FeedCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/errors";
import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/lib/i18n";
import "@/lib/api";
import type { FeedItem, FeedPageData } from "./page";

interface FeedContentProps {
  initialData: FeedPageData | null;
  initialError: string | null;
}

export function FeedContent({ initialData, initialError }: FeedContentProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<FeedItem[]>(initialData?.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialData?.next_cursor ?? null,
  );
  const [error, setError] = useState<string | null>(initialError);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const data = await apiFetch<FeedPageData>("/feed", {
        method: "GET",
        query: { page_size: 20, cursor: nextCursor },
      });
      setItems((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = data.items.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newItems];
      });
      setNextCursor(data.next_cursor);
    } catch (err) {
      setError(getApiErrorMessage(err).message);
    } finally {
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [nextCursor]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, loadMore]);

  const empty = items.length === 0 && !error;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          {t.feed.feedTitle}
        </h1>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/creators"><Icon name="explore" className="mr-1.5 icon-sm" />{t.feed.discoverCreatorsButton}</Link>
        </Button>
      </div>

      {/* Error state */}
      {error && items.length === 0 && (
        <Card
          className="rounded-2xl border border-border py-10 text-center"
          role="alert"
        >
          <p className="font-display text-premium-h3 font-semibold text-foreground">
            {t.feed.errorTitle}
          </p>
          <p className="mt-2 text-premium-body text-muted-foreground">
            {error}
          </p>
          <Button variant="secondary" size="sm" className="mt-6" asChild>
            <Link href="/feed"><Icon name="refresh" className="mr-1.5 icon-sm" />{t.feed.retryButton}</Link>
          </Button>
        </Card>
      )}

      {/* Empty state */}
      {empty && (
        <Card
          className="py-16 text-center"
          role="status"
          aria-label={t.feed.noPostsAriaLabel}
        >
          <p className="font-display text-premium-h3 font-semibold text-foreground">
            {t.feed.emptyTitle}
          </p>
          <p className="mt-2 text-premium-body text-muted-foreground">
            {t.feed.emptyDescription}
          </p>
          <Button size="sm" className="mt-6" asChild>
            <Link href="/creators"><Icon name="explore" className="mr-1.5 icon-sm" />{t.feed.emptyDiscoverCreators}</Link>
          </Button>
        </Card>
      )}

      {/* Feed list */}
      {items.length > 0 && (
        <ul className="space-y-4" aria-label={t.feed.feedTitle}>
          {items.map((post) => (
            <li key={post.id}>
              <FeedCard
                post={post}
                locked={post.is_locked}
                creator={post.creator}
                onUnlockClick={undefined}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Loading more skeleton */}
      {loadingMore && (
        <div className="space-y-4" aria-label={t.feed.loadingMoreAriaLabel}>
          {[1, 2].map((i) => (
            <Card key={i} className="overflow-hidden rounded-premium-lg p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="mt-3 h-40 w-full rounded-lg" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </Card>
          ))}
        </div>
      )}

      {/* Inline error during pagination */}
      {error && items.length > 0 && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => {
              setError(null);
              loadMore();
            }}
          >
            <Icon name="refresh" className="mr-1.5 icon-sm" />{t.feed.retryButton}
          </Button>
        </div>
      )}

      {/* Intersection observer sentinel for infinite scroll */}
      {nextCursor && !loadingMore && (
        <div ref={sentinelRef} className="h-1" aria-hidden />
      )}

      {/* End of feed indicator */}
      {items.length > 0 && !nextCursor && !loadingMore && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t.feed.allCaughtUp}
        </p>
      )}
    </>
  );
}
