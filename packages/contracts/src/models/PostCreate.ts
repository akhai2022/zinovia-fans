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
    /**
     * Currency code (defaults to platform default).
     */
    currency?: (string | null);
    nsfw?: boolean;
    /**
     * Required when visibility=PPV. Price in cents.
     */
    price_cents?: (number | null);
    publish_at?: (string | null);
    type: string;
    visibility: string;
};

