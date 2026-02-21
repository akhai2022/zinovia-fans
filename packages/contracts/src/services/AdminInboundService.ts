/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InboundEmailDetail } from '../models/InboundEmailDetail';
import type { InboundEmailPage } from '../models/InboundEmailPage';
import type { InboundStatsOut } from '../models/InboundStatsOut';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdminInboundService {
    /**
     * List Emails
     * @param page
     * @param pageSize
     * @param category
     * @param isRead
     * @returns InboundEmailPage Successful Response
     * @throws ApiError
     */
    public static adminListInbound(
        page: number = 1,
        pageSize: number = 20,
        category?: (string | null),
        isRead?: (boolean | null),
    ): CancelablePromise<InboundEmailPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/admin/inbound/emails',
            query: {
                'page': page,
                'page_size': pageSize,
                'category': category,
                'is_read': isRead,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Email Stats
     * @returns InboundStatsOut Successful Response
     * @throws ApiError
     */
    public static adminInboundStats(): CancelablePromise<InboundStatsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/admin/inbound/emails/stats',
        });
    }
    /**
     * Get Email
     * @param emailId
     * @returns InboundEmailDetail Successful Response
     * @throws ApiError
     */
    public static adminGetInbound(
        emailId: string,
    ): CancelablePromise<InboundEmailDetail> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/admin/inbound/emails/{email_id}',
            path: {
                'email_id': emailId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Toggle Read
     * @param emailId
     * @param read
     * @returns any Successful Response
     * @throws ApiError
     */
    public static adminMarkInboundRead(
        emailId: string,
        read: boolean = true,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/admin/inbound/emails/{email_id}/read',
            path: {
                'email_id': emailId,
            },
            query: {
                'read': read,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Trigger Sync
     * Manually trigger a sync from Resend Receiving API.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static adminSyncInbound(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/admin/inbound/sync',
        });
    }
}
