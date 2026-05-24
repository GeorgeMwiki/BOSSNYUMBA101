# syntax=docker/dockerfile:1.6
#
# Onboarding Orchestrator — conversational MD onboarding crew.
# See `.audit/litfin-sota-2026-05-23/20-zero-friction-onboarding.md` §12.
#
# Multi-stage build preserving the pnpm workspace layout (matches the
# `services/api-gateway` runner fix in commit 9b75f599).

FROM node:20-alpine AS builder
WORKDIR /repo

# Workspace manifests first for cache hits.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY services/onboarding-orchestrator/package.json services/onboarding-orchestrator/tsconfig.json services/onboarding-orchestrator/
COPY services/onboarding-orchestrator/src services/onboarding-orchestrator/src

RUN corepack enable && pnpm install --filter @bossnyumba/onboarding-orchestrator... --frozen-lockfile
RUN pnpm --filter @bossnyumba/onboarding-orchestrator build

FROM node:20-alpine AS runner
WORKDIR /repo

# Preserve the workspace layout — pnpm-style nested node_modules need it.
COPY --from=builder /repo /repo

ENV NODE_ENV=production
EXPOSE 3014
WORKDIR /repo/services/onboarding-orchestrator
CMD ["node", "dist/index.js"]
