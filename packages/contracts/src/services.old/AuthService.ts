/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatorRegisterRequest } from '../models/CreatorRegisterRequest';
import type { CreatorRegisterResponse } from '../models/CreatorRegisterResponse';
import type { ResendVerificationEmailRequest } from '../models/ResendVerificationEmailRequest';
import type { ResetPasswordRequest } from '../models/ResetPasswordRequest';
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
     * [DEV ONLY] Get verification/reset tokens for a user
     * Returns the latest email verification and password reset tokens for a given email. Only available in local/staging environments. Disabled in production.
     * @param email
     * @returns any Successful Response
     * @throws ApiError
     */
    public static authDevTokens(
        email: string = '',
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/auth/dev/tokens',
            query: {
                'email': email,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Request password reset
     * Sends a reset email if the address is registered. Always returns 200 to prevent user enumeration.
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static authForgotPassword(
        requestBody: UserLogin,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/forgot-password',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
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
     * Logout
     * Clears the session cookie. Frontend should call this then setUser(null).
     * @returns any Successful Response
     * @throws ApiError
     */
    public static authLogout(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/logout',
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
     * Resend verification email (safe)
     * Requests a new verification email. Always returns 200 to avoid user enumeration. Rate-limited by IP+email.
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static authResendVerificationEmail(
        requestBody: ResendVerificationEmailRequest,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/resend-verification-email',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Reset password using token
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static authResetPassword(
        requestBody: ResetPasswordRequest,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/reset-password',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Current session
     * Alias of /auth/me for frontend session checks.
     * @returns UserOut Successful Response
     * @throws ApiError
     */
    public static authSession(): CancelablePromise<UserOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/auth/session',
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
