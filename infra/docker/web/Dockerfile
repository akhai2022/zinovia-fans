FROM node:20-alpine AS base

RUN addgroup -g 10001 appuser && adduser -D -u 10001 -G appuser appuser

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json /app/package.json
COPY apps/web/package.json /app/apps/web/package.json
COPY packages/contracts/package.json /app/packages/contracts/package.json
RUN npm install

# Build the app (produces .next)
FROM base AS builder
# Default for local compose; override in production: --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY --from=deps /app/node_modules /app/node_modules
COPY package.json /app/package.json
COPY apps/web /app/apps/web
COPY packages/contracts /app/packages/contracts
RUN npm --prefix apps/web run build

# Production runtime: copy artifacts with correct ownership, run as non-root
FROM base AS runtime
COPY --from=deps /app/node_modules /app/node_modules
COPY package.json /app/package.json
COPY --from=builder /app/apps/web /app/apps/web
COPY packages/contracts /app/packages/contracts
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 3000

CMD ["npm", "--prefix", "apps/web", "run", "start"]
