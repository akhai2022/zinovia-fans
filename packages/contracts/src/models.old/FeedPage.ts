/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PostWithCreator } from './PostWithCreator';
/**
 * Paginated feed with creator summary. Supports cursor-based pagination.
 */
export type FeedPage = {
    items: Array<PostWithCreator>;
    /**
     * Opaque cursor for the next page. Pass as ?cursor= for infinite scroll.
     */
    next_cursor?: (string | null);
    page: number;
    page_size: number;
    total: number;
};

