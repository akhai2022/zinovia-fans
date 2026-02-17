import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/settings/",
          "/messages/",
          "/billing/",
          "/onboarding/",
          "/me/",
          "/creator/",
          "/verify-email/",
          "/reset-password/",
          "/forgot-password/",
          "/ai/",
          "/notifications/",
        ],
      },
    ],
    sitemap: "https://zinovia.ai/sitemap.xml",
  };
}
