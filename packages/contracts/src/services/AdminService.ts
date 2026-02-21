/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AdminCreatorAction } from '../models/AdminCreatorAction';
import type { AdminCreatorPage } from '../models/AdminCreatorPage';
import type { AdminPostAction } from '../models/AdminPostAction';
import type { AdminPostPage } from '../models/AdminPostPage';
import type { AdminTransactionPage } from '../models/AdminTransactionPage';
import type { AdminUserAction } from '../models/AdminUserAction';
import type { AdminUserDetailOut } from '../models/AdminUserDetailOut';
import type { AdminUserPage } from '../models/AdminUserPage';
import type { AdminUserPostPage } from '../models/AdminUserPostPage';
import type { AdminUserSubscriberPage } from '../models/AdminUserSubscriberPage';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdminService {
    /**
     * List Creators
     * @param page
     * @param pageSize
     * @param role
     * @param discoverable
     * @returns AdminCreatorPage Successful Response
     * @throws ApiError
     */
    public static adminListCreators(
        page: number = 1,
        pageSize: number = 20,
        role?: (string | null),
        discoverable?: (boolean | null),
    ): CancelablePromise<AdminCreatorPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/admin/creators',
            query: {
                'page': page,
                'page_size': pageSize,
                'role': role,
                'discoverable': discoverable,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Action Creator
     * @param userId
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static adminActionCreator(
        userId: string,
        requestBody: AdminCreatorAction,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/admin/creators/{user_id}/action',
            path: {
                'user_id': userId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Force-verify a creator's email (skip email delivery)
     * Consumes the latest verification token and transitions the creator's onboarding state to EMAIL_VERIFIED. Use this when SES is not working and you need to unblock a creator.
     * @param email Creator email to verify
     * @returns any Successful Response
     * @throws ApiError
     */
    public static adminForceVerifyEmail(
        email: string,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/admin/force-verify-email',
            query: {
                'email': email,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Posts
     * @param page
     * @param pageSize
     * @returns AdminPostPage Successful Response
     * @throws ApiError
     */
    public static adminListPosts(
        page: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<AdminPostPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/admin/posts',
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
     * Action Post
     * @param postId
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static adminActionPost(
        postId: string,
        requestBody: AdminPostAction,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/admin/posts/{post_id}/action',
            path: {
                'post_id': postId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get pending verification/reset tokens for a user by email
     * Returns the latest email verification token and password reset token for the given email. Requires admin role. Use this when SES is not delivering emails and you need to complete the onboarding flow manually.
     * @param email User email to look up
     * @returns any Successful Response
     * @throws ApiError
     */
    public static adminGetTokens(
        email: string,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/admin/tokens',
            query: {
                'email': email,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Transactions
     * @param page
     * @param pageSize
     * @param type
     * @returns AdminTransactionPage Successful Response
     * @throws ApiError
     */
    public static adminListTransactions(
        page: number = 1,
        pageSize: number = 20,
        type?: (string | null),
    ): CancelablePromise<AdminTransactionPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/admin/transactions',
            query: {
                'page': page,
                'page_size': pageSize,
                'type': type,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Users
     * @param page
     * @param pageSize
     * @param search
     * @param role
     * @returns AdminUserPage Successful Response
     * @throws ApiError
     */
    public static adminListUsers(
        page: number = 1,
        pageSize: number = 20,
        search?: (string | null),
        role?: (string | null),
    ): CancelablePromise<AdminUserPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/admin/users',
            query: {
                'page': page,
                'page_size': pageSize,
                'search': search,
                'role': role,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get User
     * @param userId
     * @returns AdminUserDetailOut Successful Response
     * @throws ApiError
     */
    public static adminGetUser(
        userId: string,
    ): CancelablePromise<AdminUserDetailOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/admin/users/{user_id}',
            path: {
                'user_id': userId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Action User
     * @param userId
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static adminActionUser(
        userId: string,
        requestBody: AdminUserAction,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/admin/users/{user_id}/action',
            path: {
                'user_id': userId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List User Posts
     * @param userId
     * @param page
     * @param pageSize
     * @returns AdminUserPostPage Successful Response
     * @throws ApiError
     */
    public static adminListUserPosts(
        userId: string,
        page: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<AdminUserPostPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/admin/users/{user_id}/posts',
            path: {
                'user_id': userId,
            },
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
     * List User Subscribers
     * @param userId
     * @param page
     * @param pageSize
     * @returns AdminUserSubscriberPage Successful Response
     * @throws ApiError
     */
    public static adminListUserSubscribers(
        userId: string,
        page: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<AdminUserSubscriberPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/admin/users/{user_id}/subscribers',
            path: {
                'user_id': userId,
            },
            query: {
                'page': page,
                'page_size': pageSize,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
