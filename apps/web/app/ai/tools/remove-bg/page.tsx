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
import "@/lib/api";

type JobStatus = {
  job_id: string;
  status: "pending" | "processing" | "ready" | "failed";
  result_url: string | null;
  error: string | null;
};

function RemoveBgContent() {
  const { authorized } = useRequireRole(["creator", "admin", "super_admin"]);
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const refToken = searchParams.get("ref");

  const [mediaAssetId, setMediaAssetId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refLoading, setRefLoading] = useState(!!refToken);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        setError("Image link expired or invalid. Please upload a new image.");
      })
      .finally(() => setRefLoading(false));
  }, [refToken]);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      try {
        const data = await apiFetch<JobStatus>(
          `/ai-tools/remove-bg/${jobId}`,
        );
        setJobStatus(data);
        if (data.status === "ready" || data.status === "failed") {
          clearInterval(poll);
          if (data.status === "ready") {
            addToast("Background removed successfully", "success");
          } else if (data.error) {
            setError(data.error);
          }
        }
      } catch {
        clearInterval(poll);
        setError("Failed to check status");
      }
    }, 2000);
    pollRef.current = poll;
    return () => clearInterval(poll);
  }, [jobId, addToast]);

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

  const handleRemoveBg = async () => {
    if (!mediaAssetId) return;
    setSubmitting(true);
    setError(null);
    setJobStatus(null);
    try {
      const data = await apiFetch<{ job_id: string; status: string }>(
        "/ai-tools/remove-bg",
        {
          method: "POST",
          body: { media_asset_id: mediaAssetId },
        },
      );
      setJobId(data.job_id);
      setJobStatus({ job_id: data.job_id, status: "processing", result_url: null, error: null });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to start processing";
      if (msg.includes("rate_limit")) {
        setError("Daily limit reached. Try again tomorrow.");
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
            Back to AI Studio
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Remove Background
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Instantly remove the background from any image. Get a clean PNG with
        transparency.
      </p>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">
            {isReady ? "Result" : "Upload Image"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Loading ref */}
          {refLoading && (
            <div className="space-y-2">
              <Skeleton className="h-32 w-full" />
              <p className="text-sm text-muted-foreground">
                Loading image from upload…
              </p>
            </div>
          )}

          {/* Upload field (shown when no image loaded and not loading ref) */}
          {!refLoading && !mediaAssetId && (
            <ImageUploadField onUploadComplete={handleUploadComplete} />
          )}

          {/* Preview of source image */}
          {previewUrl && !isReady && (
            <div>
              {refToken && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Image loaded from your upload
                </p>
              )}
              <img
                src={previewUrl}
                alt="Source image"
                className="max-h-64 rounded-lg border border-border object-contain"
              />
            </div>
          )}

          {/* Processing state */}
          {isProcessing && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">
                Removing background…
              </span>
            </div>
          )}

          {/* Result */}
          {isReady && jobStatus?.result_url && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-[url('/checkerboard.svg')] bg-repeat p-2">
                <img
                  src={jobStatus.result_url}
                  alt="Result with background removed"
                  className="max-h-72 w-full object-contain"
                />
              </div>
              <div className="flex gap-2">
                <Button asChild>
                  <a
                    href={jobStatus.result_url}
                    download="removed-bg.png"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="download" className="mr-1.5 icon-sm" />
                    Download PNG
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
                  Process Another
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

          {/* Action button */}
          {mediaAssetId && !isProcessing && !isReady && (
            <Button onClick={handleRemoveBg} disabled={submitting}>
              <Icon name="content_cut" className="mr-1.5 icon-sm" />
              {submitting ? "Starting…" : "Remove Background"}
            </Button>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}

export default function RemoveBgPage() {
  return (
    <Suspense
      fallback={
        <Page>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </Page>
      }
    >
      <RemoveBgContent />
    </Suspense>
  );
}
