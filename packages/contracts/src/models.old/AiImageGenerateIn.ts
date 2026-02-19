/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Request body for POST /ai/images/generate.
 */
export type AiImageGenerateIn = {
    accent_color?: (string | null);
    count?: number;
    image_type: string;
    preset: string;
    subject?: (string | null);
    vibe?: (string | null);
};

