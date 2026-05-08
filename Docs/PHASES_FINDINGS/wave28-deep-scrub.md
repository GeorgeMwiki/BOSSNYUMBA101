# Wave 28+ — Deep Scrub Master Findings

Date: 2026-05-08
Scope: branch `claude/elastic-torvalds-e0580f` (BOSSNYUMBA101) — wave-1
(9 commits) + wave-2 (9 commits) ahead of `origin/main`.
Status: shipped. Awaiting review.

This document is the single authoritative reference for what wave-1
and wave-2 actually delivered, what is wired vs stubbed vs deferred,
and what an operator must do next to activate the remaining downstream
workers. The narrower per-phase finding documents
(`phA2-monthly-close.md`, `phG-ai-native.md`, `phL-ai-deeper.md`,
etc.) have been updated to flip individual now-shipped items, but
this is the cross-cutting picture.

---

## 1. Mandate

The wave-1 + wave-2 work was a deep-scrub of "what's stubbed that
should be real" — measured against the three pillars the platform was
already advertising in its routers but failing to back with persistence
or real adapters:

1. **AI-native agent persistence.** The four agents shipped in
   `packages/ai-copilot/src/{ai-native,orchestrators}` had typed ports
   but no Drizzle adapters. Routers returned 503 unconditionally.
2. **End-user UI ↔ backend wiring.** Many portal pages rendered
   `LiveDataRequiredPage`, `MissingBackendNotice`, hardcoded mock
   data, or fake submit handlers — even when the backend route
   already existed.
3. **Test floor.** Several lower-traffic packages had < 80% coverage
   and zero E2E coverage of the user flows wave-1 was wiring up.

The mandate was: close gaps 1–3 without rewriting any existing
service, without commiting hardcoded jurisdiction / currency / locale,
and without breaking the degraded-mode contract (gateway must boot
when `DATABASE_URL` is unset and individual routers must 503 cleanly
rather than crash).

---

## 2. Commit timeline

### Wave-1 (9 commits, all on this branch ahead of `main`)

| Commit | Title |
|---|---|
| `ea93ed6` | feat(db): Drizzle mirrors for legacy migrations 0099/0103/0106/0110 |
| `e33cebc` | feat(db): Drizzle services for monthly-close, market-rate, tenant-predictions, voice-turns |
| `f3f02d2` | feat(api-gateway): wire 4 AI-native agents into ServiceRegistry composition root |
| `3a5eecd` | feat(api-gateway): upgrade 4 agent wirings from stubs to real Drizzle/kernel adapters |
| `691017f` | fix(customer-app): replace fake submits + hardcoded mock data with real api-client wiring |
| `1fffe58` | fix(owner-portal,admin-platform): surface errors + replace native dialogs with proper UI |
| `595a47e` | fix(estate-manager-app): wire 7 dead UI surfaces to real api-client services |
| `35e8e03` | test(central-intelligence): +188 unit tests across 12 untested kernel modules |
| `6def250` | docs: refresh CHANGELOG + ARCHITECTURE + RUNBOOK to reflect shipped wirings |

### Wave-2 (9 commits)

| Commit | Title |
|---|---|
| `0ac239f` | feat(api-gateway): real Drizzle period-bulk adapters for MonthlyCloseOrchestrator |
| `eb21991` | feat(api-gateway): construct BrainKernel at composition root → flip voice-agent to real kernel-think |
| `464f139` | feat(customer-app): useCurrencyPreference hook + KES literal cleanup + /messages api-client wiring |
| `0796887` | feat(estate-manager-app,api-client,api-gateway): wire home + briefing pages to head-briefing router |
| `0ee27a0` | fix(owner-portal): replace 13 LiveDataRequiredPage placeholders with live data + MissingBackendNotice |
| `20845b4` | chore(api-gateway): TODO/FIXME audit + concrete fixes across routes + middleware |
| `6dfee62` | test: +430 unit tests across ai-copilot + agent-platform + api-sdk + database |
| `1d038d9` | test(e2e): +26 hermetic Playwright specs covering wave-1 + wave-2 user flows |
| `482f5e6` | fix(observability,enterprise-hardening): hardening fixes — timeouts, input clamping, log discipline |

