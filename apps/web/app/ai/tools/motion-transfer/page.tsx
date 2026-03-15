"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import { ImageUploadField } from "@/features/media/ImageUploadField";
import { VideoUploadField } from "@/features/media/VideoUploadField";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api/client";
import "@/lib/api";

/* ---------- Types ---------- */

type JobStatus = {
  job_id: string;
  status: "pending" | "preprocessing" | "processing" | "generating" | "postprocessing" | "ready" | "failed";
  stage: string | null;
  progress: number | null;
  result_url: string | null;
  preview_url: string | null;
  error: string | null;
  settings: Record<string, unknown> | null;
};

type UsageInfo = {
  limit: number;
  used: number;
  remaining: number;
  unlimited: boolean;
};

/* ---------- Constants ---------- */

const VALID_RESOLUTIONS = ["512", "720", "1024"] as const;
const VALID_FPS = [12, 24, 30] as const;

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  preprocessing: "Preprocessing video",
  generating: "Generating motion transfer",
  postprocessing: "Finalizing output",
  completed: "Complete",
  failed: "Failed",
  canceled: "Canceled",
};

const PROCESSING_STEPS = [
  { label: "Uploading & validating assets", durationSec: 10 },
  { label: "Extracting motion from source", durationSec: 30 },
  { label: "Loading generation model", durationSec: 60 },
  { label: "Generating character replacement (this may take several minutes)", durationSec: 300 },
  { label: "Post-processing & encoding", durationSec: 30 },
];

/* ---------- ProcessingSteps sub-component ---------- */

