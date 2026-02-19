/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Update post body (partial).
 */
export type PostUpdate = {
    caption?: (string | null);
    visibility?: (string | null);
    /**
     * Required when visibility=PPV.
     */
    price_cents?: (number | null);
};

