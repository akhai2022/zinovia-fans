/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatorRegisterRequest } from '../models/CreatorRegisterRequest';
import type { CreatorRegisterResponse } from '../models/CreatorRegisterResponse';
import type { TokenResponse } from '../models/TokenResponse';
import type { UserCreate } from '../models/UserCreate';
import type { UserLogin } from '../models/UserLogin';
import type { UserOut } from '../models/UserOut';
import type { VerifyEmailRequest } from '../models/VerifyEmailRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AuthService {
    /**
     * Login
     * @param requestBody
     * @returns TokenResponse Successful Response
     * @throws ApiError
     */
    public static authLogin(
        requestBody: UserLogin,
    ): CancelablePromise<TokenResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/login',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Current user
     * Returns the current authenticated user (any role). Use cookie or Bearer token.
     * @returns UserOut Successful Response
     * @throws ApiError
     */
    public static authMe(): CancelablePromise<UserOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/auth/me',
        });
    }
    /**
     * Register
     * @param requestBody
     * @param idempotencyKey
     * @returns CreatorRegisterResponse Successful Response
     * @throws ApiError
     */
    public static authRegister(
        requestBody: CreatorRegisterRequest,
        idempotencyKey?: (string | null),
    ): CancelablePromise<CreatorRegisterResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/register',
            headers: {
                'Idempotency-Key': idempotencyKey,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Signup
     * @param requestBody
     * @returns UserOut Successful Response
     * @throws ApiError
     */
    public static authSignup(
        requestBody: UserCreate,
    ): CancelablePromise<UserOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/signup',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Verify Email
     * @param requestBody
     * @param idempotencyKey
     * @returns any Successful Response
     * @throws ApiError
     */
    public static authVerifyEmail(
        requestBody: VerifyEmailRequest,
        idempotencyKey?: (string | null),
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/verify-email',
            headers: {
                'Idempotency-Key': idempotencyKey,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
