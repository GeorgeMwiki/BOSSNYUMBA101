# Production-Readiness Audit (2026-05-18)

**Branch:** `claude/phase-d-comprehensive-gap-closure` (PR #84 open)
**Scope:** Read-only sweep of `apps/`, `packages/`, `services/` for mock data,
hardcoded values, NOT_YET_WIRED stubs, demo placeholders and TZ-only
assumptions that block production deployment.
**Method:** `grep` over source paths excluding `__tests__/`, `*.test.ts`,
`*.spec.ts`, `dist/`, `node_modules/`. Every entry was opened and read
to confirm classification.

---

## Summary

| Class | Count |
|---|---|
| CRITICAL (blocks production deployment) | 6 |
| HIGH (must-fix before public launch) | 14 |
| MEDIUM (must-fix before world-launch) | 22 |
| LOW (nice-to-have) | 18 |

**Top-line:** The codebase ships clean deterministic refusals for every
external dependency it does not own (NIDA, e-Ardhi, KRA-MRI, Temporal
dispatchers). The biggest production-readiness gaps are: (1) an OCR
provider that imports fixture data into production-shipped JavaScript and
defaults to those fixtures when `OCR_PROVIDER` is unset; (2) hardcoded
`localhost:4001` API base URLs in customer-app pages with no production
guard; (3) the dynamic-UI substrate's payload schema still hard-codes
the currency enum to `'KES'|'TZS'|'USD'` so any other jurisdiction loses
formatting; (4) the recently-added `tenants.region` column is read by
nobody; (5) `currency_preferences` exists but most ledger / invoice /
PDF code paths still default to `'KES'` or `'TZS'`.

---

## (1) Mock data in non-test paths

### CRITICAL

| File | Line | Pattern | Suggested fix |
|---|---|---|---|
| `services/document-intelligence/src/providers/mock.provider.ts` | 12-16 | Imports five `.fixture.ts` files (`tanzaniaNidaFixture`, `kenyaIdFixture`, `drivingLicenceFixture`, `utilityBillFixture`, `bankStatementFixture`) from `../../__fixtures__/ids/` into a class that ships in production build output. | Move fixtures under `__tests__/__fixtures__/`, gate `FixtureMockProvider` import behind `if (process.env.NODE_ENV !== 'production')` (mirror what `services/api-gateway/src/data/mock-data.ts` does). |
| `services/document-intelligence/src/providers/ocr-factory.ts` | 50-110 | `getOcrProviderFromEnv()` defaults `OCR_PROVIDER` to `'mock'` when the env var is unset, and `fallbackToMock` defaults to `true` in any environment except production. A missed config in staging or QA silently serves fixtures. | Default to a `ProviderUnavailableError` when `OCR_PROVIDER` is unset. Require explicit `OCR_PROVIDER=mock` (loud) for dev. |

### HIGH

| File | Line | Pattern | Suggested fix |
|---|---|---|---|
| `packages/database/src/services/platform/tenants.platform.service.ts` | 305 | `const lastName = 'TBD';` — hardcoded fallback when provisioning a tenant via the HQ tool surface. The tenant's owner-user record ships with `lastName: 'TBD'` until someone edits it. | Either require a `lastName` in the `provisionTenant` input, or surface a "profile incomplete" badge on the user row instead of seeding a literal `'TBD'`. |
| `services/notifications/src/whatsapp/conversation-orchestrator.ts` | 575 | `moveInDate: ctx.moveInDate \|\| 'TBD'` — passes the literal string `'TBD'` into a WhatsApp template variable when the move-in date is missing. | Refuse to render the template if `moveInDate` is missing; ask the orchestrator's state machine to backfill before send. |
| `services/notifications/src/whatsapp/templates.ts` | 115, 121 | Bilingual WhatsApp prompt strings include `Example: "John Doe, 0712345678"`. The phone format implies KE only. | Resolve the example via the recipient's `tenant.country` so TZ tenants see `+255…`. |

### MEDIUM / LOW

| File | Line | Pattern | Suggested fix |
|---|---|---|---|
| `services/api-gateway/src/routes/owner/billing.router.ts` | 1-20 | Whole router returns a `placeholder state` — the comment explicitly notes "platform billing is not yet wired". | Wire to a real billing-period table or 503 with a feature flag instead of empty `placeholder`. |
| `services/api-gateway/src/composition/mcp-wiring.ts` | 390 | `{ tenantId: context.tenantId, note: 'portfolio overview placeholder' }` is returned from `portfolioOverview()` to the MCP server. | Wire to `repos.properties.aggregatesForTenant(tenantId)`. |
| `packages/observability/src/audit-logger.ts` | 115 | docstring example uses `John Doe`, `john@example.com`. | Strip from the docstring or replace with neutral `<user>`. |
| `apps/customer-app/src/contexts/AuthContext.tsx` | 60, 65, 170, 193 | Four `TODO: wire to real session-exchange / org-switch / invite-redeem endpoints`. The client-side calls are no-ops today. | Wire each to the documented endpoint. |
| `apps/admin-platform-portal/src/app/api/platform/me/route.ts` | 9, 25 | Local route reads the session cookie and returns a hardcoded shape — comment says "TODO: replace with identity-service call". | Proxy to the identity service. |
| `apps/admin-platform-portal/src/app/api/platform/login/route.ts` | 6 | Same pattern — TODO to land identity-service login. | Same. |
| `apps/admin-platform-portal/src/app/api/platform/intelligence/threads/route.ts` | 6 | TODO to proxy threads to api-gateway. | Wire the proxy. |
| `apps/admin-platform-portal/src/app/api/platform/intelligence/thread/[threadId]/route.ts` | 6 | Same. | Same. |
| `apps/admin-platform-portal/src/app/api/platform/intelligence/thread/route.ts` | 6 | Same. | Same. |
| `apps/admin-platform-portal/src/app/api/platform/budget/route.ts` | 6 | TODO to call the platform DP-accountant. | Wire DP-accountant. |
| `services/api-gateway/src/routes/bff/admin-portal.ts` | 118, 128, 139, 148 | Four BFF endpoints (`/webhooks`, `/api-keys`, `/roles`, `/roles/audit`) return hardcoded `{ success: true, data: [] }` — explicit comments document the unwired downstream. | Wire each handler — concrete next-step is documented in each TODO. |
| `services/api-gateway/src/routes/payments.ts` | 205 | "Same placeholder until the repo is wired." | Wire `repos.payments.findMany`. |
| `services/api-gateway/src/services/payouts/providers/eft-stub-adapter.ts` | 1-30 | Whole file is "EFT placeholder adapter". | Wire a real bank EFT adapter (Stripe Treasury, Yapily, or per-jurisdiction). |

---

## (2) Hardcoded TZ/KE-only / jurisdictional assumptions

### CRITICAL

| File | Line | Hardcode | Why it blocks world-launch |
|---|---|---|---|
| `packages/central-intelligence/src/kernel/tools/render-blocks/ag-ui-types.ts` | 41, 60 | `currency?: 'KES' \| 'TZS' \| 'USD'` — the AG-UI UiPart contract's `DataTableColumn.currency` and `KpiTile.currency` types are a 3-currency enum. Every chart, table, KPI emitted by the MD therefore loses currency formatting outside those three. | Widen to the ISO-4217 string set already used in `packages/domain-models/src/common/currencies.ts`. |
| `packages/central-intelligence/src/kernel/tools/render-blocks/schemas.ts` | 26 | `const CurrencySchema = z.enum(['KES', 'TZS', 'USD']);` — Zod validator. Anything else throws. | Same — use ISO-4217 ALL_CURRENCY_CODES. |
| `packages/central-intelligence/src/kernel/tools/render-blocks/tools.ts` | 94, 175 | JSON-schema property `currency: { type: 'string', enum: ['KES', 'TZS', 'USD'] }` exposed to the LLM tool descriptor. | Same — widen. |
| `packages/central-intelligence/src/kernel/tool-spec/owner-tools/owner.financial_summary.ts` | 24, 29, 50, 92 | Owner financial-summary tool's input + output currency Zod schema is the same 3-currency enum. Hardcodes `currency: input.currency ?? 'KES'`. | Resolve default from `currency_preferences` (tenant scope) instead of literal `'KES'`. |
| `packages/central-intelligence/src/kernel/tool-spec/owner-tools/owner.list_arrears.ts` | 31, 39 | Same 3-currency enum. | Same. |
| `packages/central-intelligence/src/kernel/tool-spec/owner-tools/owner.next_actions.ts` | 39 | Same 3-currency enum. | Same. |

### HIGH

| File | Line | Hardcode | Suggested fix |
|---|---|---|---|
| `packages/database/src/schemas/tenant-finance.schema.ts` | 91 | `incomeCurrency: text('income_currency').notNull().default('KES')` — DB default for every new tenant-finance row. | Resolve from `tenants.country` → plugin `currencyCode`. Pre-fill via app-layer logic, not DB default. |
| `packages/database/src/schemas/marketplace.schema.ts` | 89, 148, 202 | Three `currency text default 'KES'` columns. | Same. |
| `packages/database/src/schemas/conditional-survey.schema.ts` | 189 | `currency text default 'KES'`. | Same. |
| `packages/database/src/schemas/negotiation.schema.ts` | 93 | `currency text default 'KES'`. | Same. |
| `packages/central-intelligence/src/kernel/kernel.ts` | 2208-2209 | Fact-formatter switch hardcodes `currency-tzs` → `TZS …` and `currency-kes` → `KES …`. Any other currency code is silently dropped from the LLM's working-set. | Replace with `format(amount, currencyCode, locale)` from a shared formatter. |
| `packages/central-intelligence/src/kernel/tools/graph-tools.ts` | 285, 654, 686 | `'KES'` as the literal currency fallback when reading from the property graph (`CASE WHEN size(currencies) > 0 THEN head(currencies) ELSE 'KES' END`). | Use `tenants.country`-driven default. |
| `services/api-gateway/src/services/monthly-close/pdf-renderer.ts` | 119, 146 | PDF generator hardcodes `currencyCode: 'XXX'` (the ISO unknown-currency code) as the fallback. Customer-facing artifact. | Resolve from the run's tenant currency preference. |
| `services/api-gateway/src/services/monthly-close/pdf-templates/owner-statement-template.ts` | 94, 116 | Same `'XXX'` fallback. | Same. |
| `services/api-gateway/src/services/monthly-close/statement-adapter.ts` | 176 | SQL `${currency || 'XXX'}` literal. | Same. |
| `packages/database/src/seeds/demo-org-seed.ts` | 644, 663, 684, 715, 736, 763 | Six `currency: 'TZS'` / `defaultCurrency: 'TZS'` hardcodes in the demo seed. Demo-only — but it pins the demo to TZ. | Parameterise the seed (`--country=TZ` flag). |

### MEDIUM

| File | Line | Hardcode | Suggested fix |
|---|---|---|---|
| `packages/database/src/seeds/demo-org-seed.ts` | 347, 377, 408 | `timezone: 'Africa/Dar_es_Salaam'` hardcoded in demo seed. | Same — parameterise. |
| `packages/database/src/seeds/sample-tenants.ts` | 9 | "Amounts denominated in TZS minor units" — sample tenants pinned to TZ. | Same. |
| `services/api-gateway/src/schemas/index.ts` | 19, 26 | E.164 validator forces `^\+255[67]\d{8}$` for "Tanzanian phone number" (`tanzanianPhoneSchema`). Generic schema is fine; the TZ-specific schema is referenced from at least one user-input boundary. | Either delete the TZ-specific schema or rename to make scope explicit; use the country plugin's `phoneRegex`. |
| `packages/database/src/services/sovereign-action-ledger.service.ts` | 170, 175 | Comments + presumably regex shapes specific to `+254` / `+255` for PII redaction. | This is PII redaction — the multi-jurisdiction set is fine, but add `+256`, `+250` and the long-tail list from `region-config.ts`. |
| `packages/ai-copilot/src/progressive-intelligence/extraction-patterns.ts` | 64-81 | TZ and KE phone-prefix regexes hardcoded inline. | Move to `packages/domain-models/src/common/region-config.ts` and consume the per-region pattern. |
| `apps/customer-app/src/app/onboarding/orientation/page.tsx` | 110 | UI string `Report suspicious activity to security: +254 700 000 111` hardcoded — KE-only phone for a "global" app. | Pull from `tenant.supportPhone` or strip. |
| `packages/database/src/schemas/tenant.schema.ts` | 108 | `region: text('region').notNull().default('eu-west-1')` — DB default. Acceptable for now since the schema doc cites `AWS_REGION` global default but consult `currency_preferences` and `tenants.country` to flip the default. | Make this nullable + resolve via composition root using the tenant's home country → ISO-3166 → AWS region mapping. |
| `services/document-intelligence/src/providers/ocr-factory.ts` | 63 | `region: env.AWS_REGION ?? 'us-east-1'` — TZ tenants get routed to US-East. | Pull from `tenants.region`. |
| `packages/enterprise-hardening/src/resilience/disaster-recovery.ts` | 70 | `'us-east-1'` / `'europe-west1'` literal examples in a comment doc-string. | Leave (doc-only). |

### LOW

- `packages/central-intelligence/src/kernel/persona.ts:42`: persona prompt mentions `'- Every figure carries an ISO-4217 code (TZS, KES, UGX, USD) on first mention'` — fine.
- `packages/central-intelligence/src/kernel/policy-gate.ts:114`: `ABSOLUTE_MONEY_PATTERN = /\b(TZS|KES|USD)\s?\d[\d,]*\b/g` — detector; widen to ISO-4217 set.
- `packages/central-intelligence/src/kernel/self-rag/self-rag.ts:81`: `/\b(?:TZS|KES|UGX|USD|EUR|GBP|TSH|KSH)\s*[\d,]+/i` — detector; widen.
- `packages/central-intelligence/src/kernel/confidence.ts:43`: `FACTUAL_SIGNALS = /(\d|\$|TZS|KES|USD|%|...)/i` — heuristic; fine.
- `packages/marketing-brain/src/demo-data-generator.ts:31`: `Currency: 'KES' \| 'TZS' \| 'UGX'` enum. Demo-only.
- `packages/marketing-brain/src/sandbox/sandbox-estate-generator.ts:33, 85, 96`: same.
- `packages/ai-copilot/src/security/pii-scrubber.ts:217-219`: `TZS`/`KSh`/`KES` patterns are PII detectors; widen to a fuller ISO-4217 + symbol set.

---

## (3) NOT_YET_WIRED stubs

All NOT_YET_WIRED stubs live in **one** file: `services/api-gateway/src/composition/hq-tool-registry.ts`. Each surfaces a deterministic refusal (clean `executor-failed` or `gateway-error`) — they are not bugs, but every one is a deferred wire that blocks the corresponding HQ-tool from doing real work.

| # | Stub | Stub file:line | Real adapter exists? | Wire-site (where prod composition should plug) | Priority |
|---|---|---|---|---|---|
| 1 | `tenantsList` | hq-tool-registry.ts:614 | YES — `packages/database/src/services/platform/tenants.platform.service.ts` | `buildHqDepsFromDb()` (replaced when `db` is non-null). | (already wired) |
| 2 | `usersList` | hq-tool-registry.ts:619 | YES — `packages/database/src/services/platform/users.platform.service.ts` | Same. | (already wired) |
| 3 | `heartbeats` | hq-tool-registry.ts:624 | YES — `packages/database/src/services/platform/service-heartbeat.service.ts` | Same. | (already wired) |
| 4 | `tracesQuery` | hq-tool-registry.ts:640 | YES — kernel decision-trace recorder. | Same. | (already wired) |
| 5 | `flagsRead` | hq-tool-registry.ts:645 | YES — feature-flag service. | Same. | (already wired) |
| 6 | `tenantsCreate` | hq-tool-registry.ts:654 | YES — same `tenants.platform.service.ts`. | Same. | (already wired) |
| 7 | `usersCreate` | hq-tool-registry.ts:665 | YES — `users.platform.service.ts`. | Same. | (already wired) |
| 8 | `flagsWrite` | hq-tool-registry.ts:679 | YES — feature-flag service. | Same. | (already wired) |
| 9 | `consolidation.runTick / rollback` | hq-tool-registry.ts:569, 687 | YES — `services/consolidation-worker/src/index.ts`. **In-process or RPC binding required.** | `createHqToolRegistry({ consolidationWorker })` in service-registry. | HIGH — Phase D2 |
| 10 | `killswitchWrite` | hq-tool-registry.ts:695 | YES — killswitch table + cross-portal fanout (already wired). | Same. | (already wired) |
| 11 | `invoices.applyAdjustment / reverseAdjustment` | hq-tool-registry.ts:703 | YES — payments-ledger service. | Same. | HIGH |
| 12 | `announcements.send / recall` | hq-tool-registry.ts:714 | PARTIAL — `notification-dispatcher-adapter.ts` exists. | service-registry composition. | HIGH |
| 13 | `evictionDispatcher.start / withdraw` | hq-tool-registry.ts:736 | YES — `temporal/eviction-workflow.ts` + `temporal-dispatcher-wiring.ts`. | `createHqToolRegistry({ evictionDispatcher })` from Temporal binding. | CRITICAL — Phase D2 wire-up |
| 14 | `ownerPayoutDispatcher.start / refund / estimateUsdCents` | hq-tool-registry.ts:747 | YES — `temporal/owner-payout-workflow.ts`. | Same. | CRITICAL |
| 15 | `kraMriDispatcher.start / requestRetraction` | hq-tool-registry.ts:761 | PARTIAL — `temporal/kra-mri-filing-workflow.ts` + `temporal/kra-erits-filing-workflow.ts`. Real iTax driver still TODO per `legacy-portal-bridge.ts:23-29`. | Same Temporal binding. Adapter still needs real KRA iTax driver. | HIGH — KE rollout |
| 16 | `nida.verifyIdentity` | hq-tool-registry.ts:777 | YES — `packages/connectors/src/adapters/nida-adapter.ts`. **NOT BOUND to the gateway.** | `createHqToolRegistry({ nida: realNidaAdapter })`. | CRITICAL — TZ identity flow |
| 17 | `eardhi.verifyTitle` | hq-tool-registry.ts:793 | YES — `packages/connectors/src/adapters/eardhi-adapter.ts`. **NOT BOUND.** | Same. | CRITICAL — TZ title-deed flow |

---

## (4) Demo / placeholder UI

| File | Line | Pattern | Class |
|---|---|---|---|
| `services/api-gateway/src/routes/notifications.ts` | 13 | `GET /unread/count — placeholder unread-count (requires in-app store)` — handler returns a constant. | HIGH |
| `services/api-gateway/src/routes/owner/billing.router.ts` | 15 | Whole router returns "placeholder state instead of 404'ing". | HIGH |
| `services/api-gateway/src/routes/bff/customer-app.ts` | 313, 316 | "TODO note. We still call listOpen so connectivity errors surface" — half-wired endpoint. | MEDIUM |
| `services/api-gateway/src/routes/bff/owner-portal.ts` | 686, 997 | TODO-marked owner-portal BFF handlers. | MEDIUM |
| `services/api-gateway/src/routes/owner/admin-users.router.ts` | 24 | TODO to wire admin-user list endpoint. | MEDIUM |
| `services/api-gateway/src/routes/owner/analytics-growth.router.ts` | 14 | TODO to wire growth aggregator. | MEDIUM |
| `services/api-gateway/src/routes/owner/analytics-usage.router.ts` | 14 | TODO to wire usage aggregator. | MEDIUM |
| `services/api-gateway/src/routes/owner/analytics-exports.router.ts` | 13 | TODO to land analytics export domain. | MEDIUM |
| `services/api-gateway/src/routes/owner/owner-messaging.router.ts` | 23 | TODO to wire bulk-comms domain. | MEDIUM |
| `services/api-gateway/src/routes/owner/support.router.ts` | 13 | TODO to wire support tickets. | MEDIUM |
| `services/api-gateway/src/routes/portfolio.router.ts` | 18 | TODO to swap `/performance` + `/growth` placeholders. | MEDIUM |
| `services/api-gateway/src/routes/migration.router.ts` | 167 | TODO to wire migration-wizard copilot. | MEDIUM |
| `services/api-gateway/src/routes/analytics.router.ts` | 18 | TODO to replace aggregation with a pre-aggregated table. | LOW |
| `services/api-gateway/src/routes/vacancy-pipeline.router.ts` | 62, 153, 166, 179, 190, 200, 214 | Seven TODOs in the vacancy-pipeline BFF — all wires. | HIGH (whole flow stubbed) |
| `services/api-gateway/src/routes/feedback.ts` | 123 | TODO to split into a dedicated `turn_feedback` table. | LOW |
| `apps/admin-platform-portal/src/components/SessionReplayViewer.tsx` | 19 | Phase-C TODO. | LOW |
| `apps/admin-platform-portal/src/lib/genui/MapView.tsx` | 12 | Offline tile-cache TODO. | LOW |
| `apps/admin-platform-portal/src/lib/genui/MapInner.tsx` | 7 | Same. | LOW |
| `apps/estate-manager-app/src/app/announcements/create/page.tsx` | 39 | `TODO(api): wire to a POST /api/v1/announcements endpoint` — form is wired to console.log today. | HIGH |
| `apps/customer-app/src/components/OrgSwitcher.tsx` | 116 | `TODO: next/navigation router.push('/onboarding/redeem-code')` — partial wiring. | MEDIUM |
| `apps/customer-app/src/app/auth/register/page.tsx` | 127 | UI `placeholder="+XXX XXX XXX XXX"` — generic, no per-country hint. | LOW (i18n / region polish) |
| `apps/customer-app/src/app/profile/edit/page.tsx` | 150, 194 | Same generic placeholder. | LOW |
| `apps/estate-manager-app/src/app/customers/new/page.tsx` | 145 | Same. | LOW |
| `apps/estate-manager-app/src/app/settings/profile/page.tsx` | 86 | Same. | LOW |

---

## (5) Hardcoded credentials / URLs / keys

### CRITICAL

| File | Line | Pattern | Class |
|---|---|---|---|
| `apps/customer-app/src/app/lease/renewal/page.tsx` | 35 | `return 'http://localhost:4001/api/v1';` — fallback when `NEXT_PUBLIC_API_URL` is unset. **NO production guard** (unlike `lib/api.ts` which throws). | CRITICAL |
| `apps/customer-app/src/app/maintenance/triage/page.tsx` | 255 | Same. | CRITICAL |
| `apps/customer-app/src/app/maintenance/new/page.tsx` | 29 | Same. | CRITICAL |
| `apps/customer-app/src/app/notifications/page.tsx` | 32 | Same. | CRITICAL |
| `apps/customer-app/src/app/layout.tsx` | 35 | `return new URL('http://localhost:3002');` — metadata-base for OG tags. | HIGH |

**Fix pattern:** Each of these pages duplicates the dev-fallback. Hoist into a shared `getApiBase()` that mirrors `apps/customer-app/src/lib/api.ts:27-29` and throws in production.

### HIGH / MEDIUM (env-gated, but worth noting)

- `apps/admin-platform-portal/src/app/api/platform/intelligence/thread/[threadId]/message/route.ts:41` — falls back to `http://localhost:4000/api/v1` when env is unset.
- `apps/admin-platform-portal/src/app/api/platform/overview/route.ts:21` — same.
- `apps/admin-platform-portal/src/app/jarvis/JarvisConsole.tsx:28` — fallback to `http://localhost:4000` for `NEXT_PUBLIC_API_GATEWAY_URL`.
- `apps/customer-app/src/app/jarvis/JarvisConsole.tsx:29` — same.
- `apps/admin-platform-portal/src/app/insights/page.tsx:19`, `app/page.tsx:44`, `app/industry/page.tsx:30`, `app/forecasts/page.tsx:21` — fallback to `http://localhost:3020` for the platform portal base URL.
- `apps/admin-platform-portal/src/app/session-replay/page.tsx:42` — fallback to `http://localhost:3001`.
- `services/api-gateway/src/index.ts:309-312` — ALLOWED_ORIGINS dev-only allowlist of `localhost:3000-3003`. Already prod-gated inside the index but worth re-reading the gate.
- `services/api-gateway/src/routes/gepg.router.ts:46` — `callbackBaseUrl: callbackBaseUrl ?? 'http://localhost:3000'`.
- `services/api-gateway/src/routes/mcp.router.ts:303` — same.

### NOT FOUND

- No hardcoded `sk-…` API tokens in production source.
- No hardcoded `Bearer …` tokens.
- No hardcoded `api_key_…` literals.
- No hardcoded DB credentials in source — all read from `DATABASE_URL`.
- No hardcoded S3 bucket names outside `packages/config/src/schemas.ts`.

---

## (6) Code paths that bypass production gates

### HIGH

| File | Line | Issue |
|---|---|---|
| `services/document-intelligence/src/providers/ocr-factory.ts` | 89-97, 103 | `OCR_PROVIDER` defaults to `'mock'` when unset; `OCR_FALLBACK_TO_MOCK` defaults to `true` whenever `NODE_ENV !== 'production'`. Both should fail loud in any non-test environment. |

### LOW / MEDIUM (already guarded)

- `services/api-gateway/src/data/mock-data.ts:18-23` — **hard-fails on load** in non-test environments. Pattern to copy.
- `services/api-gateway/src/middleware/tenant-context.middleware.ts:246-268` — dev-only synthetic tenant fallback when DB lookup fails. Gated by `NODE_ENV !== 'production'`. OK.
- `services/api-gateway/src/middleware/tenant-context.middleware.ts:302-307` — `?tenantId=` query-string fallback. Gated. OK.
- `services/api-gateway/src/middleware/database.ts:64-67` — `USE_MOCK_DATA=true` is explicitly rejected in production. Good.
- `services/identity/src/otp/otp-service.ts:208` — `process.env.NODE_ENV === 'production'` check before sending. OK.
- `services/api-gateway/src/config/jwt.ts:20` — JWT-secret-required-in-production guard. OK.

**No debug or test endpoints** were found under `/api/v1/debug`, `/api/v1/dev`, `/test/` in source.

---

## (7) Dynamic UI substrate gaps

### What ships today

The AG-UI UiPart substrate (`packages/central-intelligence/src/kernel/tools/render-blocks/ag-ui-types.ts`) supports **10 UiPart kinds**:

1. `chart-vega` — Vega-Lite v5 specs.
2. `data-table` — TanStack table v8 with `text|currency|percent|number|date` formats.
3. `timeline` — vertical event list with severity.
4. `kpi-grid` — tiles with delta + format.
5. `prefill-form` — JSON-Schema-driven form.
6. `approval` — HIL approve/reject with diff + 5-item checklist.
7. `workflow` — step-progress (`pending|running|done|failed`).
8. `map` — Leaflet-style map with lat/lng markers.
9. `calendar` — FullCalendar-style event list.
10. `file-preview` — PDF/image preview.

The kernel-side render-block tools live in `packages/central-intelligence/src/kernel/tools/render-blocks/tools.ts`.

### Where it is consumed

- **`apps/admin-platform-portal/src/lib/genui/`** is the canonical AG-UI renderer. `AdaptiveRenderer.tsx` switches on `uiPart.kind` and dispatches to typed components (`VegaChart`, `DataTable`, `Timeline`, `KpiGrid`, `PrefillForm`, `ApprovalDialog`, `WorkflowStepper`, `CalendarView`, `MapView`, `FilePreview`).
- **`apps/admin-platform-portal/src/app/jarvis/JarvisConsole.tsx:240`** is the only place that actually renders these in a portal today.

### Critical gaps

| Gap | Detail |
|---|---|
| **Two AdaptiveRenderers** | `packages/chat-ui/src/generative-ui/AdaptiveRenderer.tsx` (older block-system: `rent_affordability_calculator`, `arrears_projection_chart`, `property_comparison_table`, `lease_timeline_diagram`, `maintenance_case_flow_diagram`, `five_ps_tenancy_risk_wheel`, `concept_card`, `quiz`, `action_buttons`, `quick_replies`, `insight_card`, `dynamic_visual`) coexists with `apps/admin-platform-portal/src/lib/genui/AdaptiveRenderer.tsx` (newer AG-UI). They have **no shared types** — the older one is consumed by `owner-portal`, `customer-app`, `estate-manager-app`; only `admin-platform-portal` consumes the AG-UI one. The MD's `tool-output-available` AG-UI events are wired only in the platform portal. |
| **Owner / customer / estate-manager portals lack a typed UiPart renderer** | `apps/owner-portal/src/components/OwnerJarvisShell.tsx:282` says "minimal AdaptiveRenderer-style dispatcher" and stringifies `uiPart.kind` as a chip — no actual rendering of `chart-vega`, `data-table`, etc. |
| **No centralised AG-UI primitive package** | The 11 components under `apps/admin-platform-portal/src/lib/genui/` are not exported as a shared package. To render UiParts in any other portal, today the components must be copied. Extract to `packages/genui` or `packages/design-system`. |
| **Currency hardcoded** | `DataTableColumn.currency` and `KpiTile.currency` are `'KES' \| 'TZS' \| 'USD'`. No other currency formats. See section (2). |

### Missing UiPart kinds the MD would need for full agency

To "render whatever surface fits the moment," the substrate is missing at least:

| # | Missing UiPart kind | Why the MD needs it |
|---|---|---|
| 1 | `kanban` | Move-in pipeline, vacancy-to-lease swimlanes, ticket queues, KRA-MRI filing states. |
| 2 | `dashboard-grid` | Composite layout — let the LLM emit a 12-col grid of N child UiParts in one part. Today the brain emits N flat parts. |
| 3 | `heatmap` | Arrears by property × month; occupancy by unit × week. Often the right answer. |
| 4 | `tree` | Owner → portfolio → property → block → unit hierarchy navigation. |
| 5 | `diff-view` | Side-by-side lease redline, inspection-photo before/after, JSON diff for HIL approvals. |
| 6 | `gauge` / `progress-radial` | NPS scores, collection-rate dials, occupancy donuts. |
| 7 | `metric-sparkline` | Inline trend behind a single KPI tile. |
| 8 | `markdown-card` | Rich narrative with citations — the chat bubble's text channel is plain. Use for case studies, briefings, decision-rationale write-ups. |
| 9 | `pdf-viewer` (full) | `file-preview` is preview-only — a full lease/title-deed reader with annotation needs a richer kind. |
| 10 | `image-annotation` | Inspection-photo finding markup, AXTree overlay. |
| 11 | `signature-pad` | Lease-renewal e-signature flow (today triggered by chat but no UI primitive). |
| 12 | `slider-input` / `range-input` | Rent-negotiation sliders, budget-allocation. |
| 13 | `multistep-wizard` | Onboarding flows that need agency-driven progression with state retention. |
| 14 | `media-grid` | Property photo galleries, inspection albums. |
| 15 | `chat-embed` | Embed a scoped sub-chat (e.g. with a tenant) inside an admin turn. |
| 16 | `live-counter` | Real-time queue depth, active sessions, payment-rail latency. |
| 17 | `org-chart` / `relationship-graph` | Tenant ↔ guarantor ↔ co-applicant, vendor network, ownership chains. |
| 18 | `quote-block` / `evidence-card` | Highlight a specific document quote with cite-link — critical for compliance reasoning. |
| 19 | `comparison-table` (typed) | The block-system has `property_comparison_table`; AG-UI needs a typed equivalent. |
| 20 | `geo-fence` (drawable map) | "Show me where this happened" + draw an alert zone. |
| 21 | `notification-toast` (server-pushed) | MD says "I just sent the email" → a typed toast confirms. Today this is conflated with the timeline. |
| 22 | `decision-trace` | Render the kernel's own provenance + reasoning trail in-line. Today there's a separate page. |
| 23 | `prompt-suggestions` (typed quick-replies) | The block-system has `quick_replies` + `action_buttons`; AG-UI does not. |
| 24 | `code-block` (read-only) | Show a SQL snippet, log line, JSON payload with syntax highlighting + copy-button. |
| 25 | `dataflow-diagram` | "Here's how I would do it" — node/edge view of an upcoming workflow. |

### Recommended Phase-E moves

1. Extract `apps/admin-platform-portal/src/lib/genui/` to `packages/genui/` or `packages/design-system/src/genui/` so all four portals import the same renderer.
2. Widen the currency union (cross-cutting fix; section 2).
3. Add the top-5 missing kinds (`kanban`, `dashboard-grid`, `heatmap`, `markdown-card`, `prompt-suggestions`) — these unlock the most common MD render needs without ballooning the substrate.
4. Add a `kind: 'unknown'` fallback to the AG-UI renderer so unknown future kinds degrade gracefully (the chat-ui renderer already does this at line 159).

---

## (8) Multi-tenant / world-built blockers

### Currency

- **Schema:** `packages/database/src/schemas/currency-preferences.schema.ts` (table) and `packages/database/src/services/currency-preferences.service.ts` (service) exist, supporting per-`{platform,tenant,user}` scopes. Good.
- **Consumed by:** `apps/customer-app/src/lib/hooks/useCurrencyPreference.ts` resolves user → tenant → platform → default. Good.
- **NOT consumed by:**
  - `services/api-gateway/src/services/monthly-close/pdf-renderer.ts` (uses `'XXX'` literal fallback).
  - `services/api-gateway/src/services/monthly-close/pdf-templates/owner-statement-template.ts`.
  - `services/api-gateway/src/services/monthly-close/statement-adapter.ts`.
  - The render-block tool schemas (`packages/central-intelligence/src/kernel/tools/render-blocks/schemas.ts`).
  - The kernel fact-formatter (`packages/central-intelligence/src/kernel/kernel.ts:2208`).
  - The DB column defaults (`tenant-finance`, `marketplace`, `negotiation`, `conditional-survey` schemas — all default `'KES'`).
  - The owner-tool surfaces (`owner.financial_summary`, `owner.list_arrears`, `owner.next_actions`).

### Region

- **Schema:** `tenants.region` added (migration 0158) with `'eu-west-1'` default.
- **Consumed by:** **NOBODY.** Grep for `tenants.region` returns the schema declaration only. The column ships unused.
- **SHOULD be consumed by:**
  - **KMS adapter** (`packages/database/src/security/encryption/`) — to choose the right KMS key per tenant.
  - **OCR factory** (`services/document-intelligence/src/providers/ocr-factory.ts:63`) — instead of `env.AWS_REGION ?? 'us-east-1'`.
  - **S3 storage adapters** — for session-replay, document storage, etc.
  - **Latency-based service selection** — route NIDA/eardhi/M-Pesa calls to the regional gateway closest to the tenant.
  - **Log routing** — tenant logs sink to the regional log bucket.

### Locale

- **Schema:** `users.preferred_language` exists (`packages/database/src/schemas/intelligence.schema.ts:218`, default `'en'`).
- **Domain model:** `Customer.preferredLanguage` exists.
- **Consumed by:** lease creation and customer onboarding.
- **NOT consumed by:**
  - `services/reports/src/services/morning-briefing.service.ts:218, 230` — explicit `TODO(KI-005): locale should come from recipient.locale` markers.
  - `services/notifications/src/whatsapp/reminder-engine.ts:625` — same TODO.
  - `packages/chat-ui/src/generative-ui/AdaptiveRenderer.tsx` — receives `language: Language` from prop, not from the user's preference automatically.
  - Several brain entry points still default to `language: 'en'`.

### Tax / VAT

- **Schema:** `packages/domain-models/src/common/region-config.ts:106, 126, 146, 167` — TZ=18%, KE=16%, UG=18%, RW=18% VAT rates, with rental-income tax rate, max-late-fee rate, all configurable per region. Good.
- **`packages/compliance-plugins/`** carries the per-country plugin contracts. Good.
- **Hardcoded outside that:**
  - `packages/ai-copilot/src/classroom/quantitative-drills.ts:663` — `'VAT at 18% applies.'` literal in a drill (LOW — pedagogical content).
  - `packages/ai-copilot/src/knowledge/case-studies/02-kinondoni-service-charge-dispute.ts:23, 41` — TZ-specific case study with 18% VAT inline. (LOW — case-study content).

### Phone

- Per-country phone regex lives in `region-config.ts`. Good.
- TZ-specific schema `tanzanianPhoneSchema` in `services/api-gateway/src/schemas/index.ts:26` — see section (2) HIGH.
- Inline TZ/KE phone-prefix regexes in `packages/ai-copilot/src/progressive-intelligence/extraction-patterns.ts:64-81`. MEDIUM.

---

## (9) Test fixtures in prod paths

| File | Imports fixture | Class |
|---|---|---|
| `services/document-intelligence/src/providers/mock.provider.ts` | Imports 5 `.fixture.ts` files from `../../__fixtures__/ids/` | **CRITICAL** (section 1) |

No other production-source file imports from `__fixtures__/` or a `.fixture.ts` path.

---

## (10) Comments flagging incomplete work

Total `TODO/FIXME/XXX/HACK` count in source paths (excl. tests/dist/node_modules): **161**.

Cluster summary (not exhaustive):

- **`TODO(KI-005)`** — locale / currency resolution from tenant defaults — 8 sites (block-generator, sandbox-scenarios, tenant-preference-profile, morning-briefing, reminder-engine, ScannerCamera comment, classroom). HIGH (multi-tenant blocker).
- **`TODO(KI-007)`** — wire to AI persona for narrative generation — 5 sites in domain-services inspections. MEDIUM.
- **`TODO(KI-006)`** — real GePG SOAP/REST envelope — `services/payments/src/providers/gepg/gepg-client.ts:65, 148`. HIGH (TZ statutory rail).
- **`TODO(KI-008)`** — wire to Anthropic client — negotiation. MEDIUM.
- **`TODO(KI-009)`** — wire to Anthropic Messages API — document-chat. MEDIUM.
- **`TODO(KI-010)`** — geospatial / polygon matching — station-master-router. LOW.
- **`TODO(KI-011)`** — real perspective-correct deskew / PDF assembler — scan-service. MEDIUM.
- **`TODO(KI-013)`** — migration-wizard copilot wiring. MEDIUM.
- **`TODO(KI-015)`** — `<video>` player / camera media APIs — multiple sites. LOW.
- **`TODO(WAVE-28)`** — vacancy-pipeline endpoints (7 sites). HIGH.
- **`TODO(WAVE-30)`** — pgvector-backed ConversationMemory (4 sites). HIGH.
- **`TODO(WAVE-34)`** — per-jurisdiction filing adapter — monthly-close orchestrator. HIGH.
- **`TODO(ph-Z-global)`** — credit bureau adapters (Kenya, Tanzania, Nigeria, US, SA, Uganda) — 6 sites. HIGH (TZ + KE rollout blockers).
- **`TODO(api-gateway, ADMIN-BFF-001..004)`** — admin BFF stub endpoints (section 4). HIGH.
- **`TODO(api-gateway, OWNER-BFF-001..002)`** — owner-portal BFF. MEDIUM.
- **`TODO(api-gateway, CUST-BFF-001)`** — customer-app BFF. MEDIUM.
- **`TODO(api-gateway, ANL-002, ANL-GROWTH-001, ANL-USAGE-001, ANL-EXPORTS-001)`** — owner analytics endpoints. MEDIUM.
- **`TODO(api-gateway, BILLING-001, ADMIN-USERS-001, COMMS-001, SUPPORT-001)`** — owner-portal domain endpoints. MEDIUM.
- **`TODO(api-gateway, RATE-BUDGET-001)`** — swap in-memory rate buckets for Redis. **HIGH** (`services/api-gateway/src/middleware/per-tenant-rate-budget.ts:18`).
- **`TODO(tier-3)`** — judge-runner worker, parity-capability dashboard (3 sites in parity-capability-dashboard.factory.ts). MEDIUM.
- **`TODO(agent-loop)`** — sovereign agent-loop dispatcher (`services/api-gateway/src/composition/sovereign.ts:584`). MEDIUM.
- **`TODO(airbnb)` / `TODO(zillow)`** — market-intelligence external feeds. LOW (deferred per KI-015).
- **`TODO-L18N`** — glossary translations gap. LOW.

`@deprecated`:
- `packages/central-intelligence/src/kernel/identity.ts:161` — old persona, replaced.
- `packages/graph-privacy/src/budget-ledger.ts:4` — old budget ledger, replaced.
- `packages/api-sdk/src/jarvis-client.ts:41` — `'owner'` alias.
- `packages/ai-copilot/src/services/renewal-strategy-generator.ts:461`, `payment-risk.ts:151`, `churn-predictor.ts:138` — backward-compat shims during migration.
- `services/api-gateway/src/openapi.ts:102` — old openapi helper.

None of the `@deprecated` items are actively dangerous; they should be removed in a future cleanup.

---

## Wire-summary table

| # | Gap | File:Line | Class | Suggested fix |
|---|---|---|---|---|
| 1 | OCR FixtureMockProvider imports fixtures into prod build | `services/document-intelligence/src/providers/mock.provider.ts:12-16` | CRITICAL | Gate the import, fail loud if `OCR_PROVIDER=mock` in production. |
| 2 | OCR factory defaults to mock if env unset | `services/document-intelligence/src/providers/ocr-factory.ts:54, 103` | CRITICAL | Require explicit `OCR_PROVIDER`; default to throw. |
| 3 | Customer-app pages hardcode `localhost:4001` with no prod guard | `apps/customer-app/src/app/lease/renewal/page.tsx:35`, `maintenance/triage/page.tsx:255`, `maintenance/new/page.tsx:29`, `notifications/page.tsx:32` | CRITICAL | Hoist into `lib/api.ts` `getApiBase()` which throws in prod. |
| 4 | UiPart currency union is `'KES'\|'TZS'\|'USD'` | `packages/central-intelligence/src/kernel/tools/render-blocks/ag-ui-types.ts:41, 60`, `schemas.ts:26`, `tools.ts:94, 175` | CRITICAL | Widen to ISO-4217. |
| 5 | Owner-tool schemas hardcode the same 3-currency enum | `owner.financial_summary.ts:24, 29, 50, 92`, `owner.list_arrears.ts:31, 39`, `owner.next_actions.ts:39` | CRITICAL | Widen; resolve default from `currency_preferences`. |
| 6 | `tenants.region` shipped, consumed by nobody | `packages/database/src/schemas/tenant.schema.ts:108` | HIGH | Wire to KMS adapter, OCR factory, S3 storage, log routing. |
| 7 | NOT_YET_WIRED Temporal dispatchers (eviction, owner-payout, kraMri) | `services/api-gateway/src/composition/hq-tool-registry.ts:736, 747, 761` | HIGH/CRITICAL | Bind from `temporal-dispatcher-wiring.ts` in service-registry composition. |
| 8 | NOT_YET_WIRED NIDA + eardhi ports | hq-tool-registry.ts:777, 793 | CRITICAL | Bind real adapters from `packages/connectors/src/adapters/`. |
| 9 | DB columns default `currency = 'KES'` | `tenant-finance.schema.ts:91`, `marketplace.schema.ts:89,148,202`, `negotiation.schema.ts:93`, `conditional-survey.schema.ts:189` | HIGH | Resolve via app-layer from tenant country. |
| 10 | Monthly-close PDF renderer falls back to `'XXX'` currency | `pdf-renderer.ts:119, 146`, `pdf-templates/owner-statement-template.ts:94, 116`, `statement-adapter.ts:176` | HIGH | Resolve via `currency_preferences`. |
| 11 | TZ-specific phone validator on a generic input boundary | `services/api-gateway/src/schemas/index.ts:26` | MEDIUM | Replace with region-driven regex. |
| 12 | OCR `AWS_REGION` default `'us-east-1'` | `services/document-intelligence/src/providers/ocr-factory.ts:63` | MEDIUM | Use `tenants.region`. |
| 13 | Admin-platform-portal next-auth `/api/platform/*` routes are TODO stubs | `apps/admin-platform-portal/src/app/api/platform/{me,login,intelligence/*,budget}/route.ts` | HIGH | Proxy to identity / api-gateway. |
| 14 | Admin BFF endpoints return empty arrays | `services/api-gateway/src/routes/bff/admin-portal.ts:118,128,139,148` | HIGH | Wire to `repos.outboundWebhooks`, `apiKeyRegistry`, `roles`, `audit-trail`. |
| 15 | Vacancy-pipeline router is 7-stub | `services/api-gateway/src/routes/vacancy-pipeline.router.ts:62,153,166,179,190,200,214` | HIGH | Wire each to enquiry / inspection / lease services. |
| 16 | Owner-portal billing/analytics/messaging/support routers are placeholders | `services/api-gateway/src/routes/owner/*.router.ts` | MEDIUM | Wire each domain. |
| 17 | Per-tenant rate-limit is in-memory | `services/api-gateway/src/middleware/per-tenant-rate-budget.ts:18` | HIGH | Swap to Redis-backed token bucket. |
| 18 | OwnerJarvisShell does not render UiParts | `apps/owner-portal/src/components/OwnerJarvisShell.tsx:282` | MEDIUM | Adopt the genui renderer (extract package first). |
| 19 | `tenants.platform.service.ts` hardcodes `lastName='TBD'` | `packages/database/src/services/platform/tenants.platform.service.ts:305` | HIGH | Require lastName or surface "profile incomplete" badge. |
| 20 | KRA iTax legacy bridge has no real driver | `services/api-gateway/src/composition/legacy-portal-bridge.ts:23-29` | HIGH | Wire Playwright sandbox driver. |
| 21 | Knowledge-base seed not auto-wired | `packages/database/src/seeds/run-seed.ts:71-81` | LOW | Operator-driven workflow ships in docs only. |
| 22 | Fact-formatter hardcodes TZS/KES | `packages/central-intelligence/src/kernel/kernel.ts:2208-2209` | HIGH | Use `Intl.NumberFormat`. |
| 23 | Per-user `preferredLanguage` not resolved in morning-briefing / reminders | `services/reports/src/services/morning-briefing.service.ts:218,230`, `services/notifications/src/whatsapp/reminder-engine.ts:625` | HIGH | Resolve via user-preference service. |
| 24 | TZ-specific phone-prefix regexes outside region-config | `packages/ai-copilot/src/progressive-intelligence/extraction-patterns.ts:64-81` | MEDIUM | Use plugin-driven regex. |
| 25 | Hardcoded KE support phone in customer onboarding | `apps/customer-app/src/app/onboarding/orientation/page.tsx:110` | LOW | Pull from `tenant.supportPhone`. |
| 26 | Two AdaptiveRenderers, divergent block sets | `packages/chat-ui/src/generative-ui/AdaptiveRenderer.tsx` vs `apps/admin-platform-portal/src/lib/genui/AdaptiveRenderer.tsx` | HIGH | Unify into `packages/genui`. |
| 27 | Demo seed pinned to TZS / Africa/Dar_es_Salaam | `packages/database/src/seeds/demo-org-seed.ts:347,377,408,644,663,684,715,736,763` | MEDIUM | Parameterise via `--country=<ISO>`. |
| 28 | Announce-create form is form-only | `apps/estate-manager-app/src/app/announcements/create/page.tsx:39` | HIGH | Wire POST /api/v1/announcements. |
| 29 | DocumentIntelligence "John Doe" docstring leak | `services/document-intelligence/src/routes/documents.routes.ts:608` | LOW | Already documented as 501 in code; tidy doc. |
| 30 | Estate-glossary i18n placeholders (`TODO-L18N`) | `packages/ai-copilot/src/estate-glossary/glossary-data/*.ts` | LOW | Translation curation. |

---

## NOT FOUND (confirmed clean)

- No hardcoded `sk-…` Anthropic / OpenAI keys in source. (`sk-ant-…` only appears as a PII-scrubber regex in `packages/central-intelligence/src/kernel/cot-reservoir/pii-scrub-cot.ts:67`.)
- No hardcoded `Bearer …` literals.
- No literal `api_key_…` strings.
- No `Lorem ipsum` text.
- No `'alice@example.com'` / `'jane@example.com'` in source. Only `'john@example.com'` in one docstring (`audit-logger.ts:115`).
- No `auth.skip()` / `bypass: true` / `bypassAuth` patterns in source.
- No active debug routes under `/api/v1/debug/`, `/api/v1/dev/`, or `/test/`.
- No `faker.` or `chance.` imports in source paths.
- No `'u-1'` / `'t-alpha'` / `'t-test'` ID literals in non-test source. (`'tenant-1'` appears once in `services/reports/src/index.ts:20-23` in a docstring example.)
- KRA PIN regex `[A-Z]\d{9}[A-Z]` appears in exactly 3 legitimate locations:
  - `packages/domain-models/src/tenant/kenya-identifiers.ts:20` (canonical schema).
  - `packages/central-intelligence/src/kernel/cot-reservoir.ts:83` (PII scrubber).
  - `packages/database/src/services/sovereign-action-ledger.service.ts:162` (PII redaction).
  No leaks outside those PII-aware modules.
- `mock-data.ts` in api-gateway is **a hard-fail stub** — production load will throw. Excellent pattern.

---

## Closing notes

**The codebase is in remarkably good shape for a pre-Phase-E SaaS.** The NOT_YET_WIRED scaffolding pattern is principled — every external dependency that has not landed surfaces a clean deterministic refusal rather than crashing. The PII scrubbers, region-config plugin system, and currency-preferences table demonstrate a "built for the world" architecture even where TZ-only literals leak through.

**The five gaps that most urgently block production deployment:**

1. The OCR provider can silently serve fixture data in production if `OCR_PROVIDER` is unset.
2. Four customer-app pages hardcode `localhost:4001` with no production guard.
3. The dynamic-UI substrate hardcodes a 3-currency enum across schemas, tools, and Zod validators — every chart, table and KPI emitted by the MD loses formatting outside `'KES'|'TZS'|'USD'`.
4. The Temporal-backed eviction / owner-payout / KRA-MRI dispatchers and the NIDA / eardhi adapters are all unbound in the api-gateway composition root — the brain can call the tool, the tool fails clean, but no real workflow ever starts.
5. The `tenants.region` column is unused; KMS, OCR, S3, and log-routing still consult global env defaults.

**The five most-needed dynamic-UI kinds to unlock the MD's "render whatever fits the moment" promise:**

1. `kanban` — every operational pipeline.
2. `dashboard-grid` — composite layouts (currently the brain emits flat lists).
3. `heatmap` — arrears by property × month, occupancy by unit × week.
4. `markdown-card` — rich narrative with citations; today the text channel is plain.
5. `prompt-suggestions` / typed quick-replies — chat-ui has them, AG-UI does not.

End of audit.
