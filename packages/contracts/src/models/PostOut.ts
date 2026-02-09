/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Post as returned by API (asset_ids only; client uses download endpoint).
 */
export type PostOut = {
    asset_ids?: Array<string>;
    caption: (string | null);
    created_at: string;
    creator_user_id: string;
    id: string;
    /**
     * True when viewer cannot access content (teaser only).
     */
    is_locked?: boolean;
    /**
     * When is_locked: SUBSCRIPTION_REQUIRED or FOLLOW_REQUIRED for UI copy.
     */
    locked_reason?: (string | null);
    nsfw: boolean;
    type: string;
    updated_at: string;
    visibility: string;
};

