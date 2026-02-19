/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Current creator subscription plan.
 */
export type CreatorPlanOut = {
    active: boolean;
    currency: string;
    /**
     * Maximum allowed price in cents
     */
    max_price_cents: number;
    /**
     * Minimum allowed price in cents
     */
    min_price_cents: number;
    /**
     * Platform fee deducted from each payment
     */
    platform_fee_percent: number;
    /**
     * Monthly price in major currency units (e.g. 4.99)
     */
    price: string;
};

