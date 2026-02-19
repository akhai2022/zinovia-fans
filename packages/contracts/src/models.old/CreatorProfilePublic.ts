/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Public view of a creator profile with aggregated counts.
 */
export type CreatorProfilePublic = {
    avatar_media_id: (string | null);
    banner_media_id: (string | null);
    bio: (string | null);
    created_at: string;
    discoverable: boolean;
    display_name: string;
    followers_count: number;
    handle: string;
    is_following?: boolean;
    nsfw: boolean;
    posts_count?: number;
    /**
     * ISO 4217 currency code (e.g. eur)
     */
    subscription_currency?: (string | null);
    /**
     * Monthly subscription price in major currency units (e.g. 4.99)
     */
    subscription_price?: (string | null);
    updated_at: string;
    user_id: string;
    verified?: boolean;
};

