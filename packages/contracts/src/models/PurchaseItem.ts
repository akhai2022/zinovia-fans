/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A single purchase (PPV post or PPV message).
 */
export type PurchaseItem = {
    amount_cents: number;
    created_at: string;
    creator_display_name?: (string | null);
    creator_handle?: (string | null);
    currency: string;
    id: string;
    post_id?: (string | null);
    status: string;
    transaction_id?: (string | null);
    /**
     * PPV_POST or PPV_MESSAGE or SUBSCRIPTION or TIP
     */
    type: string;
};

