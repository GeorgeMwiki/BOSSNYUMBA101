# BossNyumba

> AI-native, multi-tenant property management SaaS — Tanzania-first, pan-African ambitions.

[![CI](https://img.shields.io/badge/CI-pending-lightgrey)](./.github/workflows) [![Coverage](https://img.shields.io/badge/coverage-pending-lightgrey)](#testing) [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

**This repository is BossNyumba only. Pongezi is a separate project (different repo, different product). Do not conflate.** See [PROJECT_BOUNDARY.md](./PROJECT_BOUNDARY.md).

BossNyumba is a comprehensive multi-tenant property management platform designed for property managers, landlords, tenants, and estate managers across East Africa. It pairs a deterministic policy core with AI personas ("the Brain") for negotiations, inspections, document generation, and migration.

## Architecture

```
                           ┌───────────────────────────┐
                           │         The Brain         │
                           │  (@bossnyumba/ai-copilot) │
                           │  personas · providers     │
                           └─────────────┬─────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
             ┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐
             │  Owner      │      │  Admin      │      │  Customer   │
             │  Portal     │      │  Portal     │      │  App        │
             │ (Vite 3001) │      │ (Vite 3000) │      │ (Next 3002) │
             └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
                    │                    │                    │
                    │             ┌──────▼──────┐             │
                    │             │ Estate Mgr  │             │
                    │             │ (Next 3003) │             │
                    │             └──────┬──────┘             │
                    │                    │                    │
                    └────────────┬───────┴──────┬─────────────┘
                                 │              │
                           ┌─────▼──────────────▼─────┐
                           │    API Gateway (4000)    │
                           │  authz · rate-limit      │
                           └────────────┬─────────────┘
                                        │
         ┌──────────────┬────────────┬──┴────────┬──────────────┬──────────────┐
         │              │            │           │              │              │
  ┌──────▼──────┐┌──────▼─────┐┌─────▼────┐┌─────▼──────┐┌──────▼─────┐┌───────▼────┐
  │ domain-     ││ payments   ││payments- ││notifications│  reports   ││ identity   │
  │ services    ││ (M-Pesa,   ││ ledger   ││             │            ││  webhooks  │
  │ (leases,    ││  GePG)     ││(immutable││(sms/email/ ││(pdf,html,  ││ document-  │
  │ inspections)││            ││ ledger)  ││  push)     ││  xlsx)     ││ intellig.  │
  └──────┬──────┘└──────┬─────┘└─────┬────┘└─────┬──────┘└──────┬─────┘└───────┬────┘
         │              │            │           │              │              │
         └──────────────┴────────────┼───────────┴──────────────┴──────────────┘
                                     │
                          ┌──────────▼──────────┐
                          │  Postgres + Redis   │
                          │  (@bossnyumba/      │
                          │   database: Drizzle)│
                          └─────────────────────┘
```

Cross-cutting packages: `@bossnyumba/domain-models` (types), `@bossnyumba/authz-policy` (RBAC), `@bossnyumba/design-system` (UI), `@bossnyumba/enterprise-hardening` (security middleware), `@bossnyumba/observability` (logs/metrics/traces), `@bossnyumba/config` (env loader), `@bossnyumba/api-client` (typed SDK), `@bossnyumba/graph-sync` (event projections).

## Features

| Portal | Purpose |
|--------|---------|
| **Owner Portal** | Portfolio performance, statements, disbursements, maintenance oversight, approvals |
| **Admin Portal** | Tenant management, operations control, billing, compliance exports, GePG config |
| **Customer App** | Payments, maintenance requests, lease documents, negotiations, disputes |
| **Estate Manager App** | Work orders, inspections, collections, SLA management, tenders |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 + React 18 (customer, estate-mgr); Vite + React (admin, owner); Tailwind CSS |
| API | Express.js, Hono, Node.js, TypeScript |
| Database | PostgreSQL 15 with Drizzle ORM |
| Cache | Redis 7 |
| Auth | JWT/OIDC with MFA + per-org token exchange |
| Build | pnpm workspaces (Turbo optional) |
| Validation | Zod |
| AI | Anthropic Messages API via `@bossnyumba/ai-copilot` |

## Quick Start

Two supported paths for bringing up local Postgres + Redis — Docker
(one-liner) or Homebrew (lighter, no container overhead). Pick one.

### Option A — Docker (recommended for first-time setup)

```bash
# 1. Install deps
pnpm install

# 2. Start Postgres (pgvector) + Redis via docker-compose
docker compose up -d postgres redis

# 3. Copy + populate env file
cp .env.example .env
# Minimum to fill: JWT_SECRET, DATABASE_URL, REDIS_URL, API_KEY_REGISTRY
#                  (empty ok in dev), NEXT_PUBLIC_TENANT_CURRENCY,
#                  NEXT_PUBLIC_TENANT_LOCALE, NEXT_PUBLIC_TENANT_COUNTRY

# 4. Run migrations (40/40 apply clean as of wave 5)
pnpm -F @bossnyumba/database db:migrate

# 5. Seed the TRC pilot fixture (SEED_ORG_SEEDS=true required)
SEED_ORG_SEEDS=true pnpm -F @bossnyumba/database db:seed -- --org=trc

# 6. Start the full stack
docker compose up
# or for dev mode (hot reload):
pnpm dev
```

### Option B — Homebrew (macOS, no Docker)

```bash
# 1. System services
brew install postgresql@15 redis
brew services start postgresql@15
brew services start redis

# 2. Bootstrap a local database
createdb bossnyumba

# 3. Enable pgvector (the first migration does this automatically)
psql bossnyumba -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. Copy env + point at local services
cp .env.example .env
# Set DATABASE_URL=postgresql://localhost:5432/bossnyumba
#     REDIS_URL=redis://localhost:6379

# 5. Install deps + migrate + seed + run
pnpm install
pnpm -F @bossnyumba/database db:migrate
SEED_ORG_SEEDS=true pnpm -F @bossnyumba/database db:seed -- --org=trc
pnpm dev
```

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Either Docker + Compose, **or** local Postgres 15 (with pgvector) + Redis 7

### Development smoke test

Verifies the full gateway boot + composition root wiring in under a
minute. Run after migrations + seed.

```bash
# 1. Boot the api-gateway (separate terminal)
pnpm -F @bossnyumba/api-gateway dev

# 2. Look for this line in the logs — confirms Postgres-backed domain
#    services wired successfully:
#
#    service-registry: live (Postgres-backed domain services wired)
#
#    If you see "service-registry: degraded" instead, DATABASE_URL is
#    unset and pure-DB endpoints will return 503. Legacy routes still
#    work. See Docs/DEPLOYMENT.md §8.

# 3. Hit the health endpoints (both paths served)
curl -sS http://localhost:4000/health  | jq .
curl -sS http://localhost:4000/healthz | jq .
# {
#   "status": "ok",
#   "version": "dev",
#   "service": "api-gateway",
#   "timestamp": "2026-04-18T...",
#   "upstreams": {}
# }

# 4. Probe the API versioning endpoint — lists every mounted route
curl -sS http://localhost:4000/api/v1 | jq .

# 5. Probe one wave-5 LIVE endpoint (requires valid JWT in real use)
#    Without auth, expect 401. With auth + DATABASE_URL set, expect
#    real rows from Postgres.
curl -sS http://localhost:4000/api/v1/marketplace/listings \
  -H "Authorization: Bearer <jwt>" | jq .
```

See [Docs/DEPLOYMENT.md](Docs/DEPLOYMENT.md) and
[Docs/RUNBOOK.md](Docs/RUNBOOK.md) for the full operational reference.

### Development URLs

| Application | URL |
|-------------|-----|
| Admin Portal | http://localhost:3000 |
| Owner Portal | http://localhost:3001 |
| Customer App | http://localhost:3002 |
| Estate Manager App | http://localhost:3003 |
| API Gateway | http://localhost:4000 |

## Project Structure

```
BOSSNYUMBA101/
├── apps/
│   ├── admin-portal/         # Vite, port 3000
│   ├── owner-portal/         # Vite, port 3001
│   ├── customer-app/         # Next.js, port 3002
│   └── estate-manager-app/   # Next.js, port 3003
├── services/
│   ├── api-gateway/          # BFF / gateway (port 4000)
│   ├── domain-services/      # Core business logic
│   ├── identity/             # Auth, OTP, invite codes
│   ├── payments/             # M-Pesa, GePG providers
│   ├── payments-ledger/      # Immutable ledger
│   ├── notifications/        # SMS, email, push
│   ├── reports/              # PDF, HTML, XLSX reports
│   ├── document-intelligence/# OCR, embeddings, RAG
│   └── webhooks/             # Outbound + inbound relay
├── packages/
│   ├── ai-copilot/           # Brain — personas + providers
│   ├── domain-models/        # Shared types + Zod
│   ├── authz-policy/         # RBAC engine
│   ├── design-system/        # UI kit
│   ├── database/             # Drizzle + migrations + repos
│   ├── enterprise-hardening/ # Security middleware
│   ├── observability/        # Logs, metrics, traces
│   ├── config/               # Env loader
│   ├── api-client/           # Typed SDK
│   └── graph-sync/           # Event projections
├── infrastructure/           # Terraform, K8s manifests
├── Docs/                     # Spec + analysis + runbooks
└── e2e/                      # Playwright E2E tests
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages and apps |
| `pnpm dev` | Start all apps in dev mode |
| `pnpm test` | Run unit + integration tests |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | TypeScript check |
| `pnpm eval` | Run AI persona evals |

See `Makefile` for Docker/Terraform/ECR helpers.

## Documentation

### Start here
- [Docs/INDEX.md](Docs/INDEX.md) — master index of every doc
- [Docs/analysis/DELTA_AND_ROADMAP.md](Docs/analysis/DELTA_AND_ROADMAP.md) — current gaps and delivery plan
- [Docs/PRODUCTION_READINESS.md](Docs/PRODUCTION_READINESS.md) — pre-deploy checklist

### Architecture + spec
- [Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md) — system design
- [Docs/ARCHITECTURE_BRAIN.md](Docs/ARCHITECTURE_BRAIN.md) — Brain (AI) architecture
- [Docs/BOSSNYUMBA_SPEC.md](Docs/BOSSNYUMBA_SPEC.md) — product spec
- [Docs/DOMAIN_MODEL.md](Docs/DOMAIN_MODEL.md) — domain entities

### API + contracts
- [Docs/API.md](Docs/API.md) — endpoint reference
- [Docs/api/openapi.yaml](Docs/api/openapi.yaml) — OpenAPI spec
- [Docs/API_CONTRACTS.md](Docs/API_CONTRACTS.md) — contract conventions

### Operations
- [Docs/DEPLOYMENT.md](Docs/DEPLOYMENT.md) — local + staging + production deploy guide, env-var reference, composition root degraded mode
- [Docs/RUNBOOK.md](Docs/RUNBOOK.md) — on-call runbook, standard operational procedures (migrations, seeds, health checks, API key rotation, 503 triage)
- [Docs/ENV.md](Docs/ENV.md) — complete environment variable reference

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

MIT — see [LICENSE](./LICENSE).

## Support

Open an issue on GitHub.
