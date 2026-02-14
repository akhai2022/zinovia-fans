"use client";

import { useState, useCallback } from "react";
import { MediaGrid } from "@/components/premium";
import { SubscribeSheet } from "@/components/premium/SubscribeSheet";
import { BillingService } from "@/features/billing/api";
import { buildBillingReturnUrls } from "@/features/billing/checkoutUrls";
import { getApiErrorMessage } from "@/lib/errors";
import type { PostItem, SubscriptionOffer } from "@/types/creator";
import { DEFAULT_SUBSCRIPTION_OFFER } from "@/types/creator";

interface CreatorPostsSectionProps {
  posts: PostItem[];
  creatorHandle: string;
  creatorName: string;
  creatorId: string;
  isSubscriber?: boolean;
}

/**
 * Client component that wraps MediaGrid with the subscribe checkout flow.
 * When a locked post's "Unlock" button is clicked, the SubscribeSheet opens.
 * The sheet's CTA creates a Stripe Checkout session and redirects.
 */
export function CreatorPostsSection({
  posts,
  creatorHandle,
  creatorName,
  creatorId,
  isSubscriber = false,
}: CreatorPostsSectionProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const offer: SubscriptionOffer = DEFAULT_SUBSCRIPTION_OFFER;

  const handleUnlockClick = useCallback(() => {
    setSheetOpen(true);
  }, []);

  const handleSubscribe = useCallback(async () => {
    if (typeof window === "undefined") return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const { successUrl, cancelUrl } = buildBillingReturnUrls(
        window.location.origin,
        `/creators/${creatorHandle}`,
      );
      const response = await BillingService.billingCheckoutSubscription({
        creator_id: creatorId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      if (!response.checkout_url) {
        setCheckoutError("Unable to start checkout. Please try again.");
        setCheckoutLoading(false);
        return;
      }
      window.location.assign(response.checkout_url);
    } catch (err) {
      setCheckoutError(getApiErrorMessage(err).message);
      setCheckoutLoading(false);
    }
  }, [creatorId, creatorHandle]);

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
    </>
  );
}
