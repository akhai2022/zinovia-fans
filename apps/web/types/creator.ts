/**
 * Shared types for creator profile, feed, and paywall.
 * Align with API/contracts where possible; use for mock data and component props.
 */

export type PostType = "TEXT" | "IMAGE" | "VIDEO";
export type Visibility = "PUBLIC" | "FOLLOWERS" | "SUBSCRIBERS" | "PPV";

export interface CreatorSummary {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_asset_id?: string | null;
  verified?: boolean;
}

export interface PostItem {
  id: string;
  creator_user_id: string;
  type: PostType;
  caption: string | null;
  visibility: Visibility;
  nsfw: boolean;
  created_at: string;
  updated_at: string;
  asset_ids: string[];
  /** True when post is paywalled for this viewer (teaser only; no caption/asset_ids). */
  is_locked?: boolean;
  /** When is_locked: SUBSCRIPTION_REQUIRED | FOLLOW_REQUIRED | PPV_REQUIRED for overlay copy. */
  locked_reason?: string | null;
  /** PPV price in cents (set when visibility=PPV). */
  price_cents?: number | null;
  /** Currency code for PPV price. */
  currency?: string | null;
  creator?: CreatorSummary;
}

export interface SubscriptionOffer {
  price: string;
  currency: string;
  interval: "month";
  perks: string[];
  dm_included?: boolean;
}

/** Mock/default for subscribe sheet when API doesn't return plan */
export const DEFAULT_SUBSCRIPTION_OFFER: SubscriptionOffer = {
  price: "4.99",
  currency: "EUR",
  interval: "month",
  perks: ["Full feed access", "Subscriber-only DMs", "Exclusive posts"],
  dm_included: true,
};
