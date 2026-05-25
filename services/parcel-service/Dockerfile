# syntax=docker/dockerfile:1.6
#
# Muzima Parcel Service — REST + MCP wrapper over PostGIS parcels.
# Spec: .audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md (Part E §3 + §H).
#
# Multi-stage build preserving the pnpm workspace layout (matches the
# services/api-gateway runner fix in commit 9b75f599 and the
# services/onboarding-orchestrator pattern).

FROM node:20-alpine AS builder
WORKDIR /repo

# Workspace manifests first for cache hits.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/spatial-engine/package.json packages/spatial-engine/tsconfig.json packages/spatial-engine/
COPY packages/spatial-engine/src packages/spatial-engine/src
COPY services/parcel-service/package.json services/parcel-service/tsconfig.json services/parcel-service/
COPY services/parcel-service/src services/parcel-service/src

RUN corepack enable && pnpm install --filter @bossnyumba/parcel-service... --frozen-lockfile
RUN pnpm --filter @bossnyumba/spatial-engine build
RUN pnpm --filter @bossnyumba/parcel-service build

FROM node:20-alpine AS runner
WORKDIR /repo

# Preserve the workspace layout — pnpm-style nested node_modules need it.
COPY --from=builder /repo /repo

ENV NODE_ENV=production
EXPOSE 3017
WORKDIR /repo/services/parcel-service

# Run as non-root user (mirrors infra/k8s/*/securityContext.runAsNonRoot: true)
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /repo
USER app

CMD ["node", "dist/index.js"]
