/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Stripe Connect payout method status (or not configured).
 */
export type PayoutMethodStatus = {
    charges_enabled?: boolean;
    /**
     * True if Stripe Connect is set up for this creator
     */
    configured?: boolean;
    payouts_enabled?: boolean;
    /**
     * Stripe requirements summary when account has pending items
     */
    requirements_due?: (Record<string, any> | null);
    stripe_account_id?: (string | null);
};

