# Phase-E Wire-Up Backlog

**Created:** 2026-05-18 (ProdFix-6 triage)

Every entry in this file is a TODO that needs a downstream service or
schema change before it can be closed. They are NOT inline fixes —
attempting to "just edit" them would either silently swallow user input
or introduce a stub that lies to the caller.

Grouped by domain area for batching.

---

## Group A — `customers.user_id` / `staff_assignments` schema

| File | Line |
|---|---|
| `packages/database/src/services/kernel-grounding.service.ts` | 148, 194, 262, 327, 393 |

**Blocker:** schema migration. The kernel reads need a `customers.user_id`
FK and a `staff_assignments` join table (many-to-many between staff and
units/properties). Until those land, the kernel grounding service falls
back to a single-manager assumption.

**Next-step:** propose migration; add `StaffAssignmentsRepo`; widen the
five read sites.

---

## Group B — Platform finance (MRR / billing)

| File | Line |
|---|---|
| `packages/database/src/services/platform/tenants.platform.service.ts` | 174 |
| `services/api-gateway/src/routes/owner/billing.router.ts` | 17 |

**Blocker:** no `tenant_finance` / `subscription_billing_periods` tables
exist yet. The owner billing router returns a placeholder state.

**Next-step:** land the billing schema; back the MRR read with a real
aggregate; replace `billing.router` placeholder with a 503 + feature-flag
fall-back (mirror `support.router.ts`).

---

## Group C — Currency-preferences propagation (KI-005)

| File | Line |
|---|---|
| `packages/chat-ui/src/generative-ui/block-generator.ts` | 83 |
| `packages/ai-copilot/src/skills/estate/property-valuation.ts` | 30 |
| `packages/marketing-brain/src/sandbox/sandbox-scenarios.ts` | 324 |
| `packages/domain-models/src/intelligence/tenant-preference-profile.ts` | 203 |
| `services/notifications/src/whatsapp/reminder-engine.ts` | 625 |
| `services/reports/src/services/morning-briefing.service.ts` | 218, 230 |

**Blocker:** the `tenant.defaultCurrency` / `tenant.defaultLocale` /
`tenant.defaultTimezone` chain needs to thread through every caller.
Partially done by ProdFix-2 (currency_preferences resolution at the
ledger / PDF tier); these are the remaining read sites.

**Next-step:** swap literal `'KES'` / `'sw-TZ'` fallbacks for
`getCurrencyPreference(tenantId)` / `getTenantLocale(tenantId)`.

---

## Group D — AI persona wiring (KI-007 / KI-008 / KI-009)

| File | Line |
|---|---|
| `packages/ai-copilot/src/task-agents/agents/move-out-notice.agent.ts` | 97 |
| `services/domain-services/src/inspections/move-out/move-out-checklist-service.ts` | 472 |
| `services/domain-services/src/inspections/conditional-survey/conditional-survey-service.ts` | 231, 314 |
| `services/domain-services/src/inspections/move-out/photo-comparator.ts` | 39 |
| `services/domain-services/src/inspections/far/far-scheduler.ts` | 45 |
| `services/domain-services/src/negotiation/negotiation-service.ts` | 161 |
| `services/document-intelligence/src/services/document-chat.service.ts` | 306 |

**Blocker:** waiting for the multi-LLM router to stabilise (KI-Z3 / KI-Z4)
so these wires don't pin to Anthropic directly.

**Next-step:** wire each through the shared LLM router with persona
prompts; persist the narrative back to the case / inspection record.

---

## Group E — Compliance plugins (CRB / credit-bureau)

| File | Line |
|---|---|
| `packages/compliance-plugins/src/plugins/tanzania.ts` | 76 |
| `packages/compliance-plugins/src/plugins/kenya.ts` | 112 |
| `packages/compliance-plugins/src/plugins/uganda.ts` | 64 |
| `packages/compliance-plugins/src/plugins/nigeria.ts` | 68 |
| `packages/compliance-plugins/src/plugins/south-africa.ts` | 71 |
| `packages/compliance-plugins/src/plugins/united-states.ts` | 76 |

**Blocker:** each provider needs a signed integration agreement + env
keys. US adapter additionally needs FCRA-compliant consent flow.

**Next-step:** see DESIGN-DEBT section of triage report — vendor
selection per jurisdiction.

---

## Group F — Market intelligence adapters

| File | Line |
|---|---|
| `packages/market-intelligence/src/adapters/airbnb.ts` | 13, 181, 182 |
| `packages/market-intelligence/src/adapters/zillow.ts` | 10, 200, 201 |

**Blocker:** partner API access required.

**Next-step:** see DESIGN-DEBT.

---

