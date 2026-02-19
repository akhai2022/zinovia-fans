/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Single ledger event (transaction).
 */
export type LedgerEventOut = {
    created_at: string;
    currency: string;
    fee_cents: number;
    gross_cents: number;
    id: string;
    net_cents: number;
    reference_id: (string | null);
    reference_type: (string | null);
    type: string;
};

