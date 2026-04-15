# =============================================================================
# BOSSNYUMBA Notifications Service - Multi-stage Dockerfile
# =============================================================================
# Build from repo root:
#   docker build -f services/notifications/Dockerfile -t bossnyumba-notifications .
# =============================================================================

# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY .npmrc ./

# Copy shared packages and all services (workspace resolution needs siblings)
COPY packages ./packages
COPY services ./services

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/pnpm-lock.yaml ./
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY --from=deps /app/.npmrc ./
COPY tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY services ./services

# Build the notifications service (resolves workspace name from package.json)
RUN pnpm --filter @bossnyumba/notifications-service build

# =============================================================================
# Stage 3: Runtime
# =============================================================================
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init wget curl

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 notifications

WORKDIR /app

# Copy only what's needed at runtime
COPY --from=builder --chown=notifications:nodejs /app/services/notifications/dist ./dist
COPY --from=builder --chown=notifications:nodejs /app/services/notifications/package.json ./package.json
COPY --from=builder --chown=notifications:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=notifications:nodejs /app/packages ./packages

USER notifications

ENV NODE_ENV=production
ENV PORT=4100
ENV SERVICE_NAME=notifications

EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:4100/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
