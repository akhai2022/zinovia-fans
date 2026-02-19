/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PostCommentCreate } from '../models/PostCommentCreate';
import type { PostCommentOut } from '../models/PostCommentOut';
import type { PostCommentPageOut } from '../models/PostCommentPageOut';
import type { PostCreate } from '../models/PostCreate';
import type { PostLikeSummary } from '../models/PostLikeSummary';
import type { PostOut } from '../models/PostOut';
import type { PostSearchPage } from '../models/PostSearchPage';
import type { PostUpdate } from '../models/PostUpdate';
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
    /**
     * Comment Delete
     * @param commentId
     * @returns string Successful Response
     * @throws ApiError
     */
    public static postsCommentDelete(
        commentId: string,
    ): CancelablePromise<Record<string, string>> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/posts/comments/{comment_id}',
            path: {
                'comment_id': commentId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Search
     * Search public posts by caption (trigram GIN index).
     * @param q Search query
     * @param page
     * @param pageSize
     * @returns PostSearchPage Successful Response
     * @throws ApiError
     */
    public static postsSearch(
        q: string,
        page: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<PostSearchPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/posts/search',
            query: {
                'q': q,
                'page': page,
                'page_size': pageSize,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete
     * @param postId
     * @returns void
     * @throws ApiError
     */
    public static postsDelete(
        postId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/posts/{post_id}',
            path: {
                'post_id': postId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update
     * @param postId
     * @param requestBody
     * @returns PostOut Successful Response
     * @throws ApiError
     */
    public static postsUpdate(
        postId: string,
        requestBody: PostUpdate,
    ): CancelablePromise<PostOut> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/posts/{post_id}',
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
     * Comment List
     * @param postId
     * @param cursor
     * @param pageSize
     * @returns PostCommentPageOut Successful Response
     * @throws ApiError
     */
    public static postsCommentList(
        postId: string,
        cursor?: (string | null),
        pageSize: number = 30,
    ): CancelablePromise<PostCommentPageOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/posts/{post_id}/comments',
            path: {
                'post_id': postId,
            },
            query: {
                'cursor': cursor,
                'page_size': pageSize,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Comment Create
     * @param postId
     * @param requestBody
     * @returns PostCommentOut Successful Response
     * @throws ApiError
     */
    public static postsCommentCreate(
        postId: string,
        requestBody: PostCommentCreate,
    ): CancelablePromise<PostCommentOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/posts/{post_id}/comments',
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
     * Unlike
     * @param postId
     * @returns string Successful Response
     * @throws ApiError
     */
    public static postsUnlike(
        postId: string,
    ): CancelablePromise<Record<string, string>> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/posts/{post_id}/like',
            path: {
                'post_id': postId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Like
     * @param postId
     * @returns string Successful Response
     * @throws ApiError
     */
    public static postsLike(
        postId: string,
    ): CancelablePromise<Record<string, string>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/posts/{post_id}/like',
            path: {
                'post_id': postId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Likes
     * @param postId
     * @returns PostLikeSummary Successful Response
     * @throws ApiError
     */
    public static postsLikeSummary(
        postId: string,
    ): CancelablePromise<PostLikeSummary> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/posts/{post_id}/likes',
            path: {
                'post_id': postId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Publish Now
     * @param postId
     * @returns PostOut Successful Response
     * @throws ApiError
     */
    public static postsPublishNow(
        postId: string,
    ): CancelablePromise<PostOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/posts/{post_id}/publish-now',
            path: {
                'post_id': postId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
