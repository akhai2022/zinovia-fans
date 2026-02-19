/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class FutureService {
    /**
     * Analytics Schema
     * @returns any Successful Response
     * @throws ApiError
     */
    public static analyticsSchemaFutureAnalyticsSchemaGet(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/future/analytics/schema',
        });
    }
    /**
     * Broadcast Schema
     * @returns any Successful Response
     * @throws ApiError
     */
    public static broadcastSchemaFutureBroadcastSchemaGet(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/future/broadcast/schema',
        });
    }
    /**
     * Moderation Schema
     * @returns any Successful Response
     * @throws ApiError
     */
    public static moderationSchemaFutureModerationSchemaGet(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/future/moderation/schema',
        });
    }
    /**
     * Ppv Posts Schema
     * @returns any Successful Response
     * @throws ApiError
     */
    public static ppvPostsSchemaFuturePpvPostsSchemaGet(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/future/ppv-posts/schema',
        });
    }
    /**
     * Promotions Schema
     * @returns any Successful Response
     * @throws ApiError
     */
    public static promotionsSchemaFuturePromotionsSchemaGet(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/future/promotions/schema',
        });
    }
}
