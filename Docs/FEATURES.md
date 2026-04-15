# BOSSNYUMBA — Feature Manifest

Status legend:

- **Shipped** — code is live in production/staging, covered by tests or docs, safe to enable.
- **Scaffolded** — code exists, wired in behind a flag or in a portal, but is not yet production-grade (missing tests, integrations, or final UX).
- **Planned** — design and/or flag exists, code is either stubbed or not yet started.

Last reviewed: 2026-04-15.

---

## Core platform

### Authentication & multi-tenant RBAC
- **Status**: Shipped
- **What**: JWT auth (jose + jsonwebtoken), tenant isolation, role-based access control, platform-admin escape hatch.
- **Code**: `services/api-gateway/src/routes/auth.ts`, `services/api-gateway/src/middleware/hono-auth.ts`, `services/api-gateway/src/middleware/authorization.ts`, `services/api-gateway/src/middleware/rbac.middleware.ts`.
- **Env**: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `STAFF_ADMIN_EMAILS`, `STAFF_SUPPORT_EMAILS`, `STAFF_ALLOWED_DOMAINS`, `PLATFORM_ADMIN_EMAILS`, `PLATFORM_ADMIN_PASSWORD`, `BOOTSTRAP_SECRET`.
- **Enable**: always on. Set `JWT_SECRET` (min 32 chars) and either `PLATFORM_ADMIN_EMAILS` or `BOOTSTRAP_SECRET` to onboard the first admin.

### API Gateway (Hono on Express)
- **Status**: Shipped
- **What**: Single entry point for all web/mobile clients. Hono routers mounted under `/api/v1`.
- **Code**: `services/api-gateway/src/index.ts`, `services/api-gateway/src/routes/*.hono.ts`.
- **Env**: `PORT`, `LOG_LEVEL`, `API_URL`, `FRONTEND_URL`, `CORS_ORIGIN`.
- **Enable**: always on. `pnpm --filter @bossnyumba/api-gateway dev`.

### Database (Drizzle + Postgres/Supabase)
- **Status**: Shipped
- **What**: Drizzle ORM schema, migrations, tenant-scoped queries.
- **Code**: `packages/database/`, `services/api-gateway/src/middleware/database.ts`.
- **Env**: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Enable**: always on.

### Config & secrets (`@bossnyumba/config`)
- **Status**: Shipped
- **What**: Validated env loading + typed feature-flag API (`isEnabled`).
- **Code**: `packages/config/src/index.ts`, `packages/config/src/schemas.ts`, `packages/config/src/feature-flags.ts`.
- **Env**: all env vars are schema-validated here.
- **Enable**: always on. See `packages/config/README.md`.

---

## Portals & apps

### Admin portal (Vite SPA)
- **Status**: Shipped
- **What**: Platform-admin UI — tenants, users, roles, audit, system health, communications, compliance, analytics, integrations.
- **Code**: `apps/admin-portal/` (Vite + React Router). Pages in `src/pages/`, feature sub-areas in `src/app/`.
- **Env**: `VITE_DEMO_ADMIN_EMAIL`, `VITE_DEMO_ADMIN_PASSWORD`, `VITE_DEMO_SUPPORT_EMAIL`, `VITE_DEMO_SUPPORT_PASSWORD`, `NEXT_PUBLIC_API_URL`.
- **Enable**: `pnpm --filter @bossnyumba/admin-portal dev`.

### Owner portal (Vite SPA)
- **Status**: Shipped
- **What**: Landlord/owner UI — properties, leases, financials, reports, approvals.
- **Code**: `apps/owner-portal/`.
- **Env**: `NEXT_PUBLIC_API_URL`, `OWNER_PORTAL_URL`.
- **Enable**: `pnpm --filter @bossnyumba/owner-portal dev`.

### Customer app (Next.js)
- **Status**: Shipped
- **What**: Tenant-facing app — pay rent, request maintenance, messages.
- **Code**: `apps/customer-app/` (Next 14 app router).
- **Env**: `NEXT_PUBLIC_API_URL`, `CUSTOMER_APP_URL`, `NEXT_PUBLIC_SUPPORT_PHONE`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `NEXT_PUBLIC_SUPPORT_EMAIL`.
- **Enable**: `pnpm --filter @bossnyumba/customer-app dev`.

### Estate manager app (Next.js)
- **Status**: Shipped
- **What**: Field-ops UI for caretakers/estate managers — work orders, inspections, scheduling.
- **Code**: `apps/estate-manager-app/`.
- **Env**: `NEXT_PUBLIC_API_URL`, `ESTATE_MANAGER_URL`.
- **Enable**: `pnpm --filter @bossnyumba/estate-manager-app dev`.

### Flutter mobile (`bossnyumba_app`)
- **Status**: Scaffolded
- **What**: Native mobile client shell.
- **Code**: `apps/bossnyumba_app/lib/`.
- **Env**: configured per-flavour in the Flutter build.
- **Enable**: `cd apps/bossnyumba_app && flutter run`.

---

