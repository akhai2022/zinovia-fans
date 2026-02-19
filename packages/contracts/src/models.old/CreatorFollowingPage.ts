/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatorFollowedItem } from './CreatorFollowedItem';
/**
 * Paginated list of creators the current user follows.
 */
export type CreatorFollowingPage = {
    items: Array<CreatorFollowedItem>;
    page: number;
    page_size: number;
    total: number;
};

