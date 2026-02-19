/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WebhookAck } from '../models/WebhookAck';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class WebhooksService {
    /**
     * Kyc Webhook
     * @returns any Successful Response
     * @throws ApiError
     */
    public static webhooksKyc(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/webhooks/kyc',
        });
    }
    /**
     * Stripe Webhook Alias
     * @param stripeSignature
     * @returns WebhookAck Successful Response
     * @throws ApiError
     */
    public static webhooksStripeAlias(
        stripeSignature?: (string | null),
    ): CancelablePromise<WebhookAck> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/webhooks/stripe',
            headers: {
                'Stripe-Signature': stripeSignature,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
