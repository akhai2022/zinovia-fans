import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@zinovia/contracts"],
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1440, 1920, 2560],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // In a monorepo the standalone trace must start at the repo root so that
  // node_modules installed there (next, react, sharp, etc.) are included.
  experimental: {
    outputFileTracingRoot: join(__dirname, "../../"),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      // Long-cache static assets (next/image, JS chunks, fonts)
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/image/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/assets/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
  async rewrites() {
    const upstream =
      process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
      "http://127.0.0.1:8000";
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${upstream}/:path*`,
        },
      ],
      // Fallback: short creator URLs — only triggers when no real page matches.
      // Allows creators to share https://zinovia.ai/<handle>
      fallback: [
        {
          source: "/:handle",
          destination: "/creators/:handle",
        },
      ],
    };
  },
};

export default nextConfig;
