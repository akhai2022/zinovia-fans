/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EarningsSummary } from './EarningsSummary';
import type { LedgerEventOut } from './LedgerEventOut';
import type { PayoutMethodStatus } from './PayoutMethodStatus';
/**
 * Full earnings response for creator dashboard.
 */
export type CreatorEarningsOut = {
    last_transactions: Array<LedgerEventOut>;
    payout_method: PayoutMethodStatus;
    summary: EarningsSummary;
};