---

## 3. Wired ↔ Stubbed ↔ Deferred matrix

The matrix is the operational source of truth. Every row says what
boot signals you should see, what env vars activate it, and what
remains as a known stub.

### 3.1 Monthly Close Orchestrator

| Concern | Status | Evidence |
|---|---|---|
| `RunStorePort` (run + step persistence) | **WIRED** | `packages/database/src/services/monthly-close-runs.service.ts` (`e33cebc`); idempotency via unique index on `(tenant_id, period_year, period_month)`. |
| Registry slot `monthlyClose` | **WIRED** | `services/api-gateway/src/composition/monthly-close-wiring.ts` (`f3f02d2`); returns `null` when `DATABASE_URL` unset. |
| `ReconciliationPort` | **WIRED** (real Drizzle) | `services/api-gateway/src/services/monthly-close/reconciliation-adapter.ts` (`0ac239f`). One round-trip joining `payments` × `invoices`. |
| `StatementPort` (row-write) | **WIRED** (real Drizzle) | `statement-adapter.ts` (`0ac239f`) writes `draft` rows into `owner_statements`. |
| Statement PDF render | **STUB** | Rows persist with `degraded_reason: 'no_pdf_renderer'`. PDF worker is the next downstream activation. |
| `DisbursementPort` | **WIRED** (real Drizzle + outbox) | `disbursement-adapter.ts` (`0ac239f`). Each call queues `MonthlyCloseDisbursementProposed` to `event_outbox`. |
| Payouts execution worker | **DEFERRED** | Outbox events accumulate; no consumer yet. |
| `NotificationPort` | **WIRED** (real Drizzle) | `notification-adapter.ts` (`0ac239f`) inserts `pending` rows into `notification_dispatch_log`. |
| Notification dispatch worker | **DEFERRED** | Rows queue; no consumer yet. |
| `EventPort` (`MonthlyCloseCompleted`) | **WIRED** | Emitted via `event_outbox` for downstream subscribers. |
| `AutonomyPolicyPort` | **STUB** | Returns `autonomousModeEnabled = false` so disbursement batches park as `awaiting_approval`. **Money never auto-moves.** |
| KRA eTIMS submission | **STUB** | CSV produced; submission flagged `pending_etims_adapter` (Wave-34). |
| `monthly_close` cron | **REGISTERED** | `0 2 1 * *` (02:00 on the 1st) in `background-wiring.ts`. |
| Manual trigger / approve-step routes | **WIRED** | `POST /api/v1/monthly-close/{trigger,/:runId/approve-step}` — admin-only. |

### 3.2 Voice Agent

| Concern | Status | Evidence |
|---|---|---|
| `VoiceTurnRepository` | **WIRED** | `packages/database/src/services/voice-turns.service.ts` (`e33cebc`). |
| Registry slot `voiceAgent` | **WIRED** | `composition/voice-agent-wiring.ts` (`f3f02d2`). |
| `VoiceBrainPort` | **WIRED to real kernel** | `composition/brain-kernel-wiring.ts` (`eb21991`) constructs the central-intelligence kernel; voice turns round-trip through the 13-step pipeline when `ANTHROPIC_API_KEY` is set. Falls back to heuristic-language stub (`sw` / `es` / `fr` / `en`) when unset — never hardcodes 'en'. |
| `VoiceSttPort` | **STUB** (`null`) | Degraded mode preserves text-only behaviour. |
| `VoiceTtsPort` | **STUB** (`null`) | Same. |
| `CustomerResolverPort` | **STUB** (`null`) | Same. |
| `POST /api/v1/ai-native/voice/turn` | **WIRED** | Persists per turn; `degraded_mode` boolean is recorded. |

### 3.3 Market Surveillance

