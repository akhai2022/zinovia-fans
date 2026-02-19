/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { KycSessionResponse } from '../models/KycSessionResponse';
import type { KycStatusResponse } from '../models/KycStatusResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class KycService {
    /**
     * Mock Kyc Complete
     * Simulate KYC provider completion. Available in local/staging or when ENABLE_MOCK_KYC=true.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static kycMockComplete(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/kyc/mock-complete',
        });
    }
    /**
     * Create Kyc Session
     * @param idempotencyKey
     * @returns KycSessionResponse Successful Response
     * @throws ApiError
     */
    public static kycCreateSession(
        idempotencyKey?: (string | null),
    ): CancelablePromise<KycSessionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/kyc/session',
            headers: {
                'Idempotency-Key': idempotencyKey,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Kyc Status
     * @returns KycStatusResponse Successful Response
     * @throws ApiError
     */
    public static kycStatus(): CancelablePromise<KycStatusResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/kyc/status',
        });
    }
}
