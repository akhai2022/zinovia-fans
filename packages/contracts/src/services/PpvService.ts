/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PpvCreateIntentOut } from '../models/PpvCreateIntentOut';
import type { PpvMessageMediaStatusOut } from '../models/PpvMessageMediaStatusOut';
import type { PpvPostStatusOut } from '../models/PpvPostStatusOut';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class PpvService {
    /**
     * Create Intent (Message Media)
     * @param messageMediaId
     * @returns PpvCreateIntentOut Successful Response
     * @throws ApiError
     */
    public static createIntentPpvMessageMediaMessageMediaIdCreateIntentPost(
        messageMediaId: string,
    ): CancelablePromise<PpvCreateIntentOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/ppv/message-media/{message_media_id}/create-intent',
            path: {
                'message_media_id': messageMediaId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Status (Message Media)
     * @param messageMediaId
     * @returns PpvMessageMediaStatusOut Successful Response
     * @throws ApiError
     */
    public static statusPpvMessageMediaMessageMediaIdStatusGet(
        messageMediaId: string,
    ): CancelablePromise<PpvMessageMediaStatusOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/ppv/message-media/{message_media_id}/status',
            path: {
                'message_media_id': messageMediaId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Intent (Post PPV)
     * @param postId
     * @returns PpvCreateIntentOut Successful Response
     * @throws ApiError
     */
    public static createPostIntent(
        postId: string,
    ): CancelablePromise<PpvCreateIntentOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/ppv/posts/{post_id}/create-intent',
            path: {
                'post_id': postId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Status (Post PPV)
     * @param postId
     * @returns PpvPostStatusOut Successful Response
     * @throws ApiError
     */
    public static getPostStatus(
        postId: string,
    ): CancelablePromise<PpvPostStatusOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/ppv/posts/{post_id}/status',
            path: {
                'post_id': postId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
