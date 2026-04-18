# BOSSNYUMBA — Deployment Guide

Operational handbook for running BOSSNYUMBA101 locally, in staging, and in production.

---

## 1. Local Development (docker-compose)

### Prerequisites

- Docker Desktop 4.26+ (or Colima on macOS) with Compose v2
- `pnpm` 8.15+ and Node.js 22
- `openssl` for generating secrets

### First-time setup

```bash
cp .env.example .env
cp docker-compose.override.yml.example docker-compose.override.yml
```

Populate at minimum:

- `JWT_SECRET` (32+ chars): `openssl rand -base64 48`
- `ANTHROPIC_API_KEY` (if you need AI surfaces)
- `OCR_PROVIDER=mock` (default is fine for local)

### Bring the stack up

```bash
pnpm install
docker compose up --build
```

Services expose ports on localhost:

| Service               | Port  | Healthcheck              |
| --------------------- | ----- | ------------------------ |
| api-gateway           | 4000  | GET /health              |
| identity              | 4001  | GET /healthz             |
| reports               | 4002  | GET /healthz             |
| notifications         | 4003  | GET /healthz             |
| document-intelligence | 4004  | GET /healthz             |
| payments              | 4005  | GET /healthz             |
| payments-ledger       | 4006  | GET /healthz             |
| webhooks              | 4007  | GET /healthz             |
| domain-services       | 4008  | GET /healthz             |
| scheduler             | 4009  | GET /healthz             |
| Postgres (pgvector)   | 5432  | pg_isready               |
| Redis                 | 6379  | PING                     |
| Neo4j                 | 7687  | HTTP on :7474            |

### Database migrations

```bash
pnpm db:migrate
```

This runs all migrations in `packages/database/src/migrations/` in lexical order.
pgvector activation is a migration (`0001_enable_pgvector.sql`) — Postgres
must be on the `pgvector/pgvector:pg15` image or an RDS instance whose
parameter group has `vector` in `shared_preload_libraries`.

### Seeding a tenant org

```bash
pnpm db:seed --org=trc
```

The `--org` flag controls which tenant fixture loads. Supported fixtures
live in `packages/database/src/seeds/`.

---

## 2. Staging Deployment (GitHub Actions)

The `cd-staging.yml` workflow is the authoritative deploy path. Triggered on:

- `push` to `main` (auto-deploy)
- Manual `workflow_dispatch`

Flow:

1. `pr-check.yml` runs on every PR (lint, typecheck, unit tests).
2. On merge to `main`, `cd-staging.yml` builds each service image, pushes
   to ECR under the `staging` tag, and updates each ECS service via
   `aws ecs update-service --force-new-deployment`.
3. Terraform drift is caught by a weekly `infra/terraform plan` job (not
   yet wired — see tracking issue).

Rollback is done by re-deploying a prior image tag:

```bash
aws ecs update-service \
  --cluster bossnyumba-staging \
  --service bossnyumba-staging-api-gateway \
  --task-definition bossnyumba-staging-api-gateway:<previous-revision>
```

---

## 3. Rotating Secrets

All runtime secrets live in AWS Secrets Manager under the prefix
`bossnyumba/<env>/` (see `infra/terraform/secrets.tf`). To rotate a key:

```bash
aws secretsmanager put-secret-value \
  --secret-id bossnyumba/staging/anthropic-api-key \
  --secret-string "sk-ant-..."

aws ecs update-service \
  --cluster bossnyumba-staging \
  --service bossnyumba-staging-api-gateway \
  --force-new-deployment
```

The task must restart to pick up the new secret — ECS reads Secrets Manager
values at task-launch time, not at runtime.

Rotation cadence:

- `gepg-signing-key` — quarterly (GePG policy)
- `jwt-secret` — annually or on incident
- `anthropic-api-key` — on key compromise only
- RDS master password — managed by RDS (`manage_master_user_password = true`)

---

## 4. Running Migrations in Staging / Production

Migrations run as a one-off ECS task before a deploy, not from developer
laptops. The `db-migrations-check.yml` workflow gates merges that touch
`packages/database/src/migrations/`.

```bash
aws ecs run-task \
  --cluster bossnyumba-staging \
  --task-definition bossnyumba-staging-db-migrate \
  --launch-type FARGATE \
  --network-configuration "<same as api-gateway>"
```

The task definition runs `pnpm db:migrate` against `$DATABASE_URL` from
Secrets Manager and exits 0 on success.

---

## 5. Adding a New Tenant Org

1. **Reserve the slug** — add a row to `tenants` via
   `POST /api/v1/tenants` (platform admin auth required).
2. **Seed baseline data** — run `pnpm db:seed --org=<slug>` against the
   target environment. The seeder is idempotent on primary keys.
3. **Provision DNS** — add a `CNAME` under the `*.bossnyumba.io` zone
   pointing `<slug>.bossnyumba.io` at the api-gateway ALB.
4. **Register notification senders** — every tenant needs its own
   `notifications_from_email` verified with Resend / Twilio. See
   `services/notifications/README.md` for the per-tenant override flow.
5. **Smoke test** — run the `e2e/tenant-onboarding.spec.ts` suite
   with `TENANT_SLUG=<slug>`.

---

## 6. Service Topology

```
                        ┌─────────────────┐
                        │   api-gateway   │
                        │   :4000 (BFF)   │
                        └────────┬────────┘
                                 │
          ┌──────────┬───────────┼───────────┬────────────┐
          ▼          ▼           ▼           ▼            ▼
     identity   notifications  reports   payments   domain-services
       :4001      :4003        :4002     :4005         :4008
                    │            │          │
                    │            │          ▼
                    │            │    payments-ledger
                    │            │         :4006
                    │            │
                    └────┬───────┘
                         ▼
                      scheduler
                       :4009
                  (node-cron workers)
```

Data stores:

- **Postgres (pgvector)** — operational DB, vector search for doc-chat
- **Redis** — BullMQ queues, idempotency keys, OTP store, rate limits
- **Neo4j** — knowledge graph (optional; falls back to demo mode)

---

## 7. Observability

- Structured JSON logs from every service → CloudWatch Logs per service
- `/healthz` returns `{status, version, upstreams, workers}` per service
- Scheduler `/healthz` includes per-worker `lastSuccessAt` and error counts
- CloudWatch alarms defined in `infra/terraform/alarms.tf` (follow-up wave)
