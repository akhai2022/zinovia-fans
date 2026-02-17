"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AiImagesService, type AiImageJobOut } from "@/features/ai/api";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import "@/lib/api";

export default function AiImagesListPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<AiImageJobOut[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AiImagesService.list()
      .then(setJobs)
      .catch((e) => {
        const status = (e as { status?: number })?.status;
        if (status === 401) {
          router.replace("/login?next=/ai/images");
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <Page>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          AI Image Studio
        </h1>
        <Skeleton className="mt-4 h-32 w-full" />
        <Skeleton className="mt-2 h-32 w-full" />
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          AI Image Studio
        </h1>
        <p className="mt-2 text-sm text-destructive">{error}</p>
      </Page>
    );
  }

  return (
    <Page>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          AI Image Studio
        </h1>
        <Button asChild>
          <Link href="/ai/images/new">Generate new</Link>
        </Button>
      </div>
      {!jobs || jobs.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No AI images yet. Generate your first image.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/ai/images/new">Generate new</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {jobs.map((job) => (
            <Card key={job.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  <Link
                    href={`/ai/images/${job.id}`}
                    className="hover:underline"
                  >
                    {job.image_type} · {job.status}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {job.status === "READY" && job.result_urls?.[0] ? (
                  <Link href={`/ai/images/${job.id}`}>
                    <img
                      src={job.result_urls[0]}
                      alt=""
                      className="h-40 w-full rounded-brand object-cover"
                    />
                  </Link>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-brand bg-muted text-sm text-muted-foreground">
                    {job.status}
                  </div>
                )}
                <Button variant="outline" size="sm" className="mt-2 w-full" asChild>
                  <Link href={`/ai/images/${job.id}`}>View & apply</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
