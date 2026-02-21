/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatorEarningsOut } from '../models/CreatorEarningsOut';
import type { PayoutSetupLinkOut } from '../models/PayoutSetupLinkOut';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CreatorService {
    /**
     * Creator earnings
     * Returns gross/fees/net summary, last transactions, and payout method status.
     * @param days Time range in days for summary
     * @param limit Max transactions to return
     * @returns CreatorEarningsOut Successful Response
     * @throws ApiError
     */
    public static creatorGetEarnings(
        days: number = 30,
        limit: number = 20,
    ): CancelablePromise<CreatorEarningsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/creator/earnings',
            query: {
                'days': days,
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Payout setup link
     * Returns payout setup link. Currently not configured — placeholder for future integration.
     * @returns PayoutSetupLinkOut Successful Response
     * @throws ApiError
     */
    public static creatorPayoutsSetupLink(): CancelablePromise<PayoutSetupLinkOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/creator/payouts/setup-link',
        });
    }
}
