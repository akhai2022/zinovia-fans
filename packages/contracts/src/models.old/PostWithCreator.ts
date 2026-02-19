/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatorSummary } from './CreatorSummary';
/**
 * Post with creator summary (e.g. feed).
 */
export type PostWithCreator = {
    asset_ids?: Array<string>;
    caption: (string | null);
    created_at: string;
    creator: CreatorSummary;
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
    publish_at?: (string | null);
    status?: string;
    type: string;
    updated_at: string;
    visibility: string;
};

