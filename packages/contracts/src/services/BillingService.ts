/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BillingHealthOut } from '../models/BillingHealthOut';
import type { BillingStatusOut } from '../models/BillingStatusOut';
import type { CancelSubscriptionOut } from '../models/CancelSubscriptionOut';
import type { CheckoutSubscriptionCreate } from '../models/CheckoutSubscriptionCreate';
import type { CheckoutSubscriptionOut } from '../models/CheckoutSubscriptionOut';
import type { CreatorPlanOut } from '../models/CreatorPlanOut';
import type { CreatorPlanUpdate } from '../models/CreatorPlanUpdate';
import type { PurchaseHistoryOut } from '../models/PurchaseHistoryOut';
import type { WebhookAck } from '../models/WebhookAck';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BillingService {
    /**
     * Checkout Subscription
     * Start CCBill checkout for subscribing to a creator. Returns URL to redirect the fan.
     * @param requestBody
     * @returns CheckoutSubscriptionOut Successful Response
     * @throws ApiError
     */
    public static billingCheckoutSubscription(
        requestBody: CheckoutSubscriptionCreate,
    ): CancelablePromise<CheckoutSubscriptionOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/billing/checkout/subscription',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Billing Health
     * @returns BillingHealthOut Successful Response
     * @throws ApiError
     */
    public static billingHealth(): CancelablePromise<BillingHealthOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/billing/health',
        });
    }
    /**
     * Get Plan
     * @returns CreatorPlanOut Successful Response
     * @throws ApiError
     */
    public static billingGetPlan(): CancelablePromise<CreatorPlanOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/billing/plan',
        });
    }
    /**
     * Update Plan
     * @param requestBody
     * @returns CreatorPlanOut Successful Response
     * @throws ApiError
     */
    public static billingUpdatePlan(
        requestBody: CreatorPlanUpdate,
    ): CancelablePromise<CreatorPlanOut> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/billing/plan',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Purchases
     * List all purchases (PPV posts, PPV messages, tips) for the current fan.
     * @param limit
     * @returns PurchaseHistoryOut Successful Response
     * @throws ApiError
     */
    public static billingPurchases(
        limit: number = 50,
    ): CancelablePromise<PurchaseHistoryOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/billing/purchases',
            query: {
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Billing Status
     * @param creatorUserId
     * @returns BillingStatusOut Successful Response
     * @throws ApiError
     */
    public static billingStatus(
        creatorUserId?: (string | null),
    ): CancelablePromise<BillingStatusOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/billing/status',
            query: {
                'creator_user_id': creatorUserId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Cancel Subscription Endpoint
     * Cancel a subscription at period end.
     * @param subscriptionId
     * @returns CancelSubscriptionOut Successful Response
     * @throws ApiError
     */
    public static billingCancelSubscription(
        subscriptionId: string,
    ): CancelablePromise<CancelSubscriptionOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/billing/subscriptions/{subscription_id}/cancel',
            path: {
                'subscription_id': subscriptionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Ccbill Webhook
     * CCBill webhook: verify digest, idempotent by event id.
     * @returns WebhookAck Successful Response
     * @throws ApiError
     */
    public static billingWebhooksCcbill(): CancelablePromise<WebhookAck> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/billing/webhooks/ccbill',
        });
    }
}
