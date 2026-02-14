FROM node:20-alpine AS base

RUN addgroup -g 10001 appuser && adduser -D -u 10001 -G appuser appuser

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json /app/package.json
COPY apps/web/package.json /app/apps/web/package.json
COPY packages/contracts/package.json /app/packages/contracts/package.json
RUN npm install
# sharp is required for Next.js image optimization in standalone mode.
# Install at root so it is resolvable via Node module resolution from apps/web.
RUN npm install sharp

# Build the app (produces .next with standalone output)
FROM base AS builder
# Default for local compose; override in production: --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ARG NEXT_PUBLIC_API_SAME_ORIGIN_PROXY=false
ENV NEXT_PUBLIC_API_SAME_ORIGIN_PROXY=${NEXT_PUBLIC_API_SAME_ORIGIN_PROXY}
# Canonical app URL for prod (zinovia.ai); optional.
ARG NEXT_PUBLIC_APP_URL=
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
COPY --from=deps /app/node_modules /app/node_modules
COPY package.json /app/package.json
COPY apps/web /app/apps/web
COPY packages/contracts /app/packages/contracts
RUN npm --prefix apps/web run build

# Production runtime: use standalone output with minimal footprint
FROM base AS runtime

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Copy the standalone server (includes minimal node_modules)
COPY --from=builder /app/apps/web/.next/standalone /app

# Copy static assets and public directory (not included in standalone by default)
COPY --from=builder /app/apps/web/.next/static /app/apps/web/.next/static
COPY --from=builder /app/apps/web/public /app/apps/web/public

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 3000

# Use the standalone server.js entry point (supports rewrites, redirects, headers).
# With outputFileTracingRoot=../../ the monorepo layout is preserved:
# /app/apps/web/server.js, /app/node_modules/, /app/apps/web/.next/, etc.
CMD ["node", "apps/web/server.js"]
