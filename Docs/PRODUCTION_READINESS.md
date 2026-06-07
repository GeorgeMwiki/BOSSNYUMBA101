# BOSSNYUMBA Production Readiness

This document tracks production readiness and deployment requirements for the BOSSNYUMBA platform.

## Pre-deployment checklist

### Build & quality
- [x] Monorepo build passes: `pnpm build`
- [x] TypeScript check passes: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`
- [x] Tests pass: `pnpm test` (db, gateway, apps, logic, brain suites green)
- [ ] E2E tests (optional for first release): `pnpm test:e2e` with target URLs configured

> Typecheck, build and lint are green across the monorepo as of this readiness
> pass. Keep them green — the gateway also fails fast at boot on env-var
> misconfiguration (see `services/api-gateway/src/config/validate-env.ts`), so a
> bad env is caught before the first request.

### Environment

The full annotated template is [`.env.example`](../.env.example) (status labels:
`[REQUIRED]` / `[RECOMMENDED]` / `[OPTIONAL]` / `[DEPLOY]` / `[LEGACY]`). For a
self-hosted Docker/K8s deploy, also see
[`.env.production.example`](../.env.production.example).

Core (gateway throws at boot if missing):
- [ ] `.env` created from `.env.example` and all **REQUIRED** variables set
- [ ] `DATABASE_URL` points to production PostgreSQL (or Supabase)
- [ ] `JWT_SECRET` / `JWT_REFRESH_SECRET` set (≥ 32 chars; prefer 64+). Use
      `pnpm gen-secrets --write` or strong random values
- [ ] `SESSION_HASH_SECRET` set (≥ 32 chars) — **required in production**; the
      audit hash-chain degrades to forge-able unsigned SHA-256 without it
- [ ] `ENCRYPTION_MASTER_KEY` set for PII field-encryption at rest
- [ ] `USER_HASH_SALT` set when OTel is enabled — observability throws in
      production rather than leak raw user emails into traces
- [ ] No default or placeholder secrets in production

Auth (Supabase is canonical — no Clerk):
- [ ] `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set (browser-safe)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (server-only — bypasses ALL RLS; never expose)
- [ ] `SUPABASE_JWT_SECRET` set (used by api-gateway, ai-copilot, payments-ledger)
- [ ] **Supabase SMS / phone OTP**: OTP login is handled by Supabase Auth itself
      (the gateway only proxies `/auth/v1/otp`). Enable **Auth → Providers →
      Phone** in the Supabase Dashboard and configure an SMS provider (Twilio /
      Africa's Talking / MessageBird) there. There is **no app env var** for this —
      it is dashboard configuration.

Infra (durable execution):
- [ ] `REDIS_URL` set — **required in production**. Backs durable idempotency
      keys and the distributed rate limiter; the gateway throws
      `REDIS_URL not set` when the durable idempotency path initialises without it
- [ ] `OUTBOX_STORE_TYPE` = `redis` or `postgres` wherever the standalone
      **outbox-processor** service runs — the service **refuses to start** when unset
      (durable transactional outbox)

Payments (live money):
- [ ] `PAYMENTS_LEDGER_URL` set — gateway → **payments-ledger** over HTTP for
      M-Pesa STK push + double-entry ledger posting (forwards the caller's
      Supabase JWT). Without it the rent-payment path logs an error and refuses
      to initiate STK. Optional only in dev (in-process stub)
- [ ] `PAYMENTS_RECEIPT_BASE_URL` set to the public payments domain (M-Pesa
      receipt links); falls back to a dev/test default when unset
- [ ] M-Pesa Daraja creds set (`MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` /
      `MPESA_SHORTCODE` / `MPESA_PASSKEY`) plus `MPESA_WEBHOOK_SECRET` with
      `MPESA_WEBHOOK_SECRET_REQUIRED=true` to reject unsigned callbacks
- [ ] GePG creds set if the Tanzania government gateway is in use (`GEPG_*`)

Apps (build-time / prerender — inlined into client bundles):
- [ ] `NEXT_PUBLIC_API_URL` set for every Next.js app (customer-app,
      tenant-portal, admin portals, marketing) and the embeddable chat widget —
      they proxy `/api/v1` to this gateway base
- [ ] `NEXT_PUBLIC_OWNER_PORTAL_URL` set — owner-portal canonical origin, read
      at build time for admin-portal prerender / cross-portal links
- [ ] `NEXT_PUBLIC_MARKETING_SITE_URL` set — marketing canonical origin, read at
      build time for marketing prerender (metadata / canonical tags)
- [ ] `API_URL` / `FRONTEND_URL` set for production domains
- [ ] Mobile builds (Expo): `EXPO_PUBLIC_API_GATEWAY_URL` + `EXPO_PUBLIC_SUPABASE_*`
      set before bundling staff-mobile / tenant-mobile

### Database
- [ ] Migrations applied: `make db-migrate` or `pnpm --filter @bossnyumba/database run db:migrate`
- [ ] Seed (if needed): `make db-seed` only in non-production or with guarded scripts
- [ ] (Optional) `DATABASE_URL_READONLY` set if routing read-heavy queries to a replica

### Infrastructure
- [ ] Docker images build: `make docker-build` or equivalent
- [ ] Docker Compose (or K8s) runs API gateway, apps, Postgres, Redis as per [ARCHITECTURE.md](./ARCHITECTURE.md)
- [ ] Terraform/K8s applied for target environment (staging/production) per README
- [ ] `OTEL_ENABLED=true` + `OTEL_EXPORTER_OTLP_ENDPOINT` set if shipping traces
      (and `USER_HASH_SALT`, per Environment above)

### Security
- [ ] API keys and secrets from env or secret manager (no hardcoded credentials)
- [ ] **Agent-to-agent / service API-key auth uses `API_KEY_REGISTRY`** (hashed,
      per-key tenant/role/scope binding). **Legacy `API_KEYS` is FORBIDDEN in
      production** — the gateway **throws at boot** if `API_KEYS` is set with
      `NODE_ENV=production` (it does plaintext compare + blanket SUPER_ADMIN).
      Migrate every entry to `API_KEY_REGISTRY`
- [ ] CORS and rate limiting configured for production domains (`ALLOWED_ORIGINS`
      — origin allowlist only, no reflective CORS)
- [ ] Webhook HMAC secrets set (`WEBHOOK_DEFAULT_HMAC_SECRET`,
      `MPESA_WEBHOOK_SECRET`, `WHATSAPP_APP_SECRET`, `AFRICASTALKING_WEBHOOK_SECRET`);
      `WEBHOOK_REQUIRE_TIMESTAMP=true` for replay protection
- [ ] `AUDIT_TRAIL_SIGNING_SECRET` set for signed append-only audit-trail entries
- [ ] Staff/admin emails and platform admin credentials set via env (e.g.
      `PLATFORM_ADMIN_EMAILS`, `PLATFORM_ADMIN_PASSWORD`)

### Known production notes (until integrations exist)
- **Payments-ledger tenant resolution**: where `TENANT_SERVICE_URL` is unset, the
  ledger falls back to env defaults (`PLATFORM_FEE_PERCENT` / `PLATFORM_FEE_BPS`).
  Point `TENANT_SERVICE_URL` at the tenant service in production.

## Quick commands

| Action         | Command |
|----------------|---------|
| Build all      | `pnpm build` |
| Typecheck      | `pnpm typecheck` |
| Lint           | `pnpm lint` |
| Run migrations | `make db-migrate` |
| Seed DB        | `make db-seed` |
| Start stack    | `make docker-up` or `pnpm exec turbo dev` |
| Run tests      | `pnpm test` |

## Documentation

- [README](../README.md) — Quick start, scripts, deployment
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design, multi-tenant, schema
- [API.md](./API.md) — API reference
- [.env.example](../.env.example) — Full env template with status labels
- [.env.production.example](../.env.production.example) — Self-hosted Docker/K8s template
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Full env-var reference (cited by the gateway boot validator)
- [SECRETS_ROTATION.md](./SECRETS_ROTATION.md) — Secret rotation policy