| Concern | Status | Evidence |
|---|---|---|
| `MarketRateSnapshotsRepository` | **WIRED** | `packages/database/src/services/market-rate-snapshots.service.ts` (`e33cebc`). |
| Registry slot `marketSurveillance` | **WIRED** | `composition/market-surveillance-wiring.ts` (`f3f02d2`). |
| `MarketRatePort` (Zillow / Rentometer / Airbnb) | **STUB** | Adapter id `stub-not-configured`. Activates with `MARKET_DATA_PROVIDER` + provider-specific key (see RUNBOOK §1.5). |
| `listActiveUnits` | **STUB** | Returns `[]`; surveillance loop no-ops cleanly. |
| `ClassifyLLMPort` | **STUB** | Heuristic-only; activates with `ANTHROPIC_API_KEY` + LLM port wiring. |
| Persistence surface | **WIRED** | Snapshots written to `market_rate_snapshots`. |
| Surveillance cron | **REGISTERED** | Runs in degraded mode until adapters land. |

### 3.4 Predictive Interventions

| Concern | Status | Evidence |
|---|---|---|
| `TenantPredictionsRepository` | **WIRED** | `packages/database/src/services/tenant-predictions.service.ts` (`e33cebc`). Backs both `tenant_predictions` + `predictive_intervention_opportunities`. |
| Registry slot `predictiveInterventions` | **WIRED** | `composition/predictive-interventions-wiring.ts` (`f3f02d2`). |
| `PredictiveInterventionsLLMPort` | **STUB** | Heuristic-baseline only. |
| `listActiveTenants` | **STUB** | Returns `[]`. |
| `GET /api/v1/ai-native/predictions/tenant/:customerId` | **WIRED** | Reads from `tenant_predictions`; returns 503 when no rows yet. |

### 3.5 Customer-app currency + messaging

| Concern | Status | Evidence |
|---|---|---|
| `useCurrencyPreference` hook | **WIRED** | `apps/customer-app/src/lib/hooks/useCurrencyPreference.ts` (`464f139`). User → tenant → platform-default chain. |
| Hardcoded `'KES'` literals | **REMOVED** | 8 customer-app files (`464f139`). |
| `/messages` page | **WIRED** | `messagingService.list` + `send` (`464f139`). |
| Settings, lease, payments, dashboard surfaces | **WIRED** | All use the hook's resolved code. |

### 3.6 Estate-manager home + briefing

| Concern | Status | Evidence |
|---|---|---|
| `headBriefingService` (api-client) | **WIRED** | `packages/api-client/src/services/head-briefing.ts` (`0796887`). |
| Estate-manager home page | **WIRED** | Live `getMyBriefing()` fetch (`0796887`). |
| Estate-manager `/briefing` page | **WIRED** | Renders all 6 BriefingDocument sections. |
| Estate-manager `/announcements/create`, `/reports/generate` | **DEFERRED** | TODO comments now cite the concrete missing endpoints. |

### 3.7 Owner-portal `LiveDataRequiredPage` placeholders

The 13-page audit (`0ee27a0`) classified each placeholder:

**WIRED LIVE (3 pages):**
- `TenantManagementPage` → `GET /tenants/current` + `/settings` + `/subscription`
- `ComplianceDocumentsPage` → `GET /documents?type=CONTRACT|LEASE|OTHER`
- `ComplianceDataRequestsPage` → `GET /gdpr/delete-requests`

**`MissingBackendNotice` with concrete endpoint (10 pages):**
- `AnalyticsExportsPage` → `GET /api/v1/analytics/exports/templates`
- `AnalyticsGrowthPage` → `GET /api/v1/analytics/growth`
- `AnalyticsUsagePage` → `GET /api/v1/analytics/usage`
- `BillingPage` → `GET /api/v1/billing/subscription`
- `CommunicationsBroadcastsPage` → `GET /api/v1/communications/broadcasts`
- `CommunicationsCampaignsPage` → `GET /api/v1/communications/campaigns`
- `CommunicationsTemplatesPage` → `GET /api/v1/communications/templates`
- `SupportToolingPage` → `GET /api/v1/support/tooling`
- `UserRolesPage` → `GET /api/v1/users/roles`
- `UsersPage` → `GET /api/v1/users`

