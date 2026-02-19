"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreatorAvatar } from "@/components/ui/CreatorAvatar";
import { CreatorAvatarAsset } from "@/features/creators/components/CreatorAvatarAsset";
import { FollowButton } from "@/features/creators/components/FollowButton";
import { apiFetch } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/errors";
import "@/lib/api";
import type { CreatorItem, CreatorDiscoverPage } from "./page";

interface CreatorGridProps {
  initialItems: CreatorItem[];
  initialTotal: number;
  initialQuery: string;
  pageSize: number;
}

export function CreatorGrid({
  initialItems,
  initialTotal,
  initialQuery,
  pageSize,
}: CreatorGridProps) {
  const [items, setItems] = useState<CreatorItem[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState(initialQuery);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMore = items.length < total;
  const empty = items.length === 0 && !loading;

  const fetchPage = useCallback(
    async (pageNum: number, q: string, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<CreatorDiscoverPage>("/creators", {
          method: "GET",
          query: { page: pageNum, page_size: pageSize, q: q || undefined },
        });
        if (append) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((c) => c.creator_id));
            const newItems = data.items.filter(
              (c) => !existingIds.has(c.creator_id),
            );
            return [...prev, ...newItems];
          });
        } else {
          setItems(data.items);
        }
        setTotal(data.total);
        setPage(pageNum);
      } catch (err) {
        setError(getApiErrorMessage(err).message);
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    setQuery(q);
    fetchPage(1, q, false);
  };

  const onLoadMore = () => {
    fetchPage(page + 1, query, true);
  };

  return (
    <>
      {/* Search bar */}
      <form
        onSubmit={onSearch}
        className="rounded-2xl border border-border bg-card p-3 shadow-sm"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            name="q"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search creators..."
            className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
          />
          <Button type="submit">Search</Button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => fetchPage(page, query, false)}
          >
            Retry
          </Button>
        </Card>
      )}

      {/* Empty: no creators at all */}
      {empty && !query && (
        <div
          className="card-premium flex flex-col items-center py-12 text-center"
          role="status"
          aria-label="No creators yet"
        >
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden
          >
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <p className="font-display text-lg font-semibold text-foreground">
            No creators have published profiles yet.
          </p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            This is a new platform. Creators are signing up and building their
            profiles. Be the first to share your work!
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button size="sm" asChild>
              <Link href="/signup">Become a creator</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Empty: search yielded nothing */}
      {empty && query && (
        <div
          className="card-premium flex flex-col items-center py-12 text-center"
          role="status"
          aria-label="No results for search"
        >
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-hidden
          >
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">
            No results for &quot;{query}&quot;.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => {
              setSearchInput("");
              setQuery("");
              fetchPage(1, "", false);
            }}
          >
            Clear search
          </Button>
        </div>
      )}

      {/* Creator grid */}
      {items.length > 0 && (
        <ul
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Creator list"
        >
          {items.map((creator) => (
            <li key={creator.creator_id}>
              <Card
                variant="elevated"
                className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    href={`/creators/${creator.handle}`}
                    className="flex min-w-0 flex-1 gap-3"
                  >
                    {creator.avatar_media_id ? (
                      <CreatorAvatarAsset
                        assetId={creator.avatar_media_id}
                        displayName={creator.display_name}
                        handle={creator.handle}
                        size="md"
                        withRing
                        isOnline={creator.is_online}
                      />
                    ) : (
                      <CreatorAvatar
                        displayName={creator.display_name}
                        handle={creator.handle}
                        size="md"
                        withRing
                        isOnline={creator.is_online}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-medium text-foreground">
                        {creator.display_name || creator.handle}
                        {creator.verified && (
                          <span className="ml-1.5 inline-block shrink-0 rounded-full bg-success-bg px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wide text-success-500">
                            Verified
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        @{creator.handle}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {creator.followers_count} followers ·{" "}
                        {creator.posts_count} posts
                      </p>
                      <span className="mt-2 inline-block text-premium-small font-medium text-primary">
                        View →
                      </span>
                    </div>
                  </Link>
                  <div
                    onClick={(e) => e.preventDefault()}
                    className="shrink-0"
                  >
                    <FollowButton
                      creatorId={creator.creator_id}
                      initialFollowing={false}
                    />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Loading skeleton for "load more" */}
      {loading && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="rounded-2xl border border-border p-4">
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Load more button */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={onLoadMore}
            disabled={loading}
          >
            Load more creators
          </Button>
        </div>
      )}

      {/* End of list */}
      {items.length > 0 && !hasMore && !loading && (
        <p className="py-2 text-center text-sm text-muted-foreground">
          Showing all {total} creator{total !== 1 ? "s" : ""}.
        </p>
      )}
    </>
  );
}
