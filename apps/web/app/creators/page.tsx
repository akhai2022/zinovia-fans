"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CreatorsService, type CreatorDiscoverPage } from "@/features/creators/api";
import { getApiErrorMessage } from "@/lib/errors";
import { getApiBaseUrl } from "@/lib/apiBase";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CreatorAvatar } from "@/components/ui/CreatorAvatar";
import { CreatorAvatarAsset } from "@/features/creators/components/CreatorAvatarAsset";
import { FollowButton } from "@/features/creators/components/FollowButton";
import "@/lib/api";

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timeoutRef.current = setTimeout(() => setDebounced(value), delayMs);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, delayMs]);
  return debounced;
}

function CreatorsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading creators">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card variant="elevated" className="p-4" key={i}>
          <div className="flex gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="mt-3 h-3 w-20" />
        </Card>
      ))}
    </div>
  );
}

export default function CreatorsPage() {
  const [data, setData] = useState<CreatorDiscoverPage | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [apiError, setApiError] = useState<ReturnType<typeof getApiErrorMessage> | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const debouncedQ = useDebouncedValue(searchInput.trim() || undefined, SEARCH_DEBOUNCE_MS);

  const fetchCreators = useCallback((q: string | undefined) => {
    setStatus("loading");
    setApiError(null);
    CreatorsService.creatorsList(1, PAGE_SIZE, q ?? undefined)
      .then((res) => {
        setData(res);
        setStatus("ok");
      })
      .catch((err: unknown) => {
        setApiError(getApiErrorMessage(err));
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    fetchCreators(debouncedQ);
  }, [debouncedQ, fetchCreators]);

  const searchBar = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Input
          type="search"
          placeholder="Search creators…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pr-9"
          aria-label="Search creators"
        />
        {searchInput && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3"
            onClick={() => setSearchInput("")}
            aria-label="Clear search"
          >
            ×
          </Button>
        )}
      </div>
    </div>
  );

  if (status === "loading") {
    return (
      <Page className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Creators
        </h1>
        <p className="text-sm text-muted-foreground">
          Discover and follow creators.
        </p>
        {searchBar}
        <CreatorsSkeleton />
      </Page>
    );
  }

  if (status === "error" && apiError) {
    const isUnauthorized = apiError.kind === "unauthorized";
    return (
      <Page className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Creators
        </h1>
        <p className="text-sm text-muted-foreground">
          Discover and follow creators.
        </p>
        {searchBar}
        <div
          className="card-premium rounded-premium-lg flex flex-col items-center justify-center py-12 text-center"
          role="alert"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive" aria-hidden>
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">
            {isUnauthorized ? "Sign in to see creators." : "Something went wrong."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {!isUnauthorized && apiError.message}
          </p>
          {isUnauthorized ? (
            <Button variant="default" size="sm" className="mt-4 rounded-premium-sm btn-primary" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-premium-sm btn-secondary"
              onClick={() => fetchCreators(debouncedQ)}
            >
              Retry
            </Button>
          )}
        </div>
        <Button variant="ghost" size="sm" asChild>
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
  const hasSearch = Boolean(debouncedQ);

  return (
    <Page className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Creators
      </h1>
      <p className="text-sm text-muted-foreground">
        Discover and follow creators.
      </p>

      {searchBar}

      {empty && !hasSearch && (
        <div
          className="card-premium rounded-premium-lg flex flex-col items-center py-12 text-center"
          role="status"
          aria-label="No creators yet"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.239-4.239 9.094 9.094 0 01.479-3.741M12 15v3m0 3v-3m0 0h-3m3 0h3" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">No discoverable creators yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Check back later or explore from home.</p>
          <Button variant="outline" size="sm" className="mt-4 btn-secondary" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      )}

      {empty && hasSearch && (
        <div
          className="card-premium rounded-premium-lg flex flex-col items-center py-12 text-center"
          role="status"
          aria-label="No results for search"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">No results for &quot;{debouncedQ}&quot;.</p>
          <Button variant="outline" size="sm" className="mt-4 btn-secondary" onClick={() => setSearchInput("")}>
            Clear search
          </Button>
        </div>
      )}

      {!empty && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Creator list">
          {items.map((creator) => (
            <li key={creator.creator_id}>
              <Card
                variant="elevated"
                className="card-premium p-4 transition-all duration-fast hover:shadow-strong"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link href={`/creators/${creator.handle}`} className="flex min-w-0 flex-1 gap-3">
                    {creator.avatar_media_id ? (
                      <CreatorAvatarAsset
                        assetId={creator.avatar_media_id}
                        displayName={creator.display_name}
                        handle={creator.handle}
                        size="md"
                        withRing
                      />
                    ) : (
                      <CreatorAvatar
                        displayName={creator.display_name}
                        handle={creator.handle}
                        size="md"
                        withRing
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-medium text-foreground">
                        {creator.display_name || creator.handle}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        @{creator.handle}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {creator.followers_count} followers · {creator.posts_count} posts
                      </p>
                      <span className="mt-2 inline-block text-premium-small font-medium text-primary">
                        View →
                      </span>
                    </div>
                  </Link>
                  <div onClick={(e) => e.preventDefault()} className="shrink-0">
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

      <Button variant="ghost" size="sm" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </Page>
  );
}