## Group G — Document scanning / OCR (KI-011 / KI-015)

| File | Line |
|---|---|
| `services/document-intelligence/src/scan/scan-service.ts` | 130, 142, 252 |
| `packages/ai-copilot/src/services/migration/parsers/csv-parser.ts` | 22 |
| `packages/design-system/src/ScannerCamera.tsx` | 50, 59, 67, 137 |
| `services/reports/src/generators/interactive-html-generator.ts` | 61 |
| `apps/admin-platform-portal/src/lib/genui/MapView.tsx` | 12 |
| `apps/admin-platform-portal/src/lib/genui/MapInner.tsx` | 7 |

**Blocker:** WASM-OpenCV vs. native getUserMedia vs. third-party SDK
choice not yet made. Same question for offline tile cache.

**Next-step:** see DESIGN-DEBT.

---

## Group H — API-gateway router wires

ProdFix-3 owns these — listed here for tracking only.

| File | Line | Marker |
|---|---|---|
| `services/api-gateway/src/routes/bff/admin-portal.ts` | 111, 123, 133, 144 | ADMIN-BFF-001..004 |
| `services/api-gateway/src/routes/bff/owner-portal.ts` | 686, 997 | OWNER-BFF-001/002 |
| `services/api-gateway/src/routes/bff/customer-app.ts` | 316 | CUST-BFF-001 |
| `services/api-gateway/src/routes/owner/{billing,admin-users,support,analytics-*}.router.ts` | various | ANL/ANL-EXPORTS/ANL-GROWTH/ANL-USAGE/SUPPORT/BILLING/ADMIN-USERS |
| `services/api-gateway/src/routes/payments.ts` | 205 | placeholder |
| `services/api-gateway/src/routes/dsar.router.ts` | 24 | DSAR follow-up |
| `services/api-gateway/src/routes/portfolio.router.ts` | 18 | PORT-005 |
| `services/api-gateway/src/routes/owner/owner-messaging.router.ts` | 23 | COMMS-001 |
| `services/api-gateway/src/routes/feedback.ts` | 123 | tier-2 |
| `services/api-gateway/src/routes/vacancy-pipeline.router.ts` | 62, 153, 166, 179, 190, 200, 214 | WAVE-28-VPR-001..007 |
| `services/api-gateway/src/routes/migration.router.ts` | 167 | KI-013 |

---

## Group I — Identity / auth wires

ProdFix-3 owns these.

| File | Line |
|---|---|
| `apps/customer-app/src/contexts/AuthContext.tsx` | 60, 65, 170, 193 |
| `apps/admin-platform-portal/src/app/api/platform/me/route.ts` | 9, 25 |
| `apps/admin-platform-portal/src/app/api/platform/login/route.ts` | 6 |
| `apps/admin-platform-portal/src/app/api/platform/budget/route.ts` | 6 |
| `apps/admin-platform-portal/src/app/api/platform/intelligence/threads/route.ts` | 6 |
| `apps/admin-platform-portal/src/app/api/platform/intelligence/thread/route.ts` | 6 |
| `apps/admin-platform-portal/src/app/api/platform/intelligence/thread/[threadId]/route.ts` | 6 |
| `apps/admin-platform-portal/src/lib/session.ts` | 8 |

---

## Group J — Announcements MVP

| File | Line |
|---|---|
| `apps/estate-manager-app/src/app/announcements/create/page.tsx` | (form now fails loud — see ProdFix-6) |

**Blocker:** no `announcements` table + `announcements.router.ts` +
`announcementsService.create()` exist. Page now fails loud instead of
silently dropping input.

**Next-step:** Drizzle migration for `announcements` (id, tenantId,
authorUserId, title, body, priority, propertyId?, publishedAt,
expiresAt, isPinned); HTTP POST `/api/v1/announcements`;
`announcementsService.create()` on the api-client.

---

## Group K — Misc

| File | Line | Marker |
|---|---|---|
| `services/api-gateway/src/composition/parity-capability-dashboard.factory.ts` | 391, 418 | tier-3 |
| `services/api-gateway/src/composition/sovereign.ts` | 584 | agent-loop |
| `services/api-gateway/src/composition/session-replay-retention.ts` | 212 | central-command-phase-c |
| `services/api-gateway/src/middleware/per-tenant-rate-budget.ts` | 18 | RATE-BUDGET-001 |
| `services/api-gateway/src/services/notification-dispatch/email-provider.ts` | 8 | Real providers TODO |
| `services/payments/src/providers/gepg/gepg-client.ts` | 65, 148 | KI-006 |
| `services/identity/src/otp/otp-service.ts` | (KEEP-AS-IS) | doc note |
