/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ContactFormRequest } from '../models/ContactFormRequest';
import type { ContactFormResponse } from '../models/ContactFormResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ContactService {
    /**
     * Submit Contact Form
     * Public contact form — no auth required. Rate-limited by IP.
     * @param requestBody
     * @returns ContactFormResponse Successful Response
     * @throws ApiError
     */
    public static submitContactFormContactPost(
        requestBody: ContactFormRequest,
    ): CancelablePromise<ContactFormResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/contact',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
