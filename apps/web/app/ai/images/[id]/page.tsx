"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
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
import { useTranslation, interpolate } from "@/lib/i18n";
import { Icon } from "@/components/ui/icon";
import "@/lib/api";

const POLL_INTERVAL_MS = 2000;

export default function AiImageJobPage() {
  const { authorized } = useRequireRole(["creator", "admin", "super_admin"]);
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const { t } = useTranslation();
  const jobId = params.id as string;
  const [job, setJob] = useState<AiImageJobOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const fetchJob = () => {
    AiImagesService.get(jobId)
      .then(setJob)
      .catch((e) => {
        setError(e instanceof Error ? e.message : t.aiImages.errorFallbackDetail);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  useEffect(() => {
    if (!job || job.status === "READY" || job.status === "FAILED") return;
    const timer = setInterval(fetchJob, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [job?.status, jobId]);

  const handleApply = async (applyTo: AiImageApplyIn["apply_to"]) => {
    setApplying(true);
    try {
      await AiImagesService.apply(jobId, {
        apply_to: applyTo,
        result_index: 0,
      });
      addToast(t.aiImages.toastApplied, "success");
      if (applyTo === "landing.hero") {
        addToast(t.aiImages.toastViewHomePage, "default");
        router.push("/");
      } else if (applyTo.startsWith("creator.")) {
        addToast(t.aiImages.toastViewSettings, "default");
        router.push("/settings/profile");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.aiImages.applyErrorFallback;
      addToast(msg, "error");
    } finally {
      setApplying(false);
    }
  };

  if (!authorized) return null;

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
          <Link href="/ai/images"><Icon name="arrow_back" className="mr-1.5 icon-sm" />{t.aiImages.backToList}</Link>
        </Button>
      </Page>
    );
  }

  if (!job) return null;

  return (
    <Page>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/ai/images"><Icon name="arrow_back" className="mr-1.5 icon-sm" />{t.aiImages.backButton}</Link>
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
                      alt={interpolate(t.aiImages.resultAlt, { index: idx + 1 })}
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
                            <Icon name="auto_awesome" className="mr-1.5 icon-sm" />{t.aiImages.useAsDropdown}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleApply("landing.hero")}
                          >
                            {t.aiImages.useAsLandingHero}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleApply("creator.avatar")}
                          >
                            {t.aiImages.useAsMyAvatar}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleApply("creator.banner")}
                          >
                            {t.aiImages.useAsMyBanner}
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
                ? t.aiImages.statusGenerating
                : job.status === "FAILED"
                ? t.aiImages.statusFailed
                : job.status}
            </div>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
