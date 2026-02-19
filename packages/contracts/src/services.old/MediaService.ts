/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BatchMediaCreate } from '../models/BatchMediaCreate';
import type { BatchUploadUrlResponse } from '../models/BatchUploadUrlResponse';
import type { MediaCreate } from '../models/MediaCreate';
import type { MediaMinePage } from '../models/MediaMinePage';
import type { SignedUrlResponse } from '../models/SignedUrlResponse';
import type { UploadUrlResponse } from '../models/UploadUrlResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class MediaService {
    /**
     * Create Batch Upload Urls
     * Create upload URLs for up to 10 files at once.
     * @param requestBody
     * @returns BatchUploadUrlResponse Successful Response
     * @throws ApiError
     */
    public static mediaBatchUploadUrls(
        requestBody: BatchMediaCreate,
    ): CancelablePromise<BatchUploadUrlResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/media/batch-upload-urls',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Media Mine
     * @param cursor
     * @param type
     * @param pageSize
     * @returns MediaMinePage Successful Response
     * @throws ApiError
     */
    public static mediaMine(
        cursor?: (string | null),
        type?: (string | null),
        pageSize: number = 24,
    ): CancelablePromise<MediaMinePage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/media/mine',
            query: {
                'cursor': cursor,
                'type': type,
                'page_size': pageSize,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Upload Url
     * @param requestBody
     * @returns UploadUrlResponse Successful Response
     * @throws ApiError
     */
    public static mediaUploadUrl(
        requestBody: MediaCreate,
    ): CancelablePromise<UploadUrlResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/media/upload-url',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Download Url
     * @param mediaId
     * @param variant
     * @returns SignedUrlResponse Successful Response
     * @throws ApiError
     */
    public static mediaDownloadUrl(
        mediaId: string,
        variant?: (string | null),
    ): CancelablePromise<SignedUrlResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/media/{media_id}/download-url',
            path: {
                'media_id': mediaId,
            },
            query: {
                'variant': variant,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
