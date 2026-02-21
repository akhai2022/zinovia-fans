import Link from "next/link";
import { cookies } from "next/headers";

import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiClientError, apiFetchServer } from "@/lib/api/client";
import { getServerDictionary } from "@/lib/i18n/server";
import { FeedContent } from "./FeedContent";

type FeedCreator = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_asset_id?: string | null;
};

export type FeedItem = {
  id: string;
  creator_user_id: string;
  type: "TEXT" | "IMAGE" | "VIDEO";
  caption: string | null;
  visibility: "PUBLIC" | "FOLLOWERS" | "SUBSCRIBERS";
  nsfw: boolean;
  created_at: string;
  updated_at: string;
  asset_ids: string[];
  is_locked: boolean;
  locked_reason: string | null;
  creator: FeedCreator;
};

export type FeedPageData = {
  items: FeedItem[];
  total: number;
  page: number;
  page_size: number;
  next_cursor: string | null;
};

export default async function FeedPage() {
  const { dictionary: t } = await getServerDictionary();
  const cookieHeader = cookies().toString();
  let data: FeedPageData | null = null;
  let fetchError: string | null = null;

  try {
    data = await apiFetchServer<FeedPageData>("/feed", {
      method: "GET",
      query: { page: 1, page_size: 20 },
      cookieHeader,
    });
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 401) {
        // Show a login CTA instead of redirect() to avoid prefetch-induced
        // navigation loops between /feed and /login.
        return (
          <Page className="flex min-h-[60vh] items-center justify-center">
            <Card className="w-full max-w-md rounded-2xl border border-border py-10 text-center shadow-premium-md">
              <p className="font-display text-premium-h3 font-semibold text-foreground">
                {t.feed.signInToViewFeed}
              </p>
              <p className="mt-2 px-6 text-premium-body text-muted-foreground">
                {t.feed.signInToViewFeedDescription}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button size="sm" asChild>
                  <Link href="/login?next=/feed">{t.feed.signInButton}</Link>
                </Button>
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/creators">{t.feed.discoverCreators}</Link>
                </Button>
              </div>
            </Card>
          </Page>
        );
      }
      fetchError = error.detail || error.message;
    } else {
      fetchError = t.feed.fallbackError;
    }
  }

  return (
    <Page className="space-y-6">
      <FeedContent
        initialData={data}
        initialError={fetchError}
      />
    </Page>
  );
}
