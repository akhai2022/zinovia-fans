"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api/client";
import { featureFlags } from "@/lib/featureFlags";
import { useTranslation } from "@/lib/i18n";
import { Icon } from "@/components/ui/icon";

type Tone = "professional" | "playful" | "teasing";

type PromoData = {
  id: string;
  tone: string;
  title: string;
  description: string;
  cta_lines: string[];
  hashtags: string[];
};

type Props = {
  postId: string | null;
  onInsertCaption?: (text: string) => void;
};

const TONES: { value: Tone; labelKey: "toneProfessional" | "tonePlayful" | "toneTeasing" }[] = [
  { value: "professional", labelKey: "toneProfessional" },
  { value: "playful", labelKey: "tonePlayful" },
  { value: "teasing", labelKey: "toneTeasing" },
];

export function PromoSuggestions({ postId, onInsertCaption }: Props) {
  const [tone, setTone] = useState<Tone>("professional");
  const [promo, setPromo] = useState<PromoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();
  const { t } = useTranslation();

  if (!featureFlags.promoGenerator) return null;

  const generate = async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PromoData>("/ai-tools/promo/generate", {
        method: "POST",
        body: { post_id: postId, tone },
      });
      setPromo(data);
    } catch {
      setError(t.promo.errorGenerate);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast(t.promo.toastCopiedToClipboard, "success");
    });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Icon name="auto_awesome" className="icon-base text-primary" />
          <span className="text-sm font-medium text-foreground">{t.promo.title}</span>
        </div>

        {/* Tone selector */}
        <div className="flex gap-1.5">
          {TONES.map((toneItem) => (
            <button
              key={toneItem.value}
              type="button"
              onClick={() => {
                setTone(toneItem.value);
                setPromo(null);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                tone === toneItem.value
                  ? "bg-primary text-white"
                  : "bg-surface-alt text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.promo[toneItem.labelKey]}
            </button>
          ))}
        </div>

        {/* Generate button */}
        {!promo && !loading && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generate}
            disabled={!postId}
          >
            <Icon name="auto_awesome" className="mr-1.5 icon-sm" />
            {t.promo.generateButton}
          </Button>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        )}

        {error && <p className="text-xs text-muted-foreground">{error}</p>}

        {/* Results */}
        {promo && (
          <div className="space-y-3">
            {/* Title */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                {t.promo.sectionTitle}
              </span>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground flex-1">{promo.title}</p>
                <button
                  type="button"
                  onClick={() => copyToClipboard(promo.title)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <Icon name="content_copy" className="icon-sm" />
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                {t.promo.sectionDescription}
              </span>
              <div className="flex items-start gap-2">
                <p className="text-sm text-muted-foreground flex-1 leading-relaxed">
                  {promo.description}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (onInsertCaption) onInsertCaption(promo.description);
                    else copyToClipboard(promo.description);
                  }}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                  title={onInsertCaption ? t.promo.insertAsCaption : t.promo.copy}
                >
                  <Icon name="content_copy" className="icon-sm" />
                </button>
              </div>
            </div>

            {/* CTAs */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                {t.promo.sectionCta}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {promo.cta_lines.map((cta) => (
                  <button
                    key={cta}
                    type="button"
                    onClick={() => copyToClipboard(cta)}
                    className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted/50"
                  >
                    {cta}
                  </button>
                ))}
              </div>
            </div>

            {/* Hashtags */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                {t.promo.sectionHashtags}
              </span>
              <div className="flex flex-wrap gap-1">
                {promo.hashtags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => copyToClipboard(tag)}
                    className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(promo.hashtags.join(" "))}
                className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Icon name="tag" className="icon-xs" />
                {t.promo.copyAllHashtags}
              </button>
            </div>

            {/* Regenerate */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={generate}
              className="mt-1"
            >
              <Icon name="auto_awesome" className="mr-1 icon-xs" />
              {t.promo.regenerateButton}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
