/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CheckoutSubscriptionCreate } from '../models/CheckoutSubscriptionCreate';
import type { CheckoutSubscriptionOut } from '../models/CheckoutSubscriptionOut';
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
