"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { apiFetch } from "@/lib/api/client";
import { featureFlags } from "@/lib/featureFlags";

type Props = {
  mediaAssetId: string | null;
};

export function AiToolSuggestions({ mediaAssetId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!featureFlags.aiTools || !mediaAssetId) return null;

  const handleToolClick = async (tool: "remove-bg" | "cartoonize") => {
    setLoading(tool);
    setError(null);
    try {
      const { token } = await apiFetch<{ token: string; expires_at: string }>(
        "/ai-tools/image-ref",
        {
          method: "POST",
          body: { media_asset_id: mediaAssetId },
        },
      );
      router.push(`/ai/tools/${tool}?ref=${token}`);
    } catch {
      setError("Could not prepare image. Try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon name="auto_awesome" className="icon-base text-primary" />
        <span className="text-sm font-medium text-foreground">AI Tools</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleToolClick("remove-bg")}
          disabled={loading !== null}
        >
          <Icon name="content_cut" className="mr-1.5 icon-sm" />
          {loading === "remove-bg" ? "Preparing…" : "Remove Background"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
