# Wave 18 Agent A — Hardcoded Data Sweep

Scope: `apps/`, `packages/`, `services/` — production code only. Tests, fixtures,
seeds, migrations (SQL defaults), and anything under paths containing
`mock`/`fixture` were skipped per brief.

## Fixed (28)

### Hardcoded fixture arrays / maps removed from production pages

- `apps/owner-portal/src/app/tenants/communications/page.tsx:25-31` — removed
  `[{tenantName: 'John Kamau', …}, {Mary Wanjiku …}, {Peter Ochieng …}]` fixture
  fallback. Now renders real `useTenantCommunications()` result with an
  `EmptyState` when empty.
- `apps/owner-portal/src/app/compliance/insurance/page.tsx:11-17` — removed 3
  Jubilee/APA insurance policies for Westlands/Kilimani. Added `EmptyState`
  rendering when `policies` is empty.
- `apps/owner-portal/src/app/compliance/licenses/page.tsx:11-17` — removed 3
  RL-/FSC- licenses for Westlands/Kilimani. Added `EmptyState`.
- `apps/owner-portal/src/app/compliance/inspections/page.tsx:11-18` — removed 4
  Fire-Safety/Electrical/Health-Safety inspections. Added `EmptyState`.
- `apps/owner-portal/src/app/vendors/contracts/page.tsx:18-24` — removed
  QuickFix Plumbing / SafeElectric / CleanPro contract fixtures. Added
  `EmptyState`.
- `apps/owner-portal/src/app/budgets/page.tsx:33-50` — removed hardcoded
  TZS-25M budget + 3-property list (Westlands/Kilimani/Lavington). Now
  renders real `useBudgetSummary()` / `useProperties()` or zeros.
- `apps/owner-portal/src/app/budgets/[propertyId]/page.tsx:45-57` — removed
  hardcoded 12M Westlands budget. Added `EmptyState` when `usePropertyBudget()`
  returns null.
- `apps/admin-portal/src/app/integrations/webhooks/page.tsx:30-79` — removed
  4-webhook fixture array (Acme / Sunrise / Highland). Rewired to real fetch
  at `GET /admin/webhooks` with loading/error/retry UI.
- `apps/admin-portal/src/app/integrations/api-keys/page.tsx:30-75` — removed
  4-API-key fixture array (Acme / Highland). Rewired to real fetch at
  `GET /admin/api-keys` with loading/error/retry UI.
- `apps/admin-portal/src/app/platform/subscriptions/page.tsx:28-84` — removed
  5-subscription fixture array (Acme/Sunrise/Metro/Coastal/Highland). Rewired
  to real fetch at `GET /admin/subscriptions` with loading/error/retry UI.
- `apps/admin-portal/src/pages/OperationsPage.tsx:110-159` — replaced entire
  `useEffect` mock-data seed block (10 fake system-health services, 5
  exceptions naming Acme/Sunset/Prime/Urban/Coastal, 5 stuck workflows, 5
  AI decisions, 6 health-metric points) with empty arrays plus a comment
  explaining live wiring is pending.
- `apps/admin-portal/src/pages/ReportsPage.tsx:319-346` — removed hardcoded
  "Top Performing Tenants" Acme/Highland/Sunrise/Metro/Coastal list. Added a
  placeholder note saying the endpoint isn't wired.
- `apps/admin-portal/src/pages/SupportPage.tsx:48-135` — replaced 4 hardcoded
  SUP-2025-* tickets (with fake `john@acmeproperties.co.ke`,
  `mary@sunriserealty.co.ke`, `david@highland.co.ke`,
  `fatma@coastalestates.co.ke`) with an empty array.
- `apps/admin-portal/src/pages/RolesPage.tsx:185` — removed hardcoded
  `createdBy: 'admin@bossnyumba.com'` on optimistic role create. The
  backend fills this in from the authenticated principal; optimistic row
  carries an empty string.

### Estate-manager-app mock-data file-level fixtures zeroed out

All of the below had `// Mock data - replace with API` comments above module-
level const arrays full of `Sunset Apartments` / `Mary Wanjiku` / `Peter Ochieng`
/ `Grace Muthoni` / etc. Each has been replaced with an empty array and a
comment explaining that the live endpoint is pending.

