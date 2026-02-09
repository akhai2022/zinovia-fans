/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatorDiscoverPage } from '../models/CreatorDiscoverPage';
import type { CreatorFollowingPage } from '../models/CreatorFollowingPage';
import type { CreatorProfilePublic } from '../models/CreatorProfilePublic';
import type { CreatorProfileUpdate } from '../models/CreatorProfileUpdate';
import type { PostPage } from '../models/PostPage';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CreatorsService {
    /**
     * List Creators
     * List discoverable creators. Paginated. Optional search (handle/display_name ILIKE).
     * @param page
     * @param pageSize
     * @param q Search by handle or display name
     * @returns CreatorDiscoverPage Successful Response
     * @throws ApiError
     */
    public static creatorsList(
        page: number = 1,
        pageSize: number = 20,
        q?: (string | null),
    ): CancelablePromise<CreatorDiscoverPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/creators',
            query: {
                'page': page,
                'page_size': pageSize,
                'q': q,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Current creator profile
     * Creator role only. Returns the authenticated creator's profile (403 for fans).
     * @returns CreatorProfilePublic Successful Response
     * @throws ApiError
     */
    public static creatorsGetMe(): CancelablePromise<CreatorProfilePublic> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/creators/me',
        });
    }
    /**
     * Update Me
     * @param requestBody
     * @returns CreatorProfilePublic Successful Response
     * @throws ApiError
     */
    public static creatorsUpdateMe(
        requestBody: CreatorProfileUpdate,
    ): CancelablePromise<CreatorProfilePublic> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/creators/me',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Me Following
     * @param page
     * @param pageSize
     * @returns CreatorFollowingPage Successful Response
     * @throws ApiError
     */
    public static creatorsMeFollowing(
        page: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<CreatorFollowingPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/creators/me/following',
            query: {
                'page': page,
                'page_size': pageSize,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Unfollow
     * @param creatorId
     * @returns string Successful Response
     * @throws ApiError
     */
    public static creatorsUnfollow(
        creatorId: string,
    ): CancelablePromise<Record<string, string>> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/creators/{creator_id}/follow',
            path: {
                'creator_id': creatorId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Follow
     * @param creatorId
     * @returns string Successful Response
     * @throws ApiError
     */
    public static creatorsFollow(
        creatorId: string,
    ): CancelablePromise<Record<string, string>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/creators/{creator_id}/follow',
            path: {
                'creator_id': creatorId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Creator
     * @param handle
     * @returns CreatorProfilePublic Successful Response
     * @throws ApiError
     */
    public static creatorsGetByHandle(
        handle: string,
    ): CancelablePromise<CreatorProfilePublic> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/creators/{handle}',
            path: {
                'handle': handle,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Creator Posts
     * @param handle
     * @param page
     * @param pageSize
     * @param includeLocked Include locked posts as teasers (FOLLOW_REQUIRED / SUBSCRIPTION_REQUIRED).
     * @returns PostPage Successful Response
     * @throws ApiError
     */
    public static creatorsListPostsByHandle(
        handle: string,
        page: number = 1,
        pageSize: number = 20,
        includeLocked: boolean = true,
    ): CancelablePromise<PostPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/creators/{handle}/posts',
            path: {
                'handle': handle,
            },
            query: {
                'page': page,
                'page_size': pageSize,
                'include_locked': includeLocked,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
