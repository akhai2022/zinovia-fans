/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AiImageApplyIn } from '../models/AiImageApplyIn';
import type { AiImageApplyOut } from '../models/AiImageApplyOut';
import type { AiImageGenerateIn } from '../models/AiImageGenerateIn';
import type { AiImageGenerateOut } from '../models/AiImageGenerateOut';
import type { AiImageJobOut } from '../models/AiImageJobOut';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AiService {
    /**
     * List Ai Jobs
     * List last 50 jobs for current user.
     * @returns AiImageJobOut Successful Response
     * @throws ApiError
     */
    public static aiImagesList(): CancelablePromise<Array<AiImageJobOut>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/ai/images',
        });
    }
    /**
     * Generate
     * Create AI image job, enqueue worker. Rate limited.
     * @param requestBody
     * @returns AiImageGenerateOut Successful Response
     * @throws ApiError
     */
    public static aiImagesGenerate(
        requestBody: AiImageGenerateIn,
    ): CancelablePromise<AiImageGenerateOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/ai/images/generate',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Job Detail
     * Get job status; when READY, includes presigned result URLs.
     * @param jobId
     * @returns AiImageJobOut Successful Response
     * @throws ApiError
     */
    public static aiImagesGet(
        jobId: string,
    ): CancelablePromise<AiImageJobOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/ai/images/{job_id}',
            path: {
                'job_id': jobId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Apply
     * Apply generated image to landing.hero, creator.avatar, or creator.banner.
     * @param jobId
     * @param requestBody
     * @returns AiImageApplyOut Successful Response
     * @throws ApiError
     */
    public static aiImagesApply(
        jobId: string,
        requestBody: AiImageApplyIn,
    ): CancelablePromise<AiImageApplyOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/ai/images/{job_id}/apply',
            path: {
                'job_id': jobId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
