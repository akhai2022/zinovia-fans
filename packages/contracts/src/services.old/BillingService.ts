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
import type { WebhookAck } from '../models/WebhookAck';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BillingService {
    /**
     * Checkout Subscription
     * Start Stripe Checkout for subscribing to a creator. Returns URL to redirect the fan. 501 if Stripe not configured.
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
     * Get creator subscription plan
     * Returns the authenticated creator's current subscription plan and pricing bounds.
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
     * Update subscription price
     * Set a new monthly subscription price. Creates a new Stripe Price; existing subscribers keep their current rate until renewal.
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
     * Create Stripe Customer Portal session
     * Returns a URL to the Stripe Customer Portal for managing subscriptions.
     * @param returnUrl
     * @returns any Successful Response
     * @throws ApiError
     */
    public static billingPortal(
        returnUrl?: (string | null),
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/billing/portal',
            query: {
                'return_url': returnUrl,
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
     * Cancel a subscription at period end. Fan retains access until current_period_end.
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
     * Stripe Webhook
     * Stripe webhook: signature verified, idempotent by event id. Store event then process; set processed_at.
     * @param stripeSignature
     * @returns WebhookAck Successful Response
     * @throws ApiError
     */
    public static billingWebhooksStripe(
        stripeSignature?: (string | null),
    ): CancelablePromise<WebhookAck> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/billing/webhooks/stripe',
            headers: {
                'Stripe-Signature': stripeSignature,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