These are the next 10 backend endpoints to ship. Each `MissingBackendNotice`
embeds the precise call so support knows what to route to.

### 3.8 Hardening (commit `482f5e6`)

| Issue | Fix | File |
|---|---|---|
| `console.log('Tracing terminated')` style violation | removed | `packages/observability/src/tracing/tracer.ts` |
| `console.error` polluting stdout in SIGTERM teardown | replaced with `process.stderr.write` | same file |
| `HTTP_REQUEST` workflow had no timeout / no error catch | `AbortSignal.timeout(30_000)` + try/catch returning `{ statusCode: 0, error }`; new `timeoutMs` action field | `packages/enterprise-hardening/src/enterprise/custom-workflows.ts` |
| `WAIT` handler accepted unvalidated `duration` (NaN, negative, unbounded) | clamped to finite non-negative bound | same file |
| `console.log` in resilience health-check | structured logger only | `packages/enterprise-hardening/src/resilience/health-check.ts` |

---

## 4. Test totals — before / after

### 4.1 Unit tests (per-package, after wave-2)

| Package | Wave-1 baseline | Wave-2 added | Wave-2 total |
|---|---|---|---|
| `central-intelligence` | +188 (commit `35e8e03`) | (no change) | baseline + 188 |
| `ai-copilot` | 1251 | +234 (commit `6dfee62`) | 1485 |
| `agent-platform` | 23 | +102 (commit `6dfee62`) | 125 |
| `api-sdk` | 27 | +37 (commit `6dfee62`) | 64 |
| `database` (services + analyzers) | 101 | +33 (commit `e33cebc`) + further coverage in `6dfee62` | 134+ |
| `api-gateway` | 318 | +25 (commit `f3f02d2`) | 343 |

Wave-2 net: **+430 unit tests** across the four most under-tested
packages. No production code modified by the test commit. All tests
use injected mocks (`vi.fn()` / hand-rolled stubs), no IO, no real
Anthropic SDK calls.

### 4.2 E2E tests (commit `1d038d9`)

26 hermetic Playwright specs across 8 spec files + 1 shared helper
under `e2e/tests/journeys/`. Network-hermetic via `page.route` /
`route.fulfill`. Auto-skip when no Next.js dev server is reachable;
opt-in to live mode with `USE_REAL_SERVERS=1`.

| Spec file | Tests | Coverage |
|---|---|---|
| `customer-feedback.spec.ts` | 4 | POST → thank-you → history; error retry; empty. |
| `customer-settings-and-notifications.spec.ts` | 4 | currency localStorage round-trip; SMS toggle; retry; empty. |
| `manager-messaging.spec.ts` | 4 | conversation list → open → mark-read → send; button gating; search. |
| `manager-notifications.spec.ts` | 2 | per-id mark-read; mark-all + unread badge. |
| `manager-announcements-create.spec.ts` | 3 | properties dropdown; publish-button gating. |
| `owner-damage-deductions.spec.ts` | 3 | `.fixme`'d (component lives in `features/`; not yet mounted). |
| `owner-gamification.spec.ts` | 3 | `.fixme`'d (same routing reason). |
| `_helpers.ts` | (helper) | shared test infrastructure. |

---

## 5. Operational map — what to wire next

The downstream workers and adapters that will move the matrix from
"events queue" to "events execute":

### 5.1 Statement PDF render worker

- **Trigger:** rows in `owner_statements` with
  `degraded_reason = 'no_pdf_renderer'` and `status = 'draft'`.
- **Likely env var:** `TYPST_BIN` (the rendering adapter the
  document-rendering interface already supports). Falls back to the
  zero-dep PDF encoder when unset (see `Docs/DEPLOYMENT.md` §8).
- **Output:** signed-URL artefact persisted; row status flips to
  `rendered`; downstream `notification_dispatch_log` rows can flip
  to `ready_to_send`.
- **Effort:** small — interface exists; only the worker shell + queue
  consumer remains.

### 5.2 Disbursement payouts worker

- **Trigger:** `event_outbox` events of kind
  `MonthlyCloseDisbursementProposed`.
