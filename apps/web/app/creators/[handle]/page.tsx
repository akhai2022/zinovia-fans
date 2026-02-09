"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@zinovia/contracts";
import {
  CreatorsService,
  type CreatorProfilePublic,
} from "@/features/creators/api";
import { BillingService } from "@/features/billing/api";
import type { PostPage } from "@/features/posts/api";
import { FollowButton } from "@/features/creators/components/FollowButton";
import { getApiErrorMessage } from "@/lib/errors";
import { getApiBaseUrl } from "@/lib/apiBase";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BioExpand,
  CreatorHeader,
  MediaGrid,
  SubscribeSheet,
} from "@/components/premium";
import { DEFAULT_SUBSCRIPTION_OFFER } from "@/types/creator";
import type { PostItem, SubscriptionOffer } from "@/types/creator";
import { DEMO_ASSETS } from "@/lib/demoAssets";
import "@/lib/api";

const PAYMENTS_NOT_CONFIGURED_MESSAGE =
  "Payments not configured in this environment.";

function mapPostToItem(p: PostPage["items"][0]): PostItem {
  return {
    id: p.id,
    creator_user_id: p.creator_user_id,
    type: p.type as PostItem["type"],
    caption: p.caption,
    visibility: p.visibility as PostItem["visibility"],
    nsfw: p.nsfw,
    created_at: p.created_at,
    updated_at: p.updated_at,
    asset_ids: p.asset_ids ?? [],
    is_locked: p.is_locked ?? false,
    locked_reason: p.locked_reason ?? undefined,
  };
}