- `apps/estate-manager-app/src/app/notifications/page.tsx:7-12`
- `apps/estate-manager-app/src/app/reports/page.tsx:46-51`
- `apps/estate-manager-app/src/app/reports/scheduled/page.tsx:18-36`
- `apps/estate-manager-app/src/app/messaging/page.tsx:20-49`
- `apps/estate-manager-app/src/app/messaging/[id]/page.tsx:16-92`
  (Record map with 3 conversation threads emptied)
- `apps/estate-manager-app/src/app/messaging/new/page.tsx:9-20` — tenants
  directory + staff directory
- `apps/estate-manager-app/src/app/announcements/page.tsx:21-50`
- `apps/estate-manager-app/src/app/announcements/[id]/page.tsx:10-52`
  (Record map with 3 announcements emptied)
- `apps/estate-manager-app/src/app/calendar/page.tsx:28-35`
- `apps/estate-manager-app/src/app/calendar/events/page.tsx:20-28`
- `apps/estate-manager-app/src/app/utilities/readings/page.tsx:36-43`
- `apps/estate-manager-app/src/app/utilities/bills/page.tsx:22-29`
- `apps/estate-manager-app/src/app/settings/profile/page.tsx:10-16` — replaced
  hardcoded `firstName: 'John'` / `lastName: 'Manager'` /
  `email: 'john.manager@estate.com'` / `role: 'Estate Manager'` initial state
  with empty strings.

### Server-side hardcodes fixed

- `services/document-intelligence/src/routes/documents.routes.ts:601-615` —
  `GET /identity/:customerId/profile` was returning a stub body with
  `fullName: 'John Doe'` / `verificationStatus: 'complete'` /
  `completenessScore: 85`. Changed to return `501 NOT_IMPLEMENTED` so
  callers cannot accidentally render demo identities.
- `services/api-gateway/src/routes/mcp.router.ts:252-264` — A2A Agent Card
  `baseUrl` fallback chain was `x-forwarded-host → 'http://localhost:3000'`.
  Inserted `PUBLIC_BASE_URL` env var between those two so prod (without
  reverse proxy headers) reads from config rather than a hardcoded
  localhost URL. Dev fallback preserved.

## Deferred (3)

- `services/payments-ledger/src/server.ts:154-163` — `getTenantAggregate()`
  reads `PLATFORM_FEE_PERCENT` from env (falling back to `5.0`). The
  5% fallback is OK for local dev, but production should always pull per-
  tenant fee from the tenant-service. The comment on line 151-152 already
  flags this as TODO. Leaving as-is because rewiring to a tenant-service
  HTTP call is a multi-file change that belongs in a dedicated wave.
- `apps/customer-app/src/app/layout.tsx:34` — `return new URL('http://localhost:3002')`.
  Unable to verify without running the app whether this is dev-only (the
  surrounding function returns early on prod checks) or whether it needs an
  env-driven public URL. Recommended fix: mirror the pattern in
  `apps/admin-portal/src/lib/api.ts` (throw in prod, localhost for dev).
- `services/document-intelligence/src/routes/documents.routes.ts` remaining
  stub responses (20+ endpoints each returning fabricated shapes like
  `{documentId: id, riskLevel: 'low', score: 0.15}`). The route is not
  mounted by the gateway so it does not ship to clients today, but if it
  ever gets mounted it needs the `liveDataRequired`-style guard applied at
  the module level (as the estate-manager-app BFF already does). Only
  fixed the one that would have leaked `John Doe`. Recommended fix: add
  a module-level middleware `app.use('*', live503('Document intelligence'))`
  mirroring `services/api-gateway/src/middleware/live-data.ts`.

## Verified safe (K)

- `['current', '1-30', '31-60', ...]` aging-bucket literals in
  `packages/database/…`, `packages/chat-ui/src/generative-ui/block-generator.ts`,
  `services/api-gateway/src/composition/arrears-infrastructure.ts`,
  `services/payments-ledger/src/arrears/arrears-case.ts`,
  `services/document-intelligence/src/types/index.ts` — these are enum
  values for arrears aging, not tenant IDs.
