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
     * Ccbill Webhook Alias
     * @returns WebhookAck Successful Response
     * @throws ApiError
     */
    public static webhooksCcbillAlias(): CancelablePromise<WebhookAck> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/webhooks/ccbill',
        });
    }
    /**
     * Resend Inbound Webhook
     * Resend webhook receiver for email.received events.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static resendInboundWebhookWebhooksInboundPost(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/webhooks/inbound',
        });
    }
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
}