export default function CreatorProfilePage({
  params,
}: {
  params: { handle: string };
}) {
  const handle =
    typeof params.handle === "string" ? params.handle : params.handle[0];
  const [creator, setCreator] = useState<CreatorProfilePublic | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [profileError, setProfileError] = useState<ReturnType<typeof getApiErrorMessage> | null>(null);
  const [postsStatus, setPostsStatus] = useState<
    "loading" | "error" | "ok"
  >("loading");
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const offer: SubscriptionOffer = {
    ...DEFAULT_SUBSCRIPTION_OFFER,
    dm_included: true,
  };

  const loadCreator = useCallback(() => {
    setProfileError(null);
    CreatorsService.creatorsGetByHandle(handle)
      .then((data) => {
        setCreator(data);
        setStatus("ok");
      })
      .catch((err: unknown) => {
        setProfileError(getApiErrorMessage(err));
        setStatus("error");
      });
  }, [handle]);

  const loadPosts = useCallback(() => {
    if (status !== "ok") return;
    CreatorsService.creatorsListPostsByHandle(handle, 1, 20, true)
      .then((data: PostPage) => {
        setPosts(data.items.map(mapPostToItem));
        setPostsStatus("ok");
      })
      .catch(() => setPostsStatus("error"));
  }, [handle, status]);

  useEffect(() => loadCreator(), [loadCreator]);
  useEffect(() => loadPosts(), [loadPosts]);

  const startCheckout = () => {
    if (!creator) return;
    setSubscribeError(null);
    setSubscribeLoading(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const successUrl = `${origin}/billing/success?return=${encodeURIComponent(`/creators/${handle}`)}`;
    const cancelUrl = `${origin}/billing/cancel?return=${encodeURIComponent(`/creators/${handle}`)}`;
    BillingService.billingCheckoutSubscription({
      creator_id: creator.user_id,
      success_url: successUrl,
      cancel_url: cancelUrl,
    })
      .then((res) => {
        if (res.checkout_url) window.location.href = res.checkout_url;
      })
      .catch((err: unknown) => {
        const detail =
          err instanceof ApiError &&
          err.body &&
          typeof err.body === "object" &&
          "detail" in err.body
            ? String((err.body as { detail?: unknown }).detail)
            : "";
        const isNotConfigured =
          err instanceof ApiError &&
          (err.status === 501 || err.status === 503) &&
          (detail.toLowerCase().includes("stripe not configured") ||
            detail === "stripe_not_configured");
        setSubscribeError(
          isNotConfigured
            ? PAYMENTS_NOT_CONFIGURED_MESSAGE
            : "Something went wrong. Please try again."
        );
      })
      .finally(() => setSubscribeLoading(false));
  };

  if (status === "loading") {
    return (
      <Page>
        <Skeleton className="h-28 w-full rounded-premium-lg" />
        <div className="mt-6 flex gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="mt-8">
          <Skeleton className="mb-4 h-4 w-24" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="aspect-square rounded-premium-md" />
            <Skeleton className="aspect-square rounded-premium-md" />
            <Skeleton className="aspect-square rounded-premium-md" />
            <Skeleton className="aspect-square rounded-premium-md" />
          </div>
        </div>
      </Page>
    );
  }

  if (status === "error" || !creator) {
    const isUnauthorized = profileError?.kind === "unauthorized";
    const isNotFound = profileError?.status === 404;
    const message =
      isNotFound
        ? "Creator not found."
        : isUnauthorized
          ? "Sign in to view this profile."
          : profileError?.message ?? "Creator not found.";
    return (
      <Page>
        <div
          className="rounded-premium-lg border border-border bg-muted/30 py-8 text-center"
          role="alert"
        >
          <p className="text-destructive">{message}</p>
          {isUnauthorized ? (
            <Button variant="default" size="sm" className="mt-4 rounded-premium-sm" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="mt-4 rounded-premium-sm" onClick={loadCreator}>
              Retry
            </Button>
          )}
        </div>
        <Button variant="ghost" size="sm" className="mt-4 rounded-premium-sm" asChild>
          <Link href="/creators">Back to creators</Link>
        </Button>
        {process.env.NODE_ENV === "development" && (
          <p className="mt-4 text-xs text-muted-foreground">
            API base URL: {getApiBaseUrl()}
          </p>
        )}
      </Page>
    );
  }

  const bannerUrl = creator.banner_media_id
    ? undefined
    : DEMO_ASSETS.banner["1500x500"];
  const avatarUrl = creator.avatar_media_id
    ? undefined
    : DEMO_ASSETS.avatar[512];

  return (
    <Page className="space-y-6 pb-24 md:pb-8">
      {/* Banner: demo image when no banner_media_id */}
      <div
        className="-mx-4 h-28 sm:-mx-6 sm:h-36 md:rounded-premium-lg bg-brand-gradient-subtle bg-cover bg-center"
        style={
          bannerUrl
            ? { backgroundImage: `url(${bannerUrl})` }
            : undefined
        }
      />

      {/* Profile block: avatar, name, handle, verified, CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <CreatorHeader
          displayName={creator.display_name}
          handle={creator.handle}
          avatarUrl={avatarUrl}
          href={`/creators/${handle}`}
          noLink
          size="lg"
          className="flex-1"
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge variant="verified" className="shrink-0">
            Verified by Zinovia
          </Badge>
          <FollowButton
            creatorId={creator.user_id}
            initialFollowing={creator.is_following ?? false}
          />
          <Button
            variant="brand"
            size="sm"
            className="rounded-premium-sm"
            onClick={() => setSubscribeOpen(true)}
            disabled={subscribeLoading}
            aria-label="Subscribe to this creator"
          >
            {subscribeLoading ? "Starting…" : "Subscribe"}
          </Button>
        </div>
      </div>

      {subscribeError && (
        <p className="text-sm text-destructive" role="alert">
          {subscribeError}
        </p>
      )}

      {/* Bio — 2–4 lines visible; Read more if longer */}
      {creator.bio && (
        <div>
          <BioExpand text={creator.bio} />
        </div>
      )}

      {/* Subscribe benefits + trust */}
      <div className="rounded-premium-lg border border-border bg-surface-2/50 p-4">
        <h2 className="font-display text-premium-h3 font-semibold text-foreground">
          What you get
        </h2>
        <ul
          className="mt-2 space-y-1 text-premium-body-sm text-muted-foreground"
          role="list"
        >
          <li className="flex items-center gap-2">
            <span className="text-success-500" aria-hidden>
              ✓
            </span>
            Exclusive posts
          </li>
          <li className="flex items-center gap-2">
            <span className="text-success-500" aria-hidden>
              ✓
            </span>
            Subscriber-only DMs included
          </li>
          <li className="flex items-center gap-2">
            <span className="text-success-500" aria-hidden>
              ✓
            </span>
            Full feed access
          </li>
        </ul>
        <p className="mt-3 text-premium-small text-muted-foreground">
          Cancel anytime. Secure payments.
        </p>
      </div>

      {/* Preview grid with locked overlays */}
      <div>
        <h2 className="mb-4 text-premium-h3 font-semibold text-foreground">
          Posts
        </h2>
        {postsStatus === "loading" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            <Skeleton className="aspect-square rounded-premium-md" />
            <Skeleton className="aspect-square rounded-premium-md" />
            <Skeleton className="aspect-square rounded-premium-md" />
            <Skeleton className="aspect-square rounded-premium-md" />
          </div>
        )}
        {postsStatus === "error" && (
          <p className="text-sm text-destructive">Failed to load posts.</p>
        )}
        {postsStatus === "ok" && (
          <MediaGrid
            posts={posts}
            isSubscriber={false}
            isLocked={(p) => p.visibility === "SUBSCRIBERS"}
            creatorHandle={handle}
            onUnlockClick={() => setSubscribeOpen(true)}
            columns={4}
            showWatermark
          />
        )}
      </div>

      {/* Sticky subscribe bar (mobile) */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 border-t border-border bg-card/95 backdrop-blur-sm px-4 py-3 shadow-strong md:hidden"
        role="complementary"
        aria-label="Subscribe bar"
      >
        <div className="h-10 w-10 shrink-0 rounded-full bg-brand-gradient-subtle ring-2 ring-brand/20" />
        <span className="min-w-0 flex-1 truncate text-premium-body-sm font-medium text-foreground">
          Subscribe to {creator.display_name}
        </span>
        <Button
          variant="brand"
          size="sm"
          className="shrink-0 rounded-premium-sm"
          onClick={() => setSubscribeOpen(true)}
          disabled={subscribeLoading}
        >
          Subscribe
        </Button>
      </div>

      <SubscribeSheet
        open={subscribeOpen}
        onOpenChange={setSubscribeOpen}
        creatorName={creator.display_name}
        offer={offer}
        onSubscribe={startCheckout}
        loading={subscribeLoading}
        disabledHelper={
          subscribeError === PAYMENTS_NOT_CONFIGURED_MESSAGE
            ? PAYMENTS_NOT_CONFIGURED_MESSAGE
            : null
        }
      />

      <Button variant="ghost" size="sm" className="rounded-premium-sm" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </Page>
  );
}
