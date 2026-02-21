/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MediaPreview } from './MediaPreview';
/**
 * Post as returned by API (asset_ids only; client uses download endpoint).
 */
export type PostOut = {
    asset_ids?: Array<string>;
    caption: (string | null);
    created_at: string;
    creator_user_id: string;
    /**
     * Currency code for PPV price.
     */
    currency?: (string | null);
    id: string;
    /**
     * True when viewer cannot access content (teaser only).
     */
    is_locked?: boolean;
    /**
     * When is_locked: SUBSCRIPTION_REQUIRED, FOLLOW_REQUIRED, or PPV_REQUIRED.
     */
    locked_reason?: (string | null);
    /**
     * Map of asset_id → {blurhash, dominant_color} for instant placeholders.
     */
    media_previews?: Record<string, MediaPreview>;
    nsfw: boolean;
    /**
     * PPV price in cents (set when visibility=PPV).
     */
    price_cents?: (number | null);
    publish_at?: (string | null);
    status?: string;
    type: string;
    updated_at: string;
    visibility: string;
};

