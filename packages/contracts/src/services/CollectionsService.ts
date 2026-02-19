/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CollectionCreate } from '../models/CollectionCreate';
import type { CollectionOut } from '../models/CollectionOut';
import type { CollectionPage } from '../models/CollectionPage';
import type { CollectionPostAdd } from '../models/CollectionPostAdd';
import type { CollectionPostOut } from '../models/CollectionPostOut';
import type { CollectionUpdate } from '../models/CollectionUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CollectionsService {
    /**
     * List All
     * @returns CollectionPage Successful Response
     * @throws ApiError
     */
    public static collectionsList(): CancelablePromise<CollectionPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/collections',
        });
    }
    /**
     * Create
     * @param requestBody
     * @returns CollectionOut Successful Response
     * @throws ApiError
     */
    public static collectionsCreate(
        requestBody: CollectionCreate,
    ): CancelablePromise<CollectionOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/collections',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete
     * @param collectionId
     * @returns void
     * @throws ApiError
     */
    public static collectionsDelete(
        collectionId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/collections/{collection_id}',
            path: {
                'collection_id': collectionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get
     * @param collectionId
     * @returns CollectionOut Successful Response
     * @throws ApiError
     */
    public static collectionsGet(
        collectionId: string,
    ): CancelablePromise<CollectionOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/collections/{collection_id}',
            path: {
                'collection_id': collectionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update
     * @param collectionId
     * @param requestBody
     * @returns CollectionOut Successful Response
     * @throws ApiError
     */
    public static collectionsUpdate(
        collectionId: string,
        requestBody: CollectionUpdate,
    ): CancelablePromise<CollectionOut> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/collections/{collection_id}',
            path: {
                'collection_id': collectionId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Posts
     * @param collectionId
     * @returns CollectionPostOut Successful Response
     * @throws ApiError
     */
    public static collectionsListPosts(
        collectionId: string,
    ): CancelablePromise<Array<CollectionPostOut>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/collections/{collection_id}/posts',
            path: {
                'collection_id': collectionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Add Post
     * @param collectionId
     * @param requestBody
     * @returns CollectionPostOut Successful Response
     * @throws ApiError
     */
    public static collectionsAddPost(
        collectionId: string,
        requestBody: CollectionPostAdd,
    ): CancelablePromise<CollectionPostOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/collections/{collection_id}/posts',
            path: {
                'collection_id': collectionId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Remove Post
     * @param collectionId
     * @param postId
     * @returns void
     * @throws ApiError
     */
    public static collectionsRemovePost(
        collectionId: string,
        postId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/collections/{collection_id}/posts/{post_id}',
            path: {
                'collection_id': collectionId,
                'post_id': postId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