function ProcessingSteps({ stage, progress }: { stage: string | null; progress: number | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  let cumulative = 0;
  let activeIdx = PROCESSING_STEPS.length - 1;
  for (let i = 0; i < PROCESSING_STEPS.length; i++) {
    cumulative += PROCESSING_STEPS[i].durationSec;
    if (elapsed < cumulative) {
      activeIdx = i;
      break;
    }
  }

  return (
    <div className="w-full max-w-xs space-y-2">
      {PROCESSING_STEPS.map((step, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={i} className="flex items-center gap-2.5 text-left">
            {done ? (
              <Icon name="check_circle" className="icon-sm shrink-0 text-primary" />
            ) : active ? (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
              </div>
            ) : (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              </div>
            )}
            <span
              className={`text-xs ${
                done
                  ? "text-muted-foreground line-through"
                  : active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground/50"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-muted-foreground/60">
          Elapsed: {Math.floor(elapsed / 60)}m {elapsed % 60}s
        </p>
        {progress !== null && progress > 0 && (
          <p className="text-[10px] text-muted-foreground/60">
            {Math.round(progress * 100)}%
          </p>
        )}
      </div>
      {progress !== null && progress > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- Main component ---------- */

function MotionTransferContent() {
  const { authorized, user } = useRequireRole(["creator", "admin", "super_admin"]);
  const { addToast } = useToast();

  // Source video state
  const [sourceAssetId, setSourceAssetId] = useState<string | null>(null);

  // Target identity state (image)
  const [targetAssetId, setTargetAssetId] = useState<string | null>(null);
  const [targetPreview, setTargetPreview] = useState<string | null>(null);

  // Garment image state (optional)
  const [garmentAssetId, setGarmentAssetId] = useState<string | null>(null);
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);

  // Settings
  const [mode, setMode] = useState<"animate" | "replace">("animate");
  const [preserveBackground, setPreserveBackground] = useState(false);
  const [preserveAudio, setPreserveAudio] = useState(true);
  const [retargetPose, setRetargetPose] = useState(false);
  const [useRelightingLora, setUseRelightingLora] = useState(false);
  const [outputResolution, setOutputResolution] = useState<string>("720");
  const [outputFps, setOutputFps] = useState<number>(24);
  const [seed, setSeed] = useState<string>("");
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Usage state
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  // Load usage on mount
  useEffect(() => {
    if (!authorized) return;
    apiFetch<UsageInfo>("/ai-tools/motion-transfer/usage")
      .then(setUsage)
      .catch(() => setUsage(null))
      .finally(() => setUsageLoading(false));
  }, [authorized]);

  // Poll job status
  const pollFailCountRef = useRef(0);
  useEffect(() => {
    if (!jobId) return;
    pollFailCountRef.current = 0;
    const poll = setInterval(async () => {
      try {
        const data = await apiFetch<JobStatus>(`/ai-tools/motion-transfer/${jobId}`);
        pollFailCountRef.current = 0;
        setJobStatus(data);
        if (data.status === "ready" || data.status === "failed") {
          clearInterval(poll);
          if (data.status === "ready") {
            addToast("Motion transfer complete!", "success");
            // Refresh usage
            apiFetch<UsageInfo>("/ai-tools/motion-transfer/usage")
              .then(setUsage)
              .catch(() => {});
          } else if (data.error) {
            setError(data.error);
          }
        }
      } catch {
        pollFailCountRef.current += 1;
        if (pollFailCountRef.current >= 3) {
          clearInterval(poll);
          setError("Failed to check job status. Please refresh the page.");
        }
      }
    }, 10_000);
    return () => clearInterval(poll);
  }, [jobId, addToast]);

  // Upload handlers
  const handleSourceUpload = useCallback((assetId: string) => {
    setSourceAssetId(assetId);
    setError(null);
    setJobId(null);
    setJobStatus(null);
  }, []);

  const handleTargetUpload = useCallback((assetId: string, preview?: string | null) => {
    setTargetAssetId(assetId);
    if (preview) setTargetPreview(preview);
    setError(null);
    setJobId(null);
    setJobStatus(null);
  }, []);

  const handleGarmentUpload = useCallback((assetId: string, preview?: string | null) => {
    setGarmentAssetId(assetId);
    if (preview) setGarmentPreview(preview);
    setError(null);
  }, []);

  // Submit job
  const handleSubmit = async () => {
    if (!sourceAssetId || !targetAssetId || !consentAcknowledged) return;
    setSubmitting(true);
    setError(null);
    setJobStatus(null);
    try {
      const data = await apiFetch<{ job_id: string; status: string }>(
        "/ai-tools/motion-transfer",
        {
          method: "POST",
          body: {
            source_video_asset_id: sourceAssetId,
            target_asset_id: targetAssetId,
            mode,
            garment_asset_id: garmentAssetId || undefined,
            preserve_background: preserveBackground,
            preserve_audio: preserveAudio,
            retarget_pose: retargetPose,
            use_relighting_lora: useRelightingLora,
            output_resolution: outputResolution,
            output_fps: outputFps,
            seed: seed ? parseInt(seed, 10) : undefined,
            consent_acknowledged: consentAcknowledged,
          },
        },
      );
      setJobId(data.job_id);
      setJobStatus({
        job_id: data.job_id,
        status: "pending",
        stage: "queued",
        progress: 0,
        result_url: null,
        preview_url: null,
        error: null,
        settings: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start generation";
      if (msg.includes("monthly_quota_exceeded") || msg.includes("quota")) {
        setError("You've reached your monthly limit for Motion Transfer. Creators can use this feature 2 times per month.");
      } else if (msg.includes("rate_limit")) {
        setError("Rate limit reached. Please try again later.");
      } else if (msg.includes("consent_required")) {
        setError("You must acknowledge the consent checkbox before submitting.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Retry
  const handleRetry = async () => {
    if (!jobId) return;
    setSubmitting(true);
    setError(null);
    setJobStatus(null);
    try {
      const data = await apiFetch<{ job_id: string; status: string }>(
        `/ai-tools/motion-transfer/${jobId}/retry`,
        { method: "POST" },
      );
      setJobId(data.job_id);
      setJobStatus({
        job_id: data.job_id,
        status: "pending",
        stage: "queued",
        progress: 0,
        result_url: null,
        preview_url: null,
        error: null,
        settings: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel
  const handleCancel = async () => {
    if (!jobId) return;
    try {
      await apiFetch(`/ai-tools/motion-transfer/${jobId}/cancel`, { method: "POST" });
      setJobStatus(null);
      setJobId(null);
      addToast("Job canceled", "default");
    } catch {
      setError("Failed to cancel job");
    }
  };

  // Reset
  const handleReset = () => {
    setSourceAssetId(null);
    setTargetAssetId(null);
    setTargetPreview(null);
    setGarmentAssetId(null);
    setGarmentPreview(null);
    setJobId(null);
    setJobStatus(null);
    setError(null);
    setConsentAcknowledged(false);
  };

  if (!authorized) return null;

  const isProcessing =
    jobStatus?.status === "pending" ||
    jobStatus?.status === "processing" ||
    jobStatus?.status === "preprocessing" ||
    jobStatus?.status === "generating" ||
    jobStatus?.status === "postprocessing";
  const isReady = jobStatus?.status === "ready";
  const quotaExhausted = usage && !usage.unlimited && usage.remaining <= 0;
  const canSubmit =
    sourceAssetId &&
    targetAssetId &&
    consentAcknowledged &&
    !isProcessing &&
    !isReady &&
    !quotaExhausted;

  return (
    <Page>
      {/* Back button */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/ai">
            <Icon name="arrow_back" className="mr-1 icon-sm" />
            Back to AI Studio
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Motion Transfer / Character Replace
        </h1>
        <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
          GPU
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Transfer motion from a source video onto a target character. Upload a driving video and a target identity image to generate a new video where the target performs the same movements.
      </p>

      {/* Usage / quota section */}
      {!usageLoading && usage && !usage.unlimited && (
        <div className="mt-3 rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="data_usage" className="icon-sm text-muted-foreground" />
              <span className="text-sm text-foreground">
                {usage.remaining > 0
                  ? `${usage.remaining} of ${usage.limit} uses remaining this month`
                  : "Monthly limit reached"}
              </span>
            </div>
            {usage.remaining <= 0 && (
              <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] font-medium text-destructive">
                Limit reached
              </span>
            )}
          </div>
          {usage.remaining <= 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Creators can use Motion Transfer {usage.limit} times per month. Contact an administrator if you need expanded access.
            </p>
          )}
        </div>
      )}

      {/* Result card */}
      {isReady && jobStatus?.result_url && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <video
              src={jobStatus.result_url}
              controls
              className="max-h-[600px] w-full rounded-lg border border-border"
              poster={jobStatus.preview_url ?? undefined}
            />
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a
                  href={jobStatus.result_url}
                  download="motion-transfer.mp4"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="download" className="mr-1.5 icon-sm" />
                  Download
                </a>
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Create another
              </Button>
            </div>
            {jobStatus.settings && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Settings used
                </summary>
                <pre className="mt-1 max-h-32 overflow-auto rounded border border-border bg-muted/50 p-2 text-[10px] text-muted-foreground">
                  {JSON.stringify(jobStatus.settings, null, 2)}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Processing state */}
      {isProcessing && (
        <Card className="mt-4">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {STAGE_LABELS[jobStatus?.stage ?? "generating"] ?? "Processing"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This may take several minutes. You can leave this page and come back.
                </p>
              </div>
              <ProcessingSteps
                stage={jobStatus?.stage ?? null}
                progress={jobStatus?.progress ?? null}
              />
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload and settings (hidden during processing / result) */}
      {!isProcessing && !isReady && (
        <>
          {/* Input section */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Source video upload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Source / Driving Video</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Upload a video with the motion you want to transfer. Keep it under 30 seconds for best results.
                </p>
                {!sourceAssetId ? (
                  <VideoUploadField
                    onUploadComplete={handleSourceUpload}
                    disabled={submitting}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Icon name="check_circle" className="icon-sm text-primary" />
                    <span className="text-sm text-foreground">Video uploaded</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSourceAssetId(null)}
                    >
                      <Icon name="close" className="mr-1 icon-xs" />
                      Change
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Target identity upload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Target Identity Image</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Upload a clear, front-facing photo of the target person. High resolution works best.
                </p>
                {!targetAssetId ? (
                  <ImageUploadField
                    onUploadComplete={handleTargetUpload}
                    disabled={submitting}
                  />
                ) : targetPreview ? (
                  <div className="space-y-2">
                    <img
                      src={targetPreview}
                      alt="Target identity"
                      className="max-h-48 rounded-lg border border-border object-contain"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTargetAssetId(null);
                        setTargetPreview(null);
                      }}
                    >
                      <Icon name="close" className="mr-1 icon-xs" />
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Icon name="check_circle" className="icon-sm text-primary" />
                    <span className="text-sm text-foreground">Image uploaded</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTargetAssetId(null)}
                    >
                      <Icon name="close" className="mr-1 icon-xs" />
                      Change
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Optional garment */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">
                Garment Reference
                <span className="ml-2 text-xs font-normal text-muted-foreground">(optional)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Optionally upload a clothing reference image. Works best with fully visible garments.
              </p>
              {!garmentAssetId ? (
                <ImageUploadField
                  onUploadComplete={handleGarmentUpload}
                  disabled={submitting}
                />
              ) : garmentPreview ? (
                <div className="space-y-2">
                  <img
                    src={garmentPreview}
                    alt="Garment reference"
                    className="max-h-36 rounded-lg border border-border object-contain"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setGarmentAssetId(null);
                      setGarmentPreview(null);
                    }}
                  >
                    <Icon name="close" className="mr-1 icon-xs" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Icon name="check_circle" className="icon-sm text-primary" />
                  <span className="text-sm text-foreground">Garment uploaded</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGarmentAssetId(null)}
                  >
                    <Icon name="close" className="mr-1 icon-xs" />
                    Remove
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode selector */}
              <div>
                <label className="text-sm font-medium text-foreground">Mode</label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("animate")}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      mode === "animate"
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="animation" className="icon-sm text-primary" />
                      <span className="text-sm font-medium text-foreground">Animation</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Animate the target character using source video motion. Best for creating character performances.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("replace")}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      mode === "replace"
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="swap_horiz" className="icon-sm text-primary" />
                      <span className="text-sm font-medium text-foreground">Replacement</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Replace the person in the video with target character. Preserves scene background.
                    </p>
                  </button>
                </div>
                {mode === "replace" && (
                  <p className="mt-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400">
                    Replacement mode works best with single-person videos. Multi-person scenes may produce artifacts.
                  </p>
                )}
              </div>

              {/* Toggles */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preserveAudio}
                    onChange={(e) => setPreserveAudio(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">Preserve audio / music from source</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preserveBackground}
                    onChange={(e) => setPreserveBackground(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">Preserve original background</span>
                </label>
                {mode === "animate" && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={retargetPose}
                      onChange={(e) => setRetargetPose(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-foreground">
                      Pose retargeting
                      <span className="ml-1 text-xs text-muted-foreground">(helps when body proportions differ)</span>
                    </span>
                  </label>
                )}
                {mode === "replace" && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={useRelightingLora}
                      onChange={(e) => setUseRelightingLora(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-foreground">
                      Relighting LoRA
                      <span className="ml-1 text-xs text-muted-foreground">(match scene lighting)</span>
                    </span>
                  </label>
                )}
              </div>

              {/* Output controls */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-foreground">Resolution</label>
                  <select
                    value={outputResolution}
                    onChange={(e) => setOutputResolution(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {VALID_RESOLUTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}p
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">FPS</label>
                  <div className="mt-1 flex gap-2">
                    {VALID_FPS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setOutputFps(f)}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          outputFps === f
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground hover:border-primary/40"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Advanced settings */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Icon
                    name={showAdvanced ? "expand_less" : "expand_more"}
                    className="icon-sm"
                  />
                  Advanced settings
                </button>
                {showAdvanced && (
                  <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        Seed
                        <span className="ml-1 text-xs font-normal text-muted-foreground">(optional, for reproducibility)</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={seed}
                        onChange={(e) => setSeed(e.target.value)}
                        placeholder="Random"
                        className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Consent + Submit */}
          <Card className="mt-4">
            <CardContent className="space-y-4 py-4">
              {/* Consent */}
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={consentAcknowledged}
                  onChange={(e) => setConsentAcknowledged(e.target.checked)}
                  className="mt-0.5 rounded border-border"
                />
                <span className="text-xs text-muted-foreground">
                  I confirm that I have consent from the person depicted in the target image, or am using my own likeness. I understand that using this tool to create non-consensual, fraudulent, or misleading content is prohibited.
                </span>
              </label>

              {/* Tips */}
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <p className="text-xs font-medium text-foreground">Tips for best results (Wan2.2-Animate):</p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  <li>- Use a clear, front-facing target character image with visible face and body</li>
                  <li>- Keep source video under 10 seconds for faster processing</li>
                  <li>- Animation mode: enable Pose Retargeting if source and target body proportions differ</li>
                  <li>- Replacement mode: works best with single-person videos only</li>
                  <li>- Higher resolution (720p/1024p) produces better quality but takes longer</li>
                  <li>- Powered by Wan2.2-Animate-14B — generation requires GPU and may take several minutes</li>
                </ul>
              </div>

              {/* Submit */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  className="btn-cta-primary"
                >
                  <Icon name="movie_creation" className="mr-1.5 icon-sm" />
                  {submitting ? "Starting..." : "Generate"}
                </Button>
                {quotaExhausted && (
                  <span className="text-xs text-destructive">Monthly limit reached</span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Max 30s source video. Processing time varies by duration and resolution.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Error with retry */}
      {error && (
        <div className="mt-3 flex items-center gap-3">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          {jobId && jobStatus?.status === "failed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={submitting}
            >
              <Icon name="refresh" className="mr-1 icon-xs" />
              Retry
            </Button>
          )}
        </div>
      )}
    </Page>
  );
}

export default function MotionTransferPage() {
  return (
    <Suspense
      fallback={
        <Page>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </Page>
      }
    >
      <MotionTransferContent />
    </Suspense>
  );
}
