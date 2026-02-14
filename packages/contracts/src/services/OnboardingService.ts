/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OnboardingStatusResponse } from '../models/OnboardingStatusResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class OnboardingService {
    /**
     * Get Status
     * @returns OnboardingStatusResponse Successful Response
     * @throws ApiError
     */
    public static onboardingStatus(): CancelablePromise<OnboardingStatusResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/onboarding/status',
        });
    }
}
