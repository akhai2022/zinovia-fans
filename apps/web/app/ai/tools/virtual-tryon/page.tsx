"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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

const CATEGORIES = ["upper_body", "lower_body", "full_body"] as const;
type Category = (typeof CATEGORIES)[number];

const PROCESSING_STEPS = [
  { label: "Uploading images", durationSec: 5 },
  { label: "Segmenting clothing", durationSec: 30 },
  { label: "Loading try-on model", durationSec: 60 },
  { label: "Generating try-on (this takes a few minutes)", durationSec: 360 },
  { label: "Finalizing result", durationSec: 30 },
];

function ProcessingSteps() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Determine active step based on elapsed time
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
              <Icon
                name="check_circle"
                className="icon-sm shrink-0 text-primary"
              />
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
      <p className="pt-1 text-[10px] text-muted-foreground/60">
        Elapsed: {Math.floor(elapsed / 60)}m {elapsed % 60}s
      </p>
    </div>
  );
}

function VirtualTryOnContent() {
  const { authorized } = useRequireRole(["creator", "admin", "super_admin"]);
  const { t } = useTranslation();
  const tt = t.virtualTryOn;
  const { addToast } = useToast();

  // Person image state
  const [personAssetId, setPersonAssetId] = useState<string | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);

  // Garment image state
  const [garmentAssetId, setGarmentAssetId] = useState<string | null>(null);
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);

  // Settings
  const [category, setCategory] = useState<Category>("upper_body");

  // Job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll job status — longer interval since inference takes 5-10 min
  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      try {
        const data = await apiFetch<JobStatus>(
          `/ai-tools/virtual-tryon/${jobId}`,
        );
        setJobStatus(data);
        if (data.status === "ready" || data.status === "failed") {
          clearInterval(poll);
          if (data.status === "ready") {
            addToast(tt.toastSuccess, "success");
          } else if (data.error) {
            setError(data.error);
          }
        }
      } catch {
        clearInterval(poll);
        setError(tt.errorStatusCheck);
      }
    }, 10_000); // Poll every 10s for long-running jobs
    pollRef.current = poll;
    return () => clearInterval(poll);
  }, [jobId, addToast, tt.toastSuccess, tt.errorStatusCheck]);

  const handlePersonUpload = useCallback(
    (assetId: string, preview?: string | null) => {
      setPersonAssetId(assetId);
      if (preview) setPersonPreview(preview);
      setError(null);
      setJobId(null);
      setJobStatus(null);
    },
    [],
  );

  const handleGarmentUpload = useCallback(
    (assetId: string, preview?: string | null) => {
      setGarmentAssetId(assetId);
      if (preview) setGarmentPreview(preview);
      setError(null);
      setJobId(null);
      setJobStatus(null);
    },
    [],
  );

  const handleTryOn = async () => {
    if (!personAssetId || !garmentAssetId) return;
    setSubmitting(true);
    setError(null);
    setJobStatus(null);
    try {
      const data = await apiFetch<{ job_id: string; status: string }>(
        "/ai-tools/virtual-tryon",
        {
          method: "POST",
          body: {
            person_media_asset_id: personAssetId,
            garment_media_asset_id: garmentAssetId,
            category,
          },
        },
      );
      setJobId(data.job_id);
      setJobStatus({
        job_id: data.job_id,
        status: "processing",
        result_url: null,
        error: null,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : tt.errorStart;
      if (msg.includes("rate_limit")) {
        setError(tt.errorRateLimit);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setPersonAssetId(null);
    setPersonPreview(null);
    setGarmentAssetId(null);
    setGarmentPreview(null);
    setJobId(null);
    setJobStatus(null);
    setError(null);
  };

  if (!authorized) return null;

  const isProcessing =
    jobStatus?.status === "pending" || jobStatus?.status === "processing";
  const isReady = jobStatus?.status === "ready";
  const canSubmit = personAssetId && garmentAssetId && !isProcessing && !isReady;

  const categoryLabels: Record<Category, string> = {
    upper_body: tt.categoryUpperBody,
    lower_body: tt.categoryLowerBody,
    full_body: tt.categoryFullBody,
  };

  return (
    <Page>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/ai">
            <Icon name="arrow_back" className="mr-1 icon-sm" />
            {tt.backToStudio}
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {tt.title}
        </h1>
        <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
          {tt.cpuBadge}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {tt.description}
      </p>

      {/* Result card */}
      {isReady && jobStatus?.result_url && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">{tt.resultTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <img
              src={jobStatus.result_url}
              alt="Virtual try-on result"
              className="max-h-[600px] w-full rounded-lg border border-border object-contain"
            />
            <div className="flex gap-2">
              <Button asChild>
                <a
                  href={jobStatus.result_url}
                  download="virtual-tryon.jpg"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="download" className="mr-1.5 icon-sm" />
                  {tt.downloadButton}
                </a>
              </Button>
              <Button variant="outline" onClick={handleReset}>
                {tt.tryAnother}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing state with step progress */}
      {isProcessing && (
        <Card className="mt-4">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {tt.processing}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tt.processingHint}
                </p>
              </div>

              {/* Step progress indicator */}
              <ProcessingSteps />

              {/* Show thumbnails of inputs */}
              <div className="mt-2 flex gap-4">
                {personPreview && (
                  <img
                    src={personPreview}
                    alt="Person"
                    className="h-24 w-20 rounded-lg border border-border object-cover"
                  />
                )}
                <div className="flex items-center text-muted-foreground">
                  <Icon name="add" className="icon-base" />
                </div>
                {garmentPreview && (
                  <img
                    src={garmentPreview}
                    alt="Garment"
                    className="h-24 w-20 rounded-lg border border-border object-cover"
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload and settings (hidden when processing or showing result) */}
      {!isProcessing && !isReady && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Person photo upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tt.personUploadTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {tt.personUploadHint}
              </p>
              {!personAssetId ? (
                <ImageUploadField onUploadComplete={handlePersonUpload} />
              ) : personPreview ? (
                <div className="space-y-2">
                  <img
                    src={personPreview}
                    alt="Person photo"
                    className="max-h-48 rounded-lg border border-border object-contain"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPersonAssetId(null);
                      setPersonPreview(null);
                    }}
                  >
                    <Icon name="close" className="mr-1 icon-xs" />
                    Change
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Garment image upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tt.garmentUploadTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {tt.garmentUploadHint}
              </p>
              {!garmentAssetId ? (
                <ImageUploadField onUploadComplete={handleGarmentUpload} />
              ) : garmentPreview ? (
                <div className="space-y-2">
                  <img
                    src={garmentPreview}
                    alt="Garment image"
                    className="max-h-48 rounded-lg border border-border object-contain"
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
                    Change
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category selector + submit button */}
      {!isProcessing && !isReady && (
        <Card className="mt-4">
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground">
                {tt.categoryLabel}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryLabels[cat]}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleTryOn}
              disabled={!canSubmit || submitting}
              className="ml-auto"
            >
              <Icon name="checkroom" className="mr-1.5 icon-sm" />
              {submitting ? tt.starting : tt.tryOnButton}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </Page>
  );
}

export default function VirtualTryOnPage() {
  return (
    <Suspense
      fallback={
        <Page>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </Page>
      }
    >
      <VirtualTryOnContent />
    </Suspense>
  );
}
