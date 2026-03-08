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

type JobStatus = {
  job_id: string;
  status: "pending" | "processing" | "ready" | "failed";
  result_url: string | null;
  error: string | null;
};

const MOTION_PRESETS = ["gentle", "dynamic", "zoom"] as const;
const FPS_OPTIONS = [4, 7, 12] as const;

function AnimateImageContent() {
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

  // Motion settings
  const [motionPreset, setMotionPreset] = useState<string>("gentle");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [numFrames, setNumFrames] = useState(15);
  const [fps, setFps] = useState(7);
  const [outputFormat, setOutputFormat] = useState("mp4");

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
      .catch(() => {
        setError(t.animateImage.errorRefExpired);
      })
      .finally(() => setRefLoading(false));
  }, [refToken, t.animateImage.errorRefExpired]);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      try {
        const data = await apiFetch<JobStatus>(
          `/ai-tools/animate-image/${jobId}`,
        );
        setJobStatus(data);
        if (data.status === "ready" || data.status === "failed") {
          clearInterval(poll);
          if (data.status === "ready") {
            addToast(t.animateImage.toastSuccess, "success");
          } else if (data.error) {
            setError(data.error);
          }
        }
      } catch {
        clearInterval(poll);
        setError(t.animateImage.errorStatusCheck);
      }
    }, 5000);
    pollRef.current = poll;
    return () => clearInterval(poll);
  }, [jobId, addToast, t.animateImage.toastSuccess, t.animateImage.errorStatusCheck]);

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

  const handleAnimate = async () => {
    if (!mediaAssetId) return;
    setSubmitting(true);
    setError(null);
    setJobStatus(null);
    try {
      const data = await apiFetch<{ job_id: string; status: string }>(
        "/ai-tools/animate-image",
        {
          method: "POST",
          body: {
            media_asset_id: mediaAssetId,
            motion_preset: motionPreset,
            num_frames: numFrames,
            fps,
            output_format: outputFormat,
          },
        },
      );
      setJobId(data.job_id);
      setJobStatus({ job_id: data.job_id, status: "processing", result_url: null, error: null });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t.animateImage.errorStart;
      if (msg.includes("rate_limit")) {
        setError(t.animateImage.errorRateLimit);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!authorized) return null;

  const isProcessing =
    jobStatus?.status === "pending" || jobStatus?.status === "processing";
  const isReady = jobStatus?.status === "ready";

  return (
    <Page>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/ai/images">
            <Icon name="arrow_back" className="mr-1 icon-sm" />
            {t.animateImage.backToStudio}
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {t.animateImage.title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.animateImage.description}
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Left: Inputs */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t.animateImage.uploadTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {refLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-32 w-full" />
                  <p className="text-sm text-muted-foreground">
                    {t.animateImage.loadingRef}
                  </p>
                </div>
              )}

              {!refLoading && !mediaAssetId && (
                <ImageUploadField onUploadComplete={handleUploadComplete} />
              )}

              {previewUrl && !isReady && (
                <div>
                  {refToken && (
                    <p className="mb-2 text-xs text-muted-foreground">
                      {t.animateImage.imageFromUpload}
                    </p>
                  )}
                  <img
                    src={previewUrl}
                    alt="Source image"
                    className="max-h-48 rounded-lg border border-border object-contain"
                  />
                </div>
              )}

              {mediaAssetId && !isProcessing && !isReady && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMediaAssetId(null);
                    setPreviewUrl(null);
                    setError(null);
                  }}
                >
                  Replace image
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Motion preset */}
          {mediaAssetId && !isProcessing && !isReady && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t.animateImage.motionPresetLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {MOTION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMotionPreset(preset)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        motionPreset === preset
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:bg-white/5"
                      }`}
                    >
                      {preset === "gentle"
                        ? t.animateImage.presetGentle
                        : preset === "dynamic"
                          ? t.animateImage.presetDynamic
                          : t.animateImage.presetZoom}
                    </button>
                  ))}
                </div>

                {/* Advanced settings toggle */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name={showAdvanced ? "expand_less" : "expand_more"} className="icon-xs" />
                  {t.animateImage.advancedSettings}
                </button>

                {showAdvanced && (
                  <div className="space-y-3 rounded-lg border border-border bg-card/50 p-3">
                    {/* Frames slider */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        {t.animateImage.framesLabel}: {numFrames}
                      </label>
                      <input
                        type="range"
                        min={7}
                        max={25}
                        value={numFrames}
                        onChange={(e) => setNumFrames(Number(e.target.value))}
                        className="mt-1 w-full accent-primary"
                      />
                    </div>

                    {/* FPS */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        {t.animateImage.fpsLabel}
                      </label>
                      <div className="mt-1 flex gap-2">
                        {FPS_OPTIONS.map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setFps(f)}
                            className={`rounded border px-3 py-1 text-xs font-medium transition-colors ${
                              fps === f
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:bg-white/5"
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Format */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        {t.animateImage.formatLabel}
                      </label>
                      <div className="mt-1 flex gap-2">
                        {["mp4", "gif"].map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => setOutputFormat(fmt)}
                            className={`rounded border px-3 py-1 text-xs font-medium uppercase transition-colors ${
                              outputFormat === fmt
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:bg-white/5"
                            }`}
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <Button onClick={handleAnimate} disabled={submitting} className="w-full">
                  <Icon name="animation" className="mr-1.5 icon-sm" />
                  {submitting ? t.animateImage.starting : t.animateImage.animateButton}
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
                {isReady ? t.animateImage.resultTitle : t.animateImage.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Idle */}
              {!isProcessing && !isReady && !error && (
                <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
                  <div className="text-center text-muted-foreground">
                    <Icon name="animation" className="mx-auto mb-2 text-3xl" />
                    <p className="text-sm">Upload an image to animate it.</p>
                  </div>
                </div>
              )}

              {/* Processing */}
              {isProcessing && (
                <div className="flex min-h-[200px] items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <span className="text-sm text-muted-foreground">
                      {t.animateImage.processing}
                    </span>
                  </div>
                </div>
              )}

              {/* Result */}
              {isReady && jobStatus?.result_url && (
                <div className="space-y-3">
                  <div className="flex gap-4 flex-col sm:flex-row">
                    {previewUrl && (
                      <div className="flex-1">
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.animateImage.originalLabel}</p>
                        <img
                          src={previewUrl}
                          alt="Original"
                          className="max-h-48 w-full rounded-lg border border-border object-contain"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.animateImage.resultLabel}</p>
                      {outputFormat === "gif" ? (
                        <img
                          src={jobStatus.result_url}
                          alt="Animated result"
                          className="max-h-48 w-full rounded-lg border border-border object-contain"
                        />
                      ) : (
                        <video
                          src={jobStatus.result_url}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="max-h-48 w-full rounded-lg border border-border object-contain"
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild>
                      <a
                        href={jobStatus.result_url}
                        download={`animated.${outputFormat}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="download" className="mr-1.5 icon-sm" />
                        {t.animateImage.downloadButton}
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMediaAssetId(null);
                        setPreviewUrl(null);
                        setJobId(null);
                        setJobStatus(null);
                        setError(null);
                      }}
                    >
                      {t.animateImage.processAnother}
                    </Button>
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

export default function AnimateImagePage() {
  return (
    <Suspense
      fallback={
        <Page>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </Page>
      }
    >
      <AnimateImageContent />
    </Suspense>
  );
}
