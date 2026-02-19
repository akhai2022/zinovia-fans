/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PpvCreateIntent } from '../models/PpvCreateIntent';
import type { PpvIntentOut } from '../models/PpvIntentOut';
import type { TipCreateIntent } from '../models/TipCreateIntent';
import type { TipIntentOut } from '../models/TipIntentOut';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class PaymentsService {
    /**
     * Ppv Create Intent
     * @param requestBody
     * @returns PpvIntentOut Successful Response
     * @throws ApiError
     */
    public static ppvCreateIntentPaymentsPpvCreateIntentPost(
        requestBody: PpvCreateIntent,
    ): CancelablePromise<PpvIntentOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/payments/ppv/create-intent',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Tip Create Intent
     * @param requestBody
     * @returns TipIntentOut Successful Response
     * @throws ApiError
     */
    public static tipCreateIntentPaymentsTipsCreateIntentPost(
        requestBody: TipCreateIntent,
    ): CancelablePromise<TipIntentOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/payments/tips/create-intent',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