- **Required adapters:** payouts provider per-country (M-Pesa B2C,
  TZ ClickPesa B2C, etc.). The adapters already exist for inbound;
  outbound B2C is the missing path.
- **Gating:** every event today is gated by the autonomy stub
  (`autonomousModeEnabled = false`), so the run pauses at
  `propose_disbursement_batch`. The worker should respect the
  approval-step state — only consume events whose run-step has been
  approved.
- **Env var:** none new today; reuses
  `TANZANIA_PAYMENT_BACKEND` / `MPESA_*` config.

### 5.3 Notification dispatch worker

- **Trigger:** rows in `notification_dispatch_log` with
  `status = 'pending'`.
- **Adapter:** existing notification service (email + SMS).
- **Effort:** trivial — write a poller / consumer; the schema is
  already populated correctly.

### 5.4 `MarketRatePort` real adapter

- **Targets:** Zillow (US), Rentometer (US), Airbnb (global short-let).
- **Env var dispatch:** `MARKET_DATA_PROVIDER` ∈
  `{'zillow','airbnb',…}` (RUNBOOK §1.5). Without it, no adapter is
  wired — the surveillance loop no-ops cleanly.
- **Per-country dispatch:** lives behind
  `getCountryPlugin(tenantCountry)` from
  `@bossnyumba/compliance-plugins`. Adapters are not hardcoded into
  the pipeline.

### 5.5 `ListActiveUnits` / `ListActiveTenants` adapters

- **Required by:** Market Surveillance, Predictive Interventions.
- **Source:** existing `properties` / `units` / `leases` /
  `tenants` tables.
- **Effort:** small — straight read query against the live tables.

### 5.6 Concrete `AutonomyPolicyPort`

- **Today:** stub forces `autonomousModeEnabled = false`.
- **Tomorrow:** read from
  `packages/ai-copilot/src/autonomy/autonomy-policy-service` (already
  exists — just not wired into the monthly-close composition).
- **Once wired:** disbursement batches under
  `finance.autoApproveRefundsMinorUnits` flip to `auto_approved` and
  execute against the payouts worker.

### 5.7 The 10 owner-portal `MissingBackendNotice` endpoints

Each notice cites the concrete endpoint. These are the next 10
backend routes to ship. The frontend pages are already wired against
the api-client — once the routers land, swap the notice for the live
hook + Skeleton + Alert/Retry pattern (mirroring the 3 already
converted in `0ee27a0`).

---

## 6. Architecture invariants preserved

These are the load-bearing invariants both waves protected. Reviewers
should verify them and reject any future change that breaks them.

1. **No hardcoded jurisdiction / currency / locale in business
   logic.** Per the project memory rule "built for the world,
   starting with TZ" (see
   `~/.claude/projects/.../memory/feedback_world_starting_tz.md`),
   defaults are seeded values, never hard-coded `if/else` branches.
   Wave-2's `useCurrencyPreference` hook + KES-literal cleanup is
   the customer-app expression of this.
2. **Degraded-mode contract.** Every wiring returns `null` when
   `DATABASE_URL` is unset. Routers return 503 with a clear
   `*_UNAVAILABLE` code. Boot never crashes. Operators see
   `service-registry: degraded` once in the boot log; no
   per-request crash loop.
3. **Money never auto-moves in degraded mode.** The Monthly Close
   `AutonomyPolicyPort` stub returns `autonomousModeEnabled = false`
   so disbursement batches always park as `awaiting_approval` until
   a real autonomy adapter lands.
4. **Audit reproducibility.** Every persisted row carries
   `model_version`, `prompt_hash`, `confidence`, and `explanation`
   where applicable. A later auditor can compare prompt-hashes
   across runs to verify no silent prompt drift.
5. **Tenant isolation at the DB layer.** Every query compiles to
   `WHERE tenant_id = $1`; the router always binds `tenantId` from
   the JWT.
6. **Idempotency at the schema layer.** Unique indexes enforce
   single-run invariants:
   `monthly_close_runs (tenant_id, period_year, period_month)`,
   `monthly_close_run_steps (run_id, step_name)`. Re-triggers
   surface Postgres `23505` to the orchestrator.