## Domain modules

### Properties, units, leases
- **Status**: Shipped
- **Code**: `services/api-gateway/src/routes/properties.ts`, `units.ts`, `leases.ts`; `packages/domain-models/src/`.

### Invoices & payments
- **Status**: Shipped
- **What**: Invoice generation, mobile-money (M-Pesa, TigoPesa, Airtel, Halopesa), Stripe subscriptions, ledger.
- **Code**: `services/api-gateway/src/routes/invoices.ts`, `payments.ts`; `services/payments/`, `services/payments-ledger/`.
- **Env**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `TZS_USD_EXCHANGE_RATE`, `MPESA_*`, `TIGOPESA_*`, `AIRTELMONEY_*`, `HALOPESA_*`, `MOBILE_MONEY_ENV`, `MOBILE_MONEY_CALLBACK_URL`, `CRON_SECRET`.

### Work orders & maintenance
- **Status**: Shipped
- **Code**: `services/api-gateway/src/routes/work-orders.hono.ts`, `scheduling.ts`.

### Vendors, cases, complaints, feedback
- **Status**: Shipped
- **Code**: `services/api-gateway/src/routes/vendors.hono.ts`, `cases.hono.ts`, `complaints.ts`, `feedback.ts`.

### Inspections
- **Status**: Shipped
- **Code**: `services/api-gateway/src/routes/inspections.ts`.

### Documents & document intelligence
- **Status**: Shipped
- **Code**: `services/api-gateway/src/routes/documents.hono.ts`; `services/document-intelligence/`.

### Messaging
- **Status**: Shipped
- **Code**: `services/api-gateway/src/routes/messaging.ts`.
- **Env**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`, `TWILIO_SMS_NUMBER`.

### Reports
- **Status**: Shipped
- **Code**: `services/api-gateway/src/routes/reports.hono.ts`; `services/reports/`.
- **Env**: `REDIS_URL` (BullMQ), `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

### Notifications
- **Status**: Shipped
- **Code**: `services/notifications/`; `services/api-gateway/src/routes/notifications.ts`.
- **Env**: `RESEND_API_KEY`, `TWILIO_*`, `SENDGRID_API_KEY`, `AFRICAS_TALKING_*`.

### Webhooks
- **Status**: Shipped
- **Code**: `services/webhooks/`.

### Onboarding
- **Status**: Scaffolded
- **Code**: `services/api-gateway/src/routes/onboarding.ts`; `apps/admin-portal/src/pages/tenants/OnboardingWizard.tsx`.

---

## AI & voice

### AI Copilot
- **Status**: Scaffolded
- **Flag**: `FF_AI_COPILOT`
- **What**: Contextual AI assistant sidebar in owner / admin portals.
- **Code**: `packages/ai-copilot/`; `apps/admin-portal/src/pages/ai/AICockpit.tsx`.
- **Env**: `ANTHROPIC_API_KEY` (primary), `OPENAI_API_KEY` (fallback), `DEEPSEEK_API_KEY` (batch), `AI_PROVIDER`, `CLAUDE_MODEL_DEFAULT`, `CLAUDE_MODEL_PREMIUM`, `CLAUDE_MODEL_FAST`, `OPENAI_MODEL_DEFAULT`.
- **Enable**: `FF_AI_COPILOT=true` plus at least one provider key.

