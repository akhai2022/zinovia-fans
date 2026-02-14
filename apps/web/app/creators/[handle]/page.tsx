import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

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
import { SubscribeCheckoutButton } from "@/features/billing/components/SubscribeCheckoutButton";
import { CreatorPostsSection } from "./CreatorPostsSection";

function normalizeHandle(raw: string): string {
  return raw.replace(/^@/, "").trim().toLowerCase() || raw;
}

type CreatorProfile = {
  user_id: string;
  handle: string;
  display_name: string;
  bio?: string | null;
  avatar_media_id?: string | null;
  banner_media_id?: string | null;
  followers_count: number;
  posts_count: number;
  is_following?: boolean;
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

  return (
    <Page className="max-w-6xl space-y-6 pb-10">
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
              <Badge variant="verified">Verified</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <FollowButton creatorId={creator.user_id} initialFollowing={creator.is_following ?? false} />
            <Button variant="secondary" size="sm" asChild>
              <Link href="/messages">Message</Link>
            </Button>
            <SubscribeCheckoutButton creatorId={creator.user_id} creatorHandle={creator.handle} />
          </div>
        </div>
        {creator.bio && (
          <div className="mt-4">
            <BioExpand text={creator.bio} />
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
