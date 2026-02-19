/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Gross, fees, net for a time range (cents).
 */
export type EarningsSummary = {
    currency?: string;
    /**
     * Platform fees in minor units
     */
    fee_cents: number;
    /**
     * Total gross in minor units
     */
    gross_cents: number;
    /**
     * Net after fees in minor units
     */
    net_cents: number;
};

