/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Create post body.
 */
export type PostCreate = {
    asset_ids?: Array<string>;
    caption?: (string | null);
    nsfw?: boolean;
    publish_at?: (string | null);
    type: string;
    visibility: string;
    /**
     * Required when visibility=PPV. Price in cents.
     */
    price_cents?: (number | null);
    /**
     * Currency code (defaults to platform default).
     */
    currency?: (string | null);
};

