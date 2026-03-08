"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import { ImageUploadField } from "@/features/media/ImageUploadField";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n";
import "@/lib/api";

type CaptionResult = {
  caption: string;
  alt_text: string;
  keywords: string[];
  model: string;
  timings: { preprocess_ms: number; inference_ms: number; postprocess_ms: number };
};

type JobStatus = {
  job_id: string;
  status: "pending" | "processing" | "ready" | "failed";
  result: CaptionResult | null;
  error: string | null;
};

const MODES = ["short", "detailed", "alt_text"] as const;
const TONES = ["neutral", "playful", "flirty", "professional"] as const;

function AutoCaptionContent() {
  const { authorized } = useRequireRole(["creator", "admin", "super_admin"]);
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const { t } = useTranslation();
  const refToken = searchParams.get("ref");

  const [mediaAssetId, setMediaAssetId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refLoading, setRefLoading] = useState(!!refToken);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Settings
  const [mode, setMode] = useState<string>("short");
  const [tone, setTone] = useState<string>("neutral");
  const [language, setLanguage] = useState<string>("en");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [quality, setQuality] = useState<string>("fast");
  const [includeKeywords, setIncludeKeywords] = useState(true);

  // Editable caption
  const [editedCaption, setEditedCaption] = useState<string>("");

  // Resolve imageRef token
  useEffect(() => {
    if (!refToken) return;
    setRefLoading(true);
    apiFetch<{ media_asset_id: string; download_url: string }>(
      `/ai-tools/image-ref/${refToken}`,
    )
      .then((data) => {
        setMediaAssetId(data.media_asset_id);
        setPreviewUrl(data.download_url);
      })
      .catch(() => setError(t.autoCaption.errorStatusCheck))
      .finally(() => setRefLoading(false));
  }, [refToken, t.autoCaption.errorStatusCheck]);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      try {
        const data = await apiFetch<JobStatus>(
          `/ai-tools/auto-caption/${jobId}`,
        );
        setJobStatus(data);
        if (data.status === "ready" || data.status === "failed") {
          clearInterval(poll);
          if (data.status === "ready" && data.result) {
            setEditedCaption(data.result.caption);
            addToast(t.autoCaption.toastSuccess, "success");
          } else if (data.error) {
            setError(data.error);
          }
        }
      } catch {
        clearInterval(poll);
        setError(t.autoCaption.errorStatusCheck);
      }
    }, 3000);
    pollRef.current = poll;
    return () => clearInterval(poll);
  }, [jobId, addToast, t.autoCaption.toastSuccess, t.autoCaption.errorStatusCheck]);

  const handleUploadComplete = useCallback(
    (assetId: string, preview?: string | null) => {
      setMediaAssetId(assetId);
      if (preview) setPreviewUrl(preview);
      setError(null);
      setJobId(null);
      setJobStatus(null);
    },
    [],
  );

  const handleGenerate = async () => {
    if (!mediaAssetId) return;
    setSubmitting(true);
    setError(null);
    setJobStatus(null);
    setEditedCaption("");
    try {
      const data = await apiFetch<{ job_id: string; status: string }>(
        "/ai-tools/auto-caption",
        {
          method: "POST",
          body: {
            media_asset_id: mediaAssetId,
            mode,
            tone,
            quality,
            include_keywords: includeKeywords,
            language,
          },
        },
      );
      setJobId(data.job_id);
      setJobStatus({ job_id: data.job_id, status: "processing", result: null, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.autoCaption.errorStart;
      if (msg.includes("rate_limit")) {
        setError(t.autoCaption.errorRateLimit);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast(t.autoCaption.toastCopied, "success");
  };

  if (!authorized) return null;

  const isProcessing = jobStatus?.status === "pending" || jobStatus?.status === "processing";
  const isReady = jobStatus?.status === "ready";
  const result = jobStatus?.result;

  return (
    <Page>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/ai/images">
            <Icon name="arrow_back" className="mr-1 icon-sm" />
            {t.autoCaption.backToStudio}
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t.autoCaption.title}
        </h1>
        <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
          {t.autoCaption.cpuBadge}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.autoCaption.description}
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Left: Inputs */}
        <div className="space-y-4">
          {/* Image upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.autoCaption.uploadTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {refLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-32 w-full" />
                </div>
              )}
              {!refLoading && !mediaAssetId && (
                <ImageUploadField onUploadComplete={handleUploadComplete} />
              )}
              {previewUrl && (
                <div>
                  <img
                    src={previewUrl}
                    alt="Source"
                    className="max-h-48 rounded-lg border border-border object-contain"
                  />
                  {!isProcessing && !isReady && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setMediaAssetId(null);
                        setPreviewUrl(null);
                        setError(null);
                        setJobId(null);
                        setJobStatus(null);
                      }}
                    >
                      Replace image
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Caption mode */}
          {mediaAssetId && !isProcessing && !isReady && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.autoCaption.modeLabel}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        mode === m
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:bg-white/5"
                      }`}
                    >
                      {m === "short" ? t.autoCaption.modeShort : m === "detailed" ? t.autoCaption.modeDetailed : t.autoCaption.modeAltText}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t.autoCaption.modeShortHint}</p>

                {/* Tone */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t.autoCaption.toneLabel}</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                  >
                    {TONES.map((tn) => (
                      <option key={tn} value={tn}>
                        {tn === "neutral" ? t.autoCaption.toneNeutral : tn === "playful" ? t.autoCaption.tonePlayful : tn === "flirty" ? t.autoCaption.toneFlirty : t.autoCaption.toneProfessional}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Language */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t.autoCaption.languageLabel}</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </div>

                {/* Advanced */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name={showAdvanced ? "expand_less" : "expand_more"} className="icon-xs" />
                  {t.autoCaption.advancedSettings}
                </button>

                {showAdvanced && (
                  <div className="space-y-3 rounded-lg border border-border bg-card/50 p-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quality === "better"}
                        onChange={(e) => setQuality(e.target.checked ? "better" : "fast")}
                        className="accent-primary"
                      />
                      <div>
                        <span className="text-sm text-foreground">{t.autoCaption.betterQuality}</span>
                        <p className="text-xs text-muted-foreground">{t.autoCaption.betterQualityHint}</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeKeywords}
                        onChange={(e) => setIncludeKeywords(e.target.checked)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-foreground">{t.autoCaption.includeKeywords}</span>
                    </label>
                  </div>
                )}

                <Button onClick={handleGenerate} disabled={submitting} className="w-full">
                  <Icon name="subtitles" className="mr-1.5 icon-sm" />
                  {submitting ? t.autoCaption.generating : t.autoCaption.generateButton}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Output */}
        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">
                {isReady ? t.autoCaption.resultTitle : t.autoCaption.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Idle */}
              {!isProcessing && !isReady && !error && (
                <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
                  <div className="text-center text-muted-foreground">
                    <Icon name="subtitles" className="mx-auto mb-2 text-3xl" />
                    <p className="text-sm">{t.autoCaption.idlePlaceholder}</p>
                  </div>
                </div>
              )}

              {/* Processing */}
              {isProcessing && (
                <div className="flex min-h-[200px] items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <span className="text-sm text-muted-foreground">{t.autoCaption.processing}</span>
                  </div>
                </div>
              )}

              {/* Result */}
              {isReady && result && (
                <div className="space-y-4">
                  {/* Caption — editable */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{t.autoCaption.captionLabel}</label>
                    <textarea
                      value={editedCaption}
                      onChange={(e) => setEditedCaption(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground resize-y"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(editedCaption)}>
                        <Icon name="content_copy" className="mr-1 icon-xs" />
                        {t.autoCaption.copyButton}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          // Store caption to sessionStorage for post composer to pick up
                          sessionStorage.setItem("zinovia_draft_caption", editedCaption);
                          window.location.href = "/creator/post/new";
                        }}
                      >
                        <Icon name="edit_square" className="mr-1 icon-xs" />
                        {t.autoCaption.useInPost}
                      </Button>
                    </div>
                  </div>

                  {/* Alt-text */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-muted-foreground">{t.autoCaption.altTextLabel}</label>
                      <span className="text-[10px] text-muted-foreground/60">{t.autoCaption.altTextNote}</span>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                      {result.alt_text}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(result.alt_text)}>
                      <Icon name="content_copy" className="mr-1 icon-xs" />
                      {t.autoCaption.copyButton}
                    </Button>
                  </div>

                  {/* Keywords */}
                  {result.keywords.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">{t.autoCaption.keywordsLabel}</label>
                      <div className="flex flex-wrap gap-1.5">
                        {result.keywords.map((kw) => (
                          <span
                            key={kw}
                            className="rounded-full border border-border bg-muted/30 px-2.5 py-0.5 text-xs text-foreground"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(result.keywords.map((k) => `#${k}`).join(" "))}
                      >
                        <Icon name="tag" className="mr-1 icon-xs" />
                        {t.autoCaption.copyHashtags}
                      </Button>
                    </div>
                  )}

                  {/* Actions row */}
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button variant="outline" size="sm" onClick={handleGenerate}>
                      <Icon name="refresh" className="mr-1 icon-xs" />
                      {t.autoCaption.regenerate}
                    </Button>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {result.model} &middot; {result.timings.inference_ms}ms
                    </span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}

export default function AutoCaptionPage() {
  return (
    <Suspense
      fallback={
        <Page>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </Page>
      }
    >
      <AutoCaptionContent />
    </Suspense>
  );
}