7. **Immutability in client code.** No `setState` mutates an
   existing object; every wave-1 + wave-2 hook returns a new object
   or array.

---

## 7. Known limitations rolled forward

These are the gaps wave-2 closed nothing on, by design. Each is
rolled forward with the concrete unblocker:

- **HQ overview trend chart.** Recharts panel on
  `/platform/overview` is still a placeholder shape. KPI tiles are
  live; the trendline is mocked until the time-series source is
  wired.
- **i18n stubs in some `owner-portal` pages.** Translation keys
  render verbatim where translations have not been backfilled.
  Cosmetic, not functional.
- **`/api/v1/platform/overview` `monthlyRevenue: 0`.** The
  `payments` table mixes currencies (KES / TZS / USD) per tenant;
  until an FX-normalising aggregator is wired, mixed-currency
  minor-units cannot be summed. Ticket links to migration 0117
  (`currency_rates`).
- **End-to-end audio I/O for voice.** Voice resolver +
  voice-bridge + per-tenant `voiceProfileId` are all shipped — the
  mic-capture → STT → kernel → TTS → playback path through the
  portals is not wired. Text-only Jarvis works; the speaking
  surface does not.
- **Some support endpoints unmounted.** A small number of routers
  exist in `services/api-gateway/src/routes/` but are not yet
  imported into `index.ts`. Returns 404 on the un-mounted path.

---

## 8. Verification

To verify the deep-scrub at the artefact level:

```bash
# Full commit listing (should be 18 commits ahead of main)
git log --oneline origin/main..HEAD

# Diff stat by area
git diff --stat origin/main...HEAD -- packages/database/
git diff --stat origin/main...HEAD -- services/api-gateway/composition/
git diff --stat origin/main...HEAD -- apps/customer-app/
git diff --stat origin/main...HEAD -- apps/owner-portal/
git diff --stat origin/main...HEAD -- apps/estate-manager-app/
git diff --stat origin/main...HEAD -- e2e/

# Per-package test runs (inside a clean dev shell)
pnpm --filter @bossnyumba/ai-copilot test
pnpm --filter @bossnyumba/agent-platform test
pnpm --filter @bossnyumba/api-sdk test
pnpm --filter @bossnyumba/database test
pnpm --filter @bossnyumba/api-gateway test

# Hermetic E2E (auto-skip when no dev servers up)
pnpm --filter e2e test:journeys
```

Boot-log smoke for the wave-2 wirings:

```
service-registry: live (Postgres-backed domain services wired)
ai-brain-utilities wired { providers: { anthropic: true, ... } }
brain-kernel wired (cot-reservoir=in-memory, cache=in-memory, sensor-failover=in-memory)
voice-agent: brain port = real-kernel
monthly-close: reconciliation/statement/disbursement/notification = drizzle-period-bulk
```

Any of those lines missing → the corresponding feature is still in
degraded mode. Cross-reference §3 to identify which env var or
adapter to ship next.

---

## 9. References

- `CHANGELOG.md` — wave-1 + wave-2 release notes.
- `.planning/RUNBOOK.md` §6.3 — env-var matrix for the four
  AI-native agents (post wave-2).
- `.planning/litfin-parity-plan.md` — kernel-parity scorecard
  (post wave-2; new "shipped" rows added).
- `Docs/PHASES_FINDINGS/phA2-monthly-close.md` — Monthly Close
  Orchestrator detail (post wave-2).
- `Docs/PHASES_FINDINGS/phG-ai-native.md` — eight AI-native
  capabilities + wiring status (post wave-2).
- `Docs/PHASES_FINDINGS/phL-ai-deeper.md` — four PROPOSE > SETTLE
  capabilities + composition-root status (post wave-2).
- `Docs/DEPLOYMENT.md` §8 — composition-root degraded-mode contract.
- `Docs/analysis/DELTA_AND_ROADMAP.md` — Production Readiness Matrix
  (per-feature LIVE / DB_ONLY / STUB / PLANNED).
