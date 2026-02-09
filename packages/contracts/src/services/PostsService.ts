/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PostCreate } from '../models/PostCreate';
import type { PostOut } from '../models/PostOut';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class PostsService {
    /**
     * Create
     * @param requestBody
     * @returns PostOut Successful Response
     * @throws ApiError
     */
    public static postsCreate(
        requestBody: PostCreate,
    ): CancelablePromise<PostOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/posts',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
