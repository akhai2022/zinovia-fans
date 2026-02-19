/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatorSummary } from './CreatorSummary';
/**
 * Search result with creator info.
 */
export type PostSearchResult = {
    asset_ids?: Array<string>;
    caption: (string | null);
    created_at: string;
    creator?: (CreatorSummary | null);
    creator_user_id: string;
    id: string;
    nsfw: boolean;
    type: string;
    updated_at: string;
    visibility: string;
};

