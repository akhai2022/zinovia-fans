/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatorDiscoverItem } from './CreatorDiscoverItem';
/**
 * Paginated list of discoverable creators.
 */
export type CreatorDiscoverPage = {
    items: Array<CreatorDiscoverItem>;
    page: number;
    page_size: number;
    total: number;
};

