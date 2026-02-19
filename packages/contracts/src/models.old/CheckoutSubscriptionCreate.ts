/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Start subscription checkout for a creator. Provide creator_id or creator_handle. success_url/cancel_url optional (from env).
 */
export type CheckoutSubscriptionCreate = {
    cancel_url?: (string | null);
    creator_handle?: (string | null);
    creator_id?: (string | null);
    success_url?: (string | null);
};

