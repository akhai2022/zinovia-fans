"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AiImagesService, AiImageApplyIn, type AiImageJobOut } from "@/features/ai/api";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import "@/lib/api";

const POLL_INTERVAL_MS = 2000;

export default function AiImageJobPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const jobId = params.id as string;
  const [job, setJob] = useState<AiImageJobOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const fetchJob = () => {
    AiImagesService.get(jobId)
      .then(setJob)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  useEffect(() => {
    if (!job || job.status === "READY" || job.status === "FAILED") return;
    const t = setInterval(fetchJob, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [job?.status, jobId]);

  const handleApply = async (applyTo: AiImageApplyIn["apply_to"]) => {
    setApplying(true);
    try {
      await AiImagesService.apply(jobId, {
        apply_to: applyTo,
        result_index: 0,
      });
      addToast("Image applied successfully", "success");
      if (applyTo === "landing.hero") {
        addToast("View on the home page", "default");
        router.push("/");
      } else if (applyTo.startsWith("creator.")) {
        addToast("View in Settings → Profile", "default");
        router.push("/settings/profile");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to apply";
      addToast(msg, "error");
    } finally {
      setApplying(false);
    }
  };

  if (loading && !job) {
    return (
      <Page>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-64 w-full" />
      </Page>
    );
  }

  if (error && !job) {
    return (
      <Page>
        <p className="text-destructive">{error}</p>
        <Button variant="outline" className="mt-2" asChild>
          <Link href="/ai/images">Back to list</Link>
        </Button>
      </Page>
    );
  }

  if (!job) return null;

  return (
    <Page>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/ai/images">← Back</Link>
        </Button>
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {job.image_type} · {job.status}
      </h1>
      {job.prompt_preview && (
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {job.prompt_preview}
        </p>
      )}
      <Card className="mt-4">
        <CardContent className="pt-6">
          {job.status === "READY" && job.result_urls && job.result_urls.length > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {job.result_urls.map((url, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={url}
                      alt={`Result ${idx + 1}`}
                      className="w-full rounded-brand object-cover"
                    />
                    <div className="absolute bottom-2 right-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={applying}
                          >
                            Use as…
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleApply("landing.hero")}
                          >
                            Use as Landing Hero (admin)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleApply("creator.avatar")}
                          >
                            Use as My Avatar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleApply("creator.banner")}
                          >
                            Use as My Banner
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-brand bg-muted text-muted-foreground">
              {job.status === "QUEUED" || job.status === "GENERATING"
                ? "Generating…"
                : job.status === "FAILED"
                ? "Generation failed"
                : job.status}
            </div>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
