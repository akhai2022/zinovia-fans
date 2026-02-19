/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BrandAssetsOut } from '../models/BrandAssetsOut';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BrandService {
    /**
     * Get Assets
     * Public: presigned URLs for brand assets (e.g. landing hero). No auth required.
     * @returns BrandAssetsOut Successful Response
     * @throws ApiError
     */
    public static brandAssetsGet(): CancelablePromise<BrandAssetsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/brand/assets',
        });
    }
}
