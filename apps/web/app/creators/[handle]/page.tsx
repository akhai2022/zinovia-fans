import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { FollowButton } from "@/features/creators/components/FollowButton";
import { CreatorAvatarAsset } from "@/features/creators/components/CreatorAvatarAsset";
import { PostMediaImage } from "@/features/posts/components/PostMediaImage";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BioExpand } from "@/components/premium";
import type { PostItem } from "@/types/creator";
import { ApiClientError, apiFetchServer } from "@/lib/api/client";
import { getServerApiBaseUrl } from "@/lib/env";
import { SubscribeCheckoutButton } from "@/features/billing/components/SubscribeCheckoutButton";
import { MessageButton } from "@/features/messaging/MessageButton";
import { CreatorPostsSection } from "./CreatorPostsSection";

const SITE_URL = "https://zinovia.ai";

function normalizeHandle(raw: string): string {
  return raw.replace(/^@/, "").trim().toLowerCase() || raw;
}

export async function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const handle = normalizeHandle(
    typeof params.handle === "string" ? params.handle : params.handle[0]
  );
  try {
    const apiBase = getServerApiBaseUrl();
    const res = await fetch(`${apiBase}/creators/${encodeURIComponent(handle)}`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return { title: `@${handle} | Zinovia` };
    const creator = await res.json();
    const title = `${creator.display_name} (@${creator.handle}) | Zinovia`;
    const description = creator.bio
      ? creator.bio.slice(0, 160)
      : `Subscribe to ${creator.display_name}'s exclusive content on Zinovia.`;
    const url = `${SITE_URL}/creators/${creator.handle}`;
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        siteName: "Zinovia Fans",
        type: "profile",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return { title: `@${handle} | Zinovia` };
  }
}

type CreatorProfile = {
  user_id: string;
  handle: string;
  display_name: string;
  bio?: string | null;
  avatar_media_id?: string | null;
  banner_media_id?: string | null;
  verified?: boolean;
  is_online?: boolean;
  followers_count: number;
  posts_count: number;
  is_following?: boolean;
  is_subscriber?: boolean;
  subscription_price?: string | null;
  subscription_currency?: string | null;
};

type CreatorPostsPage = {
  items: Array<{
    id: string;
    creator_user_id: string;
    type: PostItem["type"];
    caption: string | null;
    visibility: PostItem["visibility"];
    nsfw: boolean;
    created_at: string;
    updated_at: string;
    asset_ids: string[];
    is_locked?: boolean;
    locked_reason?: string | null;
  }>;
};

