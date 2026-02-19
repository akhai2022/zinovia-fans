import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiClientError, apiFetchServer } from "@/lib/api/client";
import { CreatorGrid } from "./CreatorGrid";

export const metadata: Metadata = {
  title: "Browse Creators | Zinovia",
  description:
    "Discover and subscribe to exclusive creators on Zinovia. Browse profiles, follow favourites, and unlock premium content.",
  alternates: { canonical: "https://zinovia.ai/creators" },
  openGraph: {
    title: "Browse Creators | Zinovia",
    description:
      "Discover and subscribe to exclusive creators on Zinovia. Browse profiles, follow favourites, and unlock premium content.",
    url: "https://zinovia.ai/creators",
    siteName: "Zinovia Fans",
  },
};

export type CreatorItem = {
  creator_id: string;
  handle: string;
  display_name: string;
  avatar_media_id?: string | null;
  verified?: boolean;
  is_online?: boolean;
  followers_count: number;
  posts_count: number;
};

export type CreatorDiscoverPage = {
  items: CreatorItem[];
  total: number;
  page: number;
  page_size: number;
};

function normalizeQ(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

const PAGE_SIZE = 24;

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const q = normalizeQ(searchParams?.q);
  const cookieHeader = cookies().toString();
  let data: CreatorDiscoverPage | null = null;
  let fetchError: ApiClientError | null = null;
  try {
    data = await apiFetchServer<CreatorDiscoverPage>("/creators", {
      method: "GET",
      query: { page: 1, page_size: PAGE_SIZE, q: q || undefined },
      cookieHeader,
    });
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 401) redirect("/login");
      fetchError = error;
    } else {
      fetchError = new ApiClientError("Unable to load creators.", "network");
    }
  }

  if (fetchError) {
    return (
      <Page className="max-w-6xl space-y-6">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          Creators
        </h1>
        <Card className="rounded-2xl border border-border p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-foreground">
            Unable to load creators right now.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {fetchError.detail || fetchError.message}
          </p>
          <Button className="mt-4" variant="secondary" asChild>
            <Link
              href={
                q
                  ? `/creators?q=${encodeURIComponent(q)}`
                  : "/creators"
              }
            >
              Retry
            </Link>
          </Button>
        </Card>
      </Page>
    );
  }

  return (
    <Page className="max-w-6xl space-y-6">
      <h1 className="font-display text-premium-h2 font-semibold text-foreground">
        Creators
      </h1>
      <p className="text-sm text-muted-foreground">
        Discover and follow creators.
      </p>
      <CreatorGrid
        initialItems={data?.items ?? []}
        initialTotal={data?.total ?? 0}
        initialQuery={q}
        pageSize={PAGE_SIZE}
      />
      <Button variant="ghost" size="sm" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </Page>
  );
}
