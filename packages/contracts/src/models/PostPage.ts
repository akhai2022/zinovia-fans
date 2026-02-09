/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PostOut } from './PostOut';
/**
 * Paginated list of posts.
 */
export type PostPage = {
    items: Array<PostOut>;
    page: number;
    page_size: number;
    total: number;
};

