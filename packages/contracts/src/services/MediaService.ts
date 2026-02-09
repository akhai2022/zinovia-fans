/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MediaCreate } from '../models/MediaCreate';
import type { SignedUrlResponse } from '../models/SignedUrlResponse';
import type { UploadUrlResponse } from '../models/UploadUrlResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class MediaService {
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
