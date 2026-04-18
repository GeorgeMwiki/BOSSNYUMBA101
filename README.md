# BOSSNYUMBA

> AI-native, multi-tenant property management SaaS — Tanzania-first, pan-African ambitions.

[![CI](https://img.shields.io/badge/CI-pending-lightgrey)](./.github/workflows) [![Coverage](https://img.shields.io/badge/coverage-pending-lightgrey)](#testing) [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

**This repository is BOSSNYUMBA only. Pongezi is a separate project (different repo, different product). Do not conflate.** See [PROJECT_BOUNDARY.md](./PROJECT_BOUNDARY.md).

BOSSNYUMBA is a comprehensive multi-tenant property management platform designed for property managers, landlords, tenants, and estate managers across East Africa. It pairs a deterministic policy core with AI personas ("the Brain") for negotiations, inspections, document generation, and migration.

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

```bash
# 1. Install deps
pnpm install

# 2. Start Postgres + Redis
docker compose up -d postgres redis

# 3. Run migrations and seed a demo org
pnpm --filter @bossnyumba/database migrate
pnpm --filter @bossnyumba/database seed --org=trc

# 4. Start the full stack
docker compose up
# or for dev mode (hot reload):
pnpm dev
```

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker & Docker Compose

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

### Operations (to be added)
- `Docs/DEPLOYMENT.md` — deployment runbook (planned)
- `Docs/RUNBOOK.md` — on-call runbook (planned)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

MIT — see [LICENSE](./LICENSE).

## Support

Open an issue on GitHub.
