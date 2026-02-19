/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LedgerEntryCreate } from '../models/LedgerEntryCreate';
import type { LedgerEntryOut } from '../models/LedgerEntryOut';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class LedgerService {
    /**
     * Create ledger entry (admin)
     * Admin-only. For internal tooling (e.g. balance adjustments). Not used by the web app.
     * @param requestBody
     * @returns LedgerEntryOut Successful Response
     * @throws ApiError
     */
    public static ledgerCreateEntry(
        requestBody: LedgerEntryCreate,
    ): CancelablePromise<LedgerEntryOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/ledger/entries',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
