/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PostWithCreator } from './PostWithCreator';
/**
 * Paginated feed with creator summary.
 */
export type FeedPage = {
    items: Array<PostWithCreator>;
    page: number;
    page_size: number;
    total: number;
};

