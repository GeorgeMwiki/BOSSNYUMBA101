# syntax=docker/dockerfile:1.6
#
# BOSSNYUMBA Outcomes Metering Service.
#
# Wraps `@bossnyumba/outcomes` (pure scorers) with a Fastify HTTP entry
# point + a BrainEventBus consumer. Subscribes to `lease.signed`,
# `payment.received`, `ticket.resolved` and emits idempotent
# MeteringRecords into the `outcome_billing_lines` table for the
# billing engine to aggregate monthly.
#
# Multi-stage build preserving the pnpm workspace layout — mirrors the
# `services/parcel-service` and `services/api-gateway` runner patterns.

FROM node:20-alpine AS builder
WORKDIR /repo

# Workspace manifests first for cache hits.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/outcomes/package.json packages/outcomes/tsconfig.json packages/outcomes/
COPY packages/outcomes/src packages/outcomes/src
COPY packages/ai-copilot/package.json packages/ai-copilot/tsconfig.json packages/ai-copilot/
COPY packages/ai-copilot/src packages/ai-copilot/src
COPY services/outcomes-metering/package.json services/outcomes-metering/tsconfig.json services/outcomes-metering/
COPY services/outcomes-metering/src services/outcomes-metering/src

RUN corepack enable && pnpm install --filter @bossnyumba/outcomes-metering-service... --frozen-lockfile
RUN pnpm --filter @bossnyumba/outcomes build
RUN pnpm --filter @bossnyumba/ai-copilot build
RUN pnpm --filter @bossnyumba/outcomes-metering-service build

FROM node:20-alpine AS runner
WORKDIR /repo

# Preserve the workspace layout — pnpm-style nested node_modules need it.
COPY --from=builder /repo /repo

ENV NODE_ENV=production
EXPOSE 3018
WORKDIR /repo/services/outcomes-metering
CMD ["node", "dist/index.js"]