### Voice reports (STT + TTS)
- **Status**: Scaffolded
- **Flag**: `FF_VOICE_REPORTS`
- **What**: Dictate maintenance/inspection reports; synthesize summaries.
- **Code**: (integration layer) — ElevenLabs + Whisper via `packages/ai-copilot/` helpers.
- **Env**: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_MODEL_STT`, `ELEVENLABS_MODEL_TTS`, `ELEVENLABS_DEFAULT_VOICE_ID`, `OPENAI_VOICE_MODEL`, `OPENAI_TTS_MODEL`, `INTRON_API_KEY`, `INTRON_API_ENDPOINT` (Swahili fallback).
- **Enable**: `FF_VOICE_REPORTS=true` + keys.

### AI briefings (daily owner digest)
- **Status**: Planned
- **Flag**: `FF_AI_BRIEFINGS`
- **Code**: design only.
- **Env**: reuses AI provider keys + `RESEND_API_KEY`.

### Knowledge graph (Neo4j)
- **Status**: Scaffolded
- **Code**: `packages/graph-sync/`.
- **Env**: `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`, `NEO4J_MAX_POOL_SIZE`, `NEO4J_ACQUISITION_TIMEOUT`, `NEO4J_CONNECTION_TIMEOUT`, `NEO4J_MAX_RETRY_TIME`.
- **Enable**: set `NEO4J_URI` — service falls back to demo mode otherwise.

### Knowledge intelligence fetch
- **Status**: Scaffolded
- **Env**: `GOOGLE_KG_API_KEY`, `KNOWLEDGE_FETCH_ENABLED`, `KNOWLEDGE_AUTO_INGEST`, `KNOWLEDGE_MIN_RELEVANCE`, `KNOWLEDGE_MONTHLY_BUDGET`, `SEARCH_API_KEY`, `SEARCH_ENGINE_ID`.

---

## Flagged features

### Portfolio map
- **Status**: Scaffolded
- **Flag**: `FF_PORTFOLIO_MAP`
- **What**: Geo view of the owner portfolio with occupancy/revenue overlays.
- **Code**: `apps/owner-portal/src/app/portfolio/`.
- **Enable**: `FF_PORTFOLIO_MAP=true`.

### Multi-org switcher
- **Status**: Scaffolded
- **Flag**: `FF_MULTI_ORG_SWITCHER`
- **What**: Org switcher for users belonging to multiple tenants.
- **Code**: `apps/admin-portal/src/contexts/`, `apps/owner-portal/src/contexts/`.
- **Enable**: `FF_MULTI_ORG_SWITCHER=true`.

### Offline mode
- **Status**: Planned
- **Flag**: `FF_OFFLINE_MODE`
- **What**: Offline-first capture + sync for field inspections.
- **Code**: design only; expected in `apps/estate-manager-app/` + service worker.

### Push notifications
- **Status**: Scaffolded
- **Flag**: `FF_PUSH_NOTIFICATIONS`
- **What**: FCM/APNS pushes for mobile + browser.
- **Code**: `services/notifications/` (FCM wiring partially complete).
- **Env**: `FIREBASE_PROJECT_ID` + credentials.

### eTIMS integration (Kenya)
- **Status**: Planned
- **Flag**: `FF_ETIMS_INTEGRATION`
- **What**: KRA eTIMS electronic tax invoicing.
- **Env**: (to be defined in its own section once spec is finalized).

### TRA integration (Tanzania)
- **Status**: Planned
- **Flag**: `FF_TRA_INTEGRATION`
- **What**: Tanzania Revenue Authority EFD-compliant receipts.
- **Env**: `TRA_API_URL`, `TRA_API_KEY`.

---

## Regulatory & KYC integrations

### NIDA (Tanzania national ID)
- **Status**: Scaffolded
- **Env**: `NIDA_API_URL`, `NIDA_API_KEY`, `NIDA_CLIENT_ID`, `NIDA_CLIENT_SECRET`, `NIDA_CERTIFICATE`, `NIDA_ENVIRONMENT`.

### CRB (Credit Reference Bureau)
- **Status**: Scaffolded
- **Env**: `CRB_API_URL`, `CRB_API_KEY`, `CRB_SUBSCRIBER_ID`, `CRB_SUBSCRIBER_PASSWORD`, `CRB_ENVIRONMENT`.

### BRELA (business registration)
- **Status**: Scaffolded
- **Env**: `BRELA_API_URL`, `BRELA_API_KEY`.

---

## Enterprise connectors

Temenos T24, Mambu, CNO, Avoka, Kony, Salesforce, Gmail. All scaffolded behind
the circuit-breaker in `packages/enterprise-hardening/`. See `.env.example`
section O for the full list of env vars.

- **Env (shared)**: `CB_FAILURE_THRESHOLD`, `CB_RESET_TIMEOUT_MS`, `CB_HALF_OPEN_REQUESTS`, `CONNECTOR_HEALTH_CHECK_INTERVAL_MS`, `CONNECTOR_MAX_RETRIES`, `CONNECTOR_RETRY_BASE_MS`.

---

## Security & observability

### Field-level encryption
- **Status**: Shipped
- **Env**: `ENCRYPTION_MASTER_KEY`, `ENCRYPTION_MASTER_KEY_PREVIOUS`, `ENCRYPTION_KEY_VERSION`, `SECURITY_ALERT_EMAIL`.

### Rate limiting
- **Status**: Shipped
- **Code**: `services/api-gateway/src/middleware/rate-limit.middleware.ts`, `rate-limiter.ts`.
- **Env**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_URL`.

### Observability (pino logs + metrics)
- **Status**: Shipped
- **Code**: `packages/observability/`.
- **Env**: `LOG_LEVEL`.

### Enterprise hardening (audit + circuit breaker)
- **Status**: Shipped
- **Code**: `packages/enterprise-hardening/`.

### MCP integration
- **Status**: Scaffolded
- **Env**: `MCP_API_KEY`, `MCP_API_KEYS`, `MCP_ENABLED`, `MCP_RATE_LIMIT`, `MCP_DEFAULT_TIER`, `MCP_MONTHLY_BUDGET_USD`, `MCP_HEALTH_CHECK_INTERVAL_S`.

---

## Enabling a flagged feature (summary)

1. Add the env override to your `.env`:
   `FF_AI_COPILOT=true`
2. Ensure the feature's backing services / keys are configured (see table
   above).
3. Restart the affected service/app.
4. Verify via `isEnabled(...)` in code or via the admin portal's Feature Flags
   page (`/platform/feature-flags`).

For dynamic per-tenant/per-user toggles, write to the `feature_flags` table
(see `packages/config/README.md` for schema).
