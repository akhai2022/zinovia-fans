/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NotificationPageOut } from '../models/NotificationPageOut';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class NotificationsService {
    /**
     * List Notifications
     * @param cursor
     * @param pageSize
     * @returns NotificationPageOut Successful Response
     * @throws ApiError
     */
    public static notificationsList(
        cursor?: (string | null),
        pageSize: number = 30,
    ): CancelablePromise<NotificationPageOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/notifications',
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
     * Read All Notifications
     * @returns number Successful Response
     * @throws ApiError
     */
    public static notificationsMarkReadAll(): CancelablePromise<Record<string, number>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/notifications/read-all',
        });
    }
    /**
     * Read Notification
     * @param notificationId
     * @returns string Successful Response
     * @throws ApiError
     */
    public static notificationsMarkRead(
        notificationId: string,
    ): CancelablePromise<Record<string, string>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/notifications/{notification_id}/read',
            path: {
                'notification_id': notificationId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
