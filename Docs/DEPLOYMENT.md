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
- `API_KEY_REGISTRY=` (empty is fine in dev; required in production)
- `TANZANIA_PAYMENT_BACKEND=clickpesa` (default PSP shortcut; `azampay`, `selcom`, and `gepg-direct` also supported)
- `NEXT_PUBLIC_TENANT_CURRENCY=TZS` / `NEXT_PUBLIC_TENANT_LOCALE=sw-TZ` / `NEXT_PUBLIC_TENANT_COUNTRY=TZ` for a Tanzania-first tenant (defaults are `USD` / `en`)

### Environment variable reference (wave-5 additions)

Beyond what `.env.example` already covers, wave-5 added the following
new variables. See `Docs/ENV.md` for the complete reference.

| Variable | Purpose | Default / required |
|----------|---------|--------------------|
| `API_KEY_REGISTRY` | Comma-separated `hash:tenantId:role:scopes:serviceName` entries. Replaces legacy `API_KEYS` (C-1 fix). | Required in production; empty in dev |
| `TANZANIA_PAYMENT_BACKEND` | Which GePG pathway to use: `clickpesa`, `azampay`, `selcom`, or `gepg-direct`. | `clickpesa` (recommended PSP shortcut) |
| `OCR_PROVIDER` | OCR backend: `textract`, `google`, or `mock`. | `mock` in dev |
| `NEXT_PUBLIC_TENANT_CURRENCY` | ISO 4217 code used for `Intl.NumberFormat` across customer/estate-manager apps. Replaces hardcoded `KES`. | `USD` |
| `NEXT_PUBLIC_TENANT_LOCALE` | BCP-47 locale used for `Intl.*` formatters. Replaces hardcoded `en-KE`. | `en` |
| `NEXT_PUBLIC_TENANT_COUNTRY` | ISO 3166-1 alpha-2 country code — drives telephony prefix and compliance export selection. | unset (must be provided per-tenant) |
| `NANO_BANANA_API_KEY` | Nano Banana image-generation provider (marketing imagery only, per RESEARCH_ANSWERS Q8). When unset the renderer returns a placeholder with `reason: 'NANO_BANANA_API_KEY unset'`. | Optional |
| `NANO_BANANA_API_URL` | Endpoint override. | Optional |
| `TYPST_BIN` | Absolute path to the `typst` CLI used by the PDF renderer. When unset the renderer tries `typst` on PATH; when absent entirely it falls back to a zero-dep PDF encoder so the code remains callable in CI. | Optional |
| `GEPG_PSP_MODE` | When `true`, GePG signature check is skipped (delegated to PSP). When `false`, both `GEPG_SIGNING_KEY_PEM` and `GEPG_SIGNING_CERT_PEM` must be set or the service refuses to boot (C-2 fix). | `true` in PSP mode |
| `GEPG_SIGNING_KEY_PEM` / `GEPG_SIGNING_CERT_PEM` | RSA key + cert for direct GePG signature verification. | Required when `GEPG_PSP_MODE=false` |
| `OUTBOX_INTERVAL_MS` / `OUTBOX_BATCH_SIZE` / `OUTBOX_WORKER_DISABLED` | Outbox drainer tuning. Ticks every `OUTBOX_INTERVAL_MS` ms (default 5000), drains up to `OUTBOX_BATCH_SIZE` events (default 50). | Defaults safe |
| `NOTIFICATIONS_SERVICE_URL` | Base URL for the notifications service; when unset, event subscribers log dispatches they would have sent instead of erroring. | Required in production |
| `INTERNAL_API_KEY` | `X-Internal-Key` header value for internal service-to-service calls. | Required in production |

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

---

## 8. Composition root degraded mode

The api-gateway constructs a single typed `ServiceRegistry` at boot
(`services/api-gateway/src/composition/service-registry.ts`). This
registry lazily instantiates the 10 Postgres-backed domain services
(marketplace, tenders, negotiations, waitlist, gamification, migration,
etc.). When required inputs are missing it **falls back to degraded
mode** instead of crashing.

### Boot-time signal

```
service-registry: live      → DATABASE_URL resolved, all LIVE services wired
service-registry: degraded  → DATABASE_URL unset, pure-DB endpoints will 503
```

### What degrades vs. what fails closed

| Missing env var | Behaviour | Why |
|-----------------|-----------|-----|
| `DATABASE_URL` | Registry returns skeleton of `null`s; pure-DB routers respond `503 Service Unavailable` with a clear reason. Auth, legacy routes, and external-creds routes still work. | Graceful — developers can run the gateway without booting Postgres. |
| `API_KEY_REGISTRY` **and** `API_KEYS` | In production (`NODE_ENV=production`) the gateway **refuses to boot** (`assertApiKeyConfig()`). | Prevents misconfigured deploys from silently accepting every request. |
| `ALLOWED_ORIGINS` | In production the gateway **refuses to boot**. | Wildcard CORS + cookie auth = CSRF risk. |
| `GEPG_PSP_MODE=false` without `GEPG_SIGNING_KEY_PEM`+`GEPG_SIGNING_CERT_PEM` | Payments service **refuses to boot**. | C-2 fix — no more stub signature verification. |
| `NOTIFICATIONS_SERVICE_URL` | Event subscribers log "`notification dispatch skipped`" and move on. | Graceful — keeps the outbox drainer healthy during partial outages. |
| `NANO_BANANA_API_KEY` | Imagery renderer emits a placeholder PNG with `reason: 'NANO_BANANA_API_KEY unset'` in metadata. | Graceful — caller's document pipeline never breaks. |
| `TYPST_BIN` | PDF renderer falls back to the zero-dep encoder (`react-pdf`). | Graceful — CI still renders valid PDFs. |
| `OCR_PROVIDER=mock` | `document-intelligence` processes with fixtures. | Graceful — safe for dev, NEVER in production. |

### Pilot-acceptable 503s

Some routers return 503 even when `DATABASE_URL` is set, because their
Postgres repos haven't landed yet. As of wave-5 these are:

- `/api/v1/occupancy-timeline/*` — awaiting `PostgresOccupancyTimelineRepository`
- `/api/v1/station-master-coverage/*` — awaiting `PostgresStationMasterCoverageRepository`

Everything else that is pure-DB (marketplace, waitlist, gamification,
migration, negotiations, tenders, risk reports, compliance exports,
arrears, applications, renewals, letters, doc-chat, document render,
scans) returns real data when `DATABASE_URL` is set.

See `Docs/analysis/DELTA_AND_ROADMAP.md` § "Production Readiness Matrix"
for the full per-feature matrix.
