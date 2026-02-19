/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FeedPage } from '../models/FeedPage';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class FeedService {
    /**
     * Feed
     * @param page
     * @param pageSize
     * @param cursor Opaque cursor for infinite scroll pagination.
     * @returns FeedPage Successful Response
     * @throws ApiError
     */
    public static feedList(
        page: number = 1,
        pageSize: number = 20,
        cursor?: (string | null),
    ): CancelablePromise<FeedPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/feed',
            query: {
                'page': page,
                'page_size': pageSize,
                'cursor': cursor,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
