"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MediaGrid } from "@/components/premium";
import { SubscribeSheet } from "@/components/premium/SubscribeSheet";
import { BillingService } from "@/features/billing/api";
import { buildBillingReturnUrls } from "@/features/billing/checkoutUrls";
import { getApiErrorMessage } from "@/lib/errors";
import { PostUnlockButton } from "@/features/ppv/PostUnlockButton";
import { useSession } from "@/lib/hooks/useSession";
import type { PostItem, SubscriptionOffer } from "@/types/creator";
import { DEFAULT_SUBSCRIPTION_OFFER } from "@/types/creator";
import { uuidClient } from "@/lib/uuid";
import "@/lib/api";

interface CreatorPostsSectionProps {
  posts: PostItem[];
  creatorHandle: string;
  creatorName: string;
  creatorId: string;
  isSubscriber?: boolean;
}

/**
 * Client component that wraps MediaGrid with the subscribe/PPV checkout flow.
 * Subscription posts → SubscribeSheet. PPV posts → PostUnlockButton (PaymentIntent).
 */
export function CreatorPostsSection({
  posts,
  creatorHandle,
  creatorName,
  creatorId,
  isSubscriber = false,
}: CreatorPostsSectionProps) {
  const router = useRouter();
  const { user: sessionUser } = useSession();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [ppvPost, setPpvPost] = useState<PostItem | null>(null);
  const idempotencyRef = useRef<string | null>(null);

  const offer: SubscriptionOffer = DEFAULT_SUBSCRIPTION_OFFER;

  const handleUnlockClick = useCallback((post?: PostItem) => {
    if (post?.locked_reason === "PPV_REQUIRED") {
      setPpvPost(post);
    } else {
      setSheetOpen(true);
    }
  }, []);

  const handleSubscribe = useCallback(async () => {
    if (typeof window === "undefined" || checkoutLoading) return;
    setCheckoutLoading(true);
    setCheckoutError(null);

    // Auth check: redirect unauthenticated users to login
    if (!sessionUser) {
      const returnTo = `/creators/${creatorHandle}`;
      router.push(`/login?next=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (!idempotencyRef.current) {
      idempotencyRef.current = uuidClient();
    }

    try {
      const { successUrl, cancelUrl } = buildBillingReturnUrls(
        window.location.origin,
        `/creators/${creatorHandle}`,
        { creatorId, creatorHandle },
      );
      const response = await BillingService.billingCheckoutSubscription({
        creator_id: creatorId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      if (!response.checkout_url) {
        setCheckoutError("Unable to start checkout. Please try again.");
        setCheckoutLoading(false);
        idempotencyRef.current = null;
        return;
      }
      window.location.assign(response.checkout_url);
    } catch (err) {
      const parsed = getApiErrorMessage(err);
      if (parsed.kind === "unauthorized") {
        const returnTo = `/creators/${creatorHandle}`;
        router.push(`/login?next=${encodeURIComponent(returnTo)}`);
        return;
      }
      setCheckoutError(parsed.message);
      setCheckoutLoading(false);
      idempotencyRef.current = null;
    }
  }, [creatorId, creatorHandle, checkoutLoading, router, sessionUser]);

  return (
    <>
      <MediaGrid
        posts={posts}
        isSubscriber={isSubscriber}
        creatorHandle={creatorHandle}
        onUnlockClick={handleUnlockClick}
        columns={4}
        className="mt-4"
      />

      <SubscribeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        creatorName={creatorName}
        offer={offer}
        onSubscribe={handleSubscribe}
        loading={checkoutLoading}
        disabledHelper={checkoutError}
      />

      {ppvPost && (
        <PostUnlockButton
          postId={ppvPost.id}
          priceCents={ppvPost.price_cents ?? 0}
          currency={ppvPost.currency ?? "eur"}
          onClose={() => setPpvPost(null)}
          onUnlocked={() => {
            setPpvPost(null);
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
