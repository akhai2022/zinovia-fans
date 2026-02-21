"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";

type SearchResult = {
  media_asset_id: string;
  tags: string[] | null;
  score: number | null;
};

type SearchResponse = {
  items: SearchResult[];
  mode: string;
  total: number;
};

type Props = {
  onSelect?: (mediaAssetId: string) => void;
};

export function SemanticSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [mode, setMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setMode(null);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<SearchResponse>(
        `/ai-safety/search?q=${encodeURIComponent(q)}&limit=20`,
        { method: "GET" },
      );
      setResults(data.items);
      setMode(data.mode);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  return (
    <div className="space-y-3">
      <div>
        <Input
          placeholder="Search your media by description..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {mode && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Search mode: {mode === "vector" ? "Semantic (AI)" : "Keyword"}
          </p>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-md" />
          ))}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {results.map((r) => (
            <button
              key={r.media_asset_id}
              type="button"
              className="group relative aspect-square overflow-hidden rounded-md border border-border transition-colors hover:border-primary"
              onClick={() => onSelect?.(r.media_asset_id)}
            >
              <div className="flex h-full flex-col items-center justify-center bg-muted/30 p-2 text-center">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {r.media_asset_id.slice(0, 8)}
                </span>
                {r.score != null && (
                  <span className="mt-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {(r.score * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              {r.tags && r.tags.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                  <p className="truncate text-[9px] text-white">
                    {r.tags.slice(0, 3).join(", ")}
                  </p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No results found
        </p>
      )}
    </div>
  );
}
