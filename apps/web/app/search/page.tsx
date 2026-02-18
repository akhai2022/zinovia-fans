"use client";

import { useState } from "react";
import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FeedCard } from "@/features/posts/components/FeedCard";
import { apiFetch } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/errors";
import "@/lib/api";

type SearchCreator = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_asset_id?: string | null;
  verified?: boolean;
};

type SearchResult = {
  id: string;
  creator_user_id: string;
  type: string;
  caption: string | null;
  visibility: string;
  nsfw: boolean;
  created_at: string;
  updated_at: string;
  asset_ids: string[];
  creator?: SearchCreator | null;
};

type SearchPage = {
  items: SearchResult[];
  total: number;
  page: number;
  page_size: number;
};

export default function SearchPostsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const pageSize = 20;

  const doSearch = async (searchQuery: string, pageNum: number, append = false) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<SearchPage>("/posts/search", {
        method: "GET",
        query: { q: searchQuery.trim(), page: pageNum, page_size: pageSize },
      });
      if (append) {
        setResults((prev) => [...prev, ...data.items]);
      } else {
        setResults(data.items);
      }
      setTotal(data.total);
      setPage(pageNum);
      setSearched(true);
    } catch (err) {
      setError(getApiErrorMessage(err).message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, 1);
  };

  const hasMore = results.length < total;

  return (
    <Page className="max-w-3xl space-y-6">
      <h1 className="font-display text-premium-h2 font-semibold text-foreground">
        Search Posts
      </h1>
      <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by caption..."
            className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
            autoFocus
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>
      </form>

      {error && (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {searched && results.length === 0 && !loading && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No posts found for &quot;{query}&quot;.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((post) => (
            <FeedCard
              key={post.id}
              post={post as any}
              creator={post.creator ? {
                handle: post.creator.handle,
                display_name: post.creator.display_name,
                user_id: post.creator.user_id,
                avatar_asset_id: post.creator.avatar_asset_id,
                verified: post.creator.verified,
              } : undefined}
            />
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => doSearch(query, page + 1, true)}
          >
            Load more
          </Button>
        </div>
      )}

      {results.length > 0 && !hasMore && !loading && (
        <p className="py-2 text-center text-sm text-muted-foreground">
          Showing all {total} result{total !== 1 ? "s" : ""}.
        </p>
      )}

      <Button variant="ghost" size="sm" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </Page>
  );
}
