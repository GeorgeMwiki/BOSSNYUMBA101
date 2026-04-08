# =============================================================================
# BOSSNYUMBA Retention Worker - Multi-stage Dockerfile
# =============================================================================
# Build from the repo root:
#   docker build -f services/retention-worker/Dockerfile -t bossnyumba/retention-worker .
#
# The worker is a long-lived cron container. It does NOT expose a network
# port; health is observed via the audit log stream and container runtime.
# =============================================================================

# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY .npmrc ./

# Copy shared packages (retention-worker depends on database + enterprise-hardening)
COPY packages ./packages

# Copy the service itself
COPY services/retention-worker ./services/retention-worker

# Install dependencies for the whole workspace (pnpm hoists shared deps)
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
COPY tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY services/retention-worker ./services/retention-worker

RUN pnpm --filter=@bossnyumba/retention-worker build

# =============================================================================
# Stage 3: Production Runner
# =============================================================================
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init tini

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 retention

WORKDIR /app

# Copy built artifacts and production deps
COPY --from=builder --chown=retention:nodejs /app/services/retention-worker/dist ./dist
COPY --from=builder --chown=retention:nodejs /app/services/retention-worker/package.json ./
COPY --from=builder --chown=retention:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=retention:nodejs /app/packages ./packages

USER retention

ENV NODE_ENV=production
ENV SERVICE_NAME=retention-worker
# Default sweep window: 02:00 UTC daily. Override via env without a rebuild.
ENV RETENTION_CRON_SCHEDULE="0 2 * * *"
ENV RETENTION_CRON_TZ="UTC"
ENV LOG_LEVEL=info

# No EXPOSE: the worker is a cron daemon, not an HTTP service.

# Liveness: container is healthy as long as the node process is alive.
# A future improvement is a heartbeat file written by the cron tick.
HEALTHCHECK --interval=5m --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "node dist/index.js" >/dev/null || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