- `'current' | 'deprecated' | 'sunset'` API version status literals in
  `packages/enterprise-hardening/src/enterprise/partner-api.ts` — enum, fine.
- `status: 'current'` on the onboarding-step wizard in
  `apps/customer-app/src/app/onboarding/page.tsx` — UI state enum.
- Currency literals `'TZS'`, `'KES'`, `'UGX'`, `'USD'` in payment provider
  guards (`services/payments/src/providers/tigopesa/payment.ts`,
  `mpesa/b2c.ts`, `mpesa/query.ts`, `tanzania-payment-factory.ts`) — these
  are provider-specific currency constraints. MpesaKE legitimately only
  accepts KES, GePG only TZS; these are not user-facing policy.
- `'sandbox' | 'production'` defaults across GePG / M-Pesa / Africa's Talking
  (`services/api-gateway/src/routes/gepg.router.ts`,
  `services/payments/src/mpesa/stk-push.ts`,
  `services/notifications/src/sms/africas-talking.ts`,
  `services/payments-ledger/src/server.ts`) — safe defaults; all driven by
  env vars, and GePG throws in prod if `GEPG_CALLBACK_BASE_URL` is unset.
- `'http://localhost:*'` fallbacks in
  `packages/config/src/index.ts`,
  `apps/{admin,owner,estate-manager,customer}-portal/src/{lib,app,providers}/…`
  — every one is inside an `import.meta.env.PROD` / `process.env.NODE_ENV`
  guard that throws in production when the real env var is missing. Dev
  fallback only.
- Grade cutoffs / score thresholds in `packages/ai-copilot/src/property-grading`
  and related services — these ARE the policy. Not mock data.
- Hardcoded `scope.properties` / `scope.units` rollup caps of 1000 in
  `services/api-gateway/src/routes/bff/owner-portal.ts` — pagination limits,
  not tenant-specific policy.
- `services/api-gateway/src/routes/bff/estate-manager-app.ts:141-145` already
  gated behind `liveDataRequired('Estate manager BFF')` — the `cust-001` /
  `vendor-001` / `prop-001` stubs inside are never returned in prod (503).
- `services/api-gateway/src/routes/modules/payments.routes.ts:84` already
  gated behind `liveDataRequired('Payments module')` — `inv-001`/`inv-002`/
  `inv-003` stubs are never returned in prod.
- `'John Doe'` string in `services/notifications/src/whatsapp/templates.ts`
  line 115 / 121 — appears inside an _example_ WhatsApp onboarding message
  ("Example: \"John Doe, 0712345678\"") shown to tenants as a format hint.
  Legitimate.
- `@example.com` placeholder values in email inputs across
  `apps/*/auth/register/page.tsx`, `apps/*/profile/edit/page.tsx`,
  `apps/owner-portal/src/pages/LoginPage.tsx`, `CoOwnerInviteModal.tsx`,
  `VendorForm.tsx`, etc. — all are `placeholder=` attributes on `<input>`
  elements, not default state. These are UI hints.
- `'http://localhost:3000'` / `:3001` / `:3002` / `:3003` in
  `services/api-gateway/src/index.ts:202-205` — the CORS allow-list for
  dev only. Production throws if `ALLOWED_ORIGINS` env var is unset (see
  line 195-199).

## Typecheck status

- `services/api-gateway/pnpm typecheck` — fails on
  `src/composition/credit-rating-repository.ts:31:17 TS2709: Cannot use
  namespace 'DatabaseClient' as a type`. This file is NOT one I touched;
  the error pre-exists on `main` (confirmed via `git stash` + typecheck
  round-trip). The cause is a mismatch between the new
  `packages/database/src/schemas/index.ts` (another agent's WIP change)
  and `@bossnyumba/database`'s `DatabaseClient` export shape. Flagging
  for whoever owns the database-schema integration wave — not for Agent A.
- `apps/admin-portal`, `apps/owner-portal`, `apps/estate-manager-app`
  typecheck all pass clean after my edits.
- `services/document-intelligence` typecheck passes clean after my edit.
