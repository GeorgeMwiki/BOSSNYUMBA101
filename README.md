# BOSSNYUMBA

> Property Management SaaS Platform for East Africa

BOSSNYUMBA is a comprehensive multi-tenant property management platform designed for property managers, landlords, tenants, and estate managers. It provides end-to-end solutions for portfolio management, tenant operations, payments, maintenance, and reporting.

## Features

| Portal | Purpose |
|--------|---------|
| **Owner Portal** | Portfolio performance, statements, disbursements, maintenance oversight |
| **Admin Portal** | Tenant management, operations control, billing, support tools |
| **Customer App** | Payments, maintenance requests, lease documents, notifications |
| **Estate Manager App** | Work orders, inspections, collections, SLA management |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, Vite |
| API | Express.js, Hono, Node.js, TypeScript |
| Database | PostgreSQL with Drizzle ORM |
| Cache | Redis |
| Auth | JWT/OIDC with MFA support |
| Build | Turborepo, pnpm workspaces |
| Validation | Zod |

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker & Docker Compose (for full stack)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd BOSSNYUMBA101

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env
# Edit .env with your values
```

### Run with Docker

```bash
# Start PostgreSQL, Redis, and all services
docker compose up -d

# Or build first
docker compose build
docker compose up -d
```

### Run Locally (Development)

```bash
# Start infrastructure (PostgreSQL, Redis)
docker compose up -d postgres redis

# Run migrations
make db-migrate
# or: pnpm --filter @bossnyumba/database migrate

# Start all apps in dev mode
make dev
# or: pnpm exec turbo dev
```

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
│   ├── admin-portal/        # Admin dashboard (Vite, port 3000)
│   ├── owner-portal/        # Owner dashboard (Vite, port 3001)
│   ├── customer-app/        # Customer mobile-first (Next.js, port 3002)
│   └── estate-manager-app/  # Manager mobile-first (Next.js, port 3003)
├── services/
│   ├── api-gateway/         # API Gateway / BFF (port 4000)
│   ├── domain-services/     # Business logic
│   ├── payments-ledger/     # Payment ledger service
│   ├── reports/             # Reporting service
│   └── notifications/      # Notification service
├── packages/
│   ├── database/            # Drizzle schemas, migrations, repositories
│   ├── domain-models/       # Shared types
│   ├── authz-policy/       # Authorization engine
│   ├── design-system/       # UI components
│   ├── api-client/          # API client SDK
│   └── enterprise-hardening/# Security, rate limiting, etc.
├── infrastructure/         # Terraform, K8s manifests
├── Docs/                   # Documentation
└── e2e/                    # Playwright E2E tests
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages and apps |
| `pnpm dev` / `make dev` | Start all apps in dev mode |
| `pnpm test` | Run all tests |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript check |
| `pnpm clean` | Clean build artifacts |

### Make Targets

| Target | Description |
|--------|-------------|
| `make install` | Install dependencies |
| `make docker-up` | Start Docker services |
| `make docker-down` | Stop Docker services |
| `make db-migrate` | Run database migrations |
| `make db-seed` | Seed sample data |
| `make db-studio` | Open Drizzle Studio |
| `make tf-plan` | Terraform plan (TF_ENV=staging) |
| `make deploy-staging` | Deploy to staging |

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret (use `make gen-secret`) |
| `JWT_EXPIRES_IN` | Token expiry (e.g. `7d`) |
| `NEXT_PUBLIC_API_URL` | API base URL for frontends |
| `MPESA_*` | M-Pesa Daraja API credentials |
| `STRIPE_*` | Stripe API keys |
| `SENDGRID_API_KEY` | Email delivery |
| `AWS_S3_BUCKET` | Document storage |

See [.env.example](.env.example) for the full list.

## Deployment

- **Containerized**: Docker images for API Gateway and web apps
- **Orchestration**: Kubernetes (ECS/EKS)
- **Infrastructure**: Terraform in `infrastructure/terraform`
- **Registry**: AWS ECR (`make ecr-push-api`)

```bash
# Deploy to staging
make deploy-staging

# Deploy to production (interactive confirmation)
make deploy-production
```

## Documentation

- [API Reference](Docs/API.md) — Endpoints, auth, request/response examples
- [Architecture](Docs/ARCHITECTURE.md) — System design, multi-tenant, database schema
- [Data Flows](Docs/DATA_FLOWS.md) — Request patterns, event-driven flows

## License

Proprietary — All rights reserved.

## Support

For support, email support@bossnyumba.com or open an issue.
