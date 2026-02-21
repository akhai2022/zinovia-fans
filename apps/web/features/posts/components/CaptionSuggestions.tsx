"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";

type CaptionData = {
  caption_short: string | null;
  caption_medium: string | null;
  caption_promo: string | null;
};

type Props = {
  mediaAssetId: string | null;
  onSelect: (caption: string) => void;
};

export function CaptionSuggestions({ mediaAssetId, onSelect }: Props) {
  const [captions, setCaptions] = useState<CaptionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCaptions = async () => {
    if (!mediaAssetId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<CaptionData>(
        `/ai-safety/media/${mediaAssetId}/captions`,
        { method: "GET" },
      );
      setCaptions(data);
    } catch {
      setError("Captions not available yet. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  if (!mediaAssetId) return null;

  return (
    <div className="space-y-2">
      {!captions && !loading && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchCaptions}
        >
          Suggest Caption
        </Button>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      )}

      {error && <p className="text-xs text-muted-foreground">{error}</p>}

      {captions && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            AI-suggested captions (click to use):
          </p>
          {[
            { label: "Short", value: captions.caption_short },
            { label: "Medium", value: captions.caption_medium },
            { label: "Promotional", value: captions.caption_promo },
          ]
            .filter((c) => c.value)
            .map((c) => (
              <button
                key={c.label}
                type="button"
                className="block w-full rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                onClick={() => onSelect(c.value!)}
              >
                <span className="mr-2 text-xs font-semibold text-muted-foreground">
                  {c.label}:
                </span>
                {c.value}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
