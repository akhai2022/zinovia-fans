/**
 * AI image generation API.
 * Uses apiFetch until regenerated contracts include these endpoints.
 */

import { apiFetch } from "@/lib/apiFetch";

export type AiImageGenerateIn = {
  image_type: "HERO" | "AVATAR" | "BANNER";
  preset: string;
  subject?: string | null;
  vibe?: string | null;
  accent_color?: string | null;
  count?: number;
};

export type AiImageGenerateOut = {
  job_id: string;
};

export type AiImageJobOut = {
  id: string;
  status: string;
  image_type: string;
  prompt_preview?: string | null;
  result_urls: string[];
};

export type AiImageApplyIn = {
  apply_to: "landing.hero" | "creator.avatar" | "creator.banner";
  result_index?: number;
};

export type AiImageApplyOut = {
  applied_to: string;
  object_key: string;
  public_url: string;
};

export type BrandAssetsOut = {
  landing_hero?: string | null;
};

export const AiImagesService = {
  generate: (body: AiImageGenerateIn) =>
    apiFetch<AiImageGenerateOut>("/ai/images/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  get: (jobId: string) =>
    apiFetch<AiImageJobOut>(`/ai/images/${jobId}`),

  list: () =>
    apiFetch<AiImageJobOut[]>("/ai/images"),

  apply: (jobId: string, body: AiImageApplyIn) =>
    apiFetch<AiImageApplyOut>(`/ai/images/${jobId}/apply`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const BrandAssetsService = {
  get: () =>
    apiFetch<BrandAssetsOut>("/brand/assets"),
};