export default async function CreatorProfilePage({
  params,
}: {
  params: { handle: string };
}) {
  const rawHandle =
    typeof params.handle === "string" ? params.handle : params.handle[0];
  const handle = normalizeHandle(rawHandle);
  const cookieHeader = cookies().toString();
  let creator: CreatorProfile;
  try {
    creator = await apiFetchServer<CreatorProfile>(`/creators/${encodeURIComponent(handle)}`, {
      method: "GET",
      cookieHeader,
    });
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 404) notFound();
    }
    return (
      <Page className="max-w-3xl space-y-4">
        <Card className="rounded-2xl border border-border p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-foreground">Unable to load creator profile.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof ApiClientError ? error.detail || error.message : "Please try again."}
          </p>
          <Button className="mt-4" variant="secondary" asChild>
            <Link href={`/creators/${handle}`}>Retry</Link>
          </Button>
        </Card>
      </Page>
    );
  }
  let posts: PostItem[] = [];
  let postsError: string | null = null;
  try {
    const postPage = await apiFetchServer<CreatorPostsPage>(
      `/creators/${encodeURIComponent(handle)}/posts`,
      {
        method: "GET",
        query: { page: 1, page_size: 20, include_locked: true },
        cookieHeader,
      }
    );
    posts = postPage.items.map((item) => ({ ...item }));
  } catch (error) {
    postsError = error instanceof ApiClientError ? error.detail || error.message : "Failed to load posts.";
  }

  const creatorJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      mainEntity: {
        "@type": "Person",
        name: creator.display_name,
        alternateName: `@${creator.handle}`,
        url: `${SITE_URL}/creators/${creator.handle}`,
        description: creator.bio ?? `Subscribe to ${creator.display_name} on Zinovia Fans.`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Creators", item: `${SITE_URL}/creators` },
        { "@type": "ListItem", position: 2, name: creator.display_name },
      ],
    },
  ];

  return (
    <Page className="max-w-6xl space-y-6 pb-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(creatorJsonLd) }}
      />
      <div className="-mx-4 overflow-hidden rounded-2xl border border-border sm:-mx-6 md:mx-0">
        {creator.banner_media_id ? (
          <PostMediaImage
            assetId={creator.banner_media_id}
            variant="full"
            className="h-40 w-full object-cover sm:h-56"
          />
        ) : (
          <div className="h-40 w-full bg-gradient-to-br from-primary/20 via-accent/10 to-surface-alt sm:h-56" />
        )}
      </div>
      <div className="relative rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="absolute -top-10 left-6">
          <CreatorAvatarAsset
            assetId={creator.avatar_media_id ?? null}
            displayName={creator.display_name}
            handle={creator.handle}
            size="lg"
            withRing
            isOnline={creator.is_online}
          />
        </div>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">{creator.display_name}</h1>
            <p className="text-sm text-muted-foreground">@{creator.handle}</p>
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{creator.followers_count} followers</span>
              <span>·</span>
              <span>{creator.posts_count} posts</span>
              {creator.verified && <Badge variant="verified">Verified</Badge>}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            {/* Primary CTA: Subscribe (or Subscribed badge) */}
            {creator.is_subscriber ? (
              <Badge variant="subscriber" className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Subscribed
              </Badge>
            ) : (
              <div className="flex flex-col items-stretch gap-1 sm:items-end">
                <SubscribeCheckoutButton
                  creatorId={creator.user_id}
                  creatorHandle={creator.handle}
                  price={creator.subscription_price ?? undefined}
                  currency={creator.subscription_currency ?? undefined}
                  isSubscriber={creator.is_subscriber}
                />
                {creator.subscription_price && (
                  <p className="text-center text-xs text-muted-foreground sm:text-right">
                    Cancel anytime
                  </p>
                )}
              </div>
            )}
            {/* Secondary actions: Follow + Message */}
            <div className="flex gap-2">
              <FollowButton creatorId={creator.user_id} initialFollowing={creator.is_following ?? false} />
              <MessageButton creatorId={creator.user_id} />
            </div>
          </div>
        </div>
        {creator.bio && (
          <div className="mt-4">
            <BioExpand text={creator.bio} />
          </div>
        )}
        {!creator.is_subscriber && creator.subscription_price && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-foreground">
              Subscribe for {parseFloat(creator.subscription_price).toFixed(2)} {(creator.subscription_currency || "EUR").toUpperCase()}/month
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Full access to subscriber-only posts
              </li>
              <li className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Direct messages with {creator.display_name}
              </li>
              <li className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Cancel anytime — no commitment
              </li>
            </ul>
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-display text-xl font-semibold text-foreground">Posts</h2>
        <p className="mt-1 text-sm text-muted-foreground">Subscriber posts remain blurred until unlocked.</p>
        {postsError ? (
          <div className="mt-4 rounded-xl border border-border p-4 text-sm text-muted-foreground">
            Failed to load posts: {postsError}{" "}
            <Link href={`/creators/${handle}`} className="underline underline-offset-2">Retry</Link>
          </div>
        ) : (
          <CreatorPostsSection
            posts={posts}
            creatorHandle={creator.handle}
            creatorName={creator.display_name}
            creatorId={creator.user_id}
            isSubscriber={creator.is_subscriber}
          />
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/creators">Back to creators</Link>
        </Button>
      </div>
    </Page>
  );
}
