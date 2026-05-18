# TODO/FIXME Triage — ProdFix-6

**Date:** 2026-05-18
**Branch:** `claude/phase-d-comprehensive-gap-closure`
**Scope:** `grep -rn 'TODO|FIXME|XXX|HACK'` over `packages/`, `services/`, `apps/`
excluding `__tests__`, `dist`, `node_modules`.

**Total comments scanned:** 165

## Bucket counts

| Bucket | Count | Disposition |
|---|---|---|
| **FIX-NOW** (applied inline) | 2 | Inline fix, comment removed |
| **PHASE-E-WIRE** (needs downstream) | 88 | Documented in `phase-e-todo-backlog.md` |
| **DESIGN-DEBT** (arch decision needed) | 18 | Captured with rationale below |
| **STALE** (already done — comment removed) | 0 | (None — keeping audit conservative) |
| **KEEP-AS-IS** (informational doc strings / examples) | 57 | No action |

> NOTE — every "FIX-NOW" candidate larger than a 5-min change was promoted
> to PHASE-E-WIRE because the brief explicitly scopes the FIX-NOW bucket
> to inline single-edit changes. Cross-file rewires (e.g. the four
> `apps/customer-app/src/contexts/AuthContext.tsx` TODOs) belong to
> ProdFix-3 per the orchestrator's scope split and are documented as
> PHASE-E in the backlog file.

---

## FIX-NOW — applied in this pass

1. **`apps/customer-app/src/components/OrgSwitcher.tsx:116`**
   `// TODO: next/navigation router.push('/onboarding/redeem-code')`
   - Wired `useRouter()` and the `router.push('/onboarding/redeem-code')`
     call. Comment removed.

2. **`apps/estate-manager-app/src/app/announcements/create/page.tsx:39`**
   `// TODO(api): wire to a POST /api/v1/announcements endpoint via …`
   - Replaced silent `router.push('/announcements')` with a loud user-
     facing error message so tenant input is never quietly dropped. The
     real endpoint is queued under PHASE-E-WIRE (announcements-mvp).

---

## PHASE-E-WIRE — full backlog

See `.planning/phase-e-todo-backlog.md`.

### Highlights (top 12)

| File | Line | Marker | Next-step |
|---|---|---|---|
| `packages/database/src/services/kernel-grounding.service.ts` | 148, 194, 262, 327, 393 | TODO(schema) | Add `customers.user_id` FK + `staff_assignments` table; widen the kernel reads to multi-manager. |
| `packages/database/src/services/platform/tenants.platform.service.ts` | 174 | TODO(B2) | Wire MRR from `tenant_finance` / subscription tables once Wave-30 lands. |
| `packages/ai-copilot/src/skills/estate/property-valuation.ts` | 30 | TODO(KI-005) | Pass `tenant.defaultCurrency` resolved from the currency-preferences chain. |
| `packages/chat-ui/src/generative-ui/block-generator.ts` | 83 | TODO(KI-005) | Resolve `defaultCurrency` from `tenant.defaultCurrency`. |
| `packages/ai-copilot/src/orchestrators/monthly-close/orchestrator-service.ts` | 483 | TODO(WAVE-34) | Submit CSV via per-jurisdiction filing adapter. |
| `services/payments/src/providers/gepg/gepg-client.ts` | 65, 148 | TODO(KI-006) | Real GePG SOAP/REST envelope (currently sandbox-only). |
| `services/api-gateway/src/composition/sovereign.ts` | 584 | TODO(agent-loop) | When api-gateway grows an agent-loop pickup. |
| `services/api-gateway/src/middleware/per-tenant-rate-budget.ts` | 18 | TODO(RATE-BUDGET-001) | Swap in-memory buckets for Redis-backed sliding window. |
| `services/api-gateway/src/composition/parity-capability-dashboard.factory.ts` | 391, 418 | TODO(tier-3) | Persist judge reasons + wire judge-runner worker. |
| `services/api-gateway/src/routes/vacancy-pipeline.router.ts` | 62, 153, 166, 179, 190, 200, 214 | TODO(WAVE-28) | Postgres-backed repository + EnquiryService / InspectionsService / EnrichmentService wires. |
| `services/api-gateway/src/routes/bff/admin-portal.ts` | 111, 123, 133, 144 | TODO(ADMIN-BFF) | Wire webhooks / api-keys / roles / role-audit handlers — ProdFix-3 scope. |
| `services/api-gateway/src/routes/bff/owner-portal.ts` | 686, 997 | TODO(OWNER-BFF) | Join `users`⨝`user_property_access`; persist invitations — ProdFix-3 scope. |

(See full list in `.planning/phase-e-todo-backlog.md`.)

---

## DESIGN-DEBT — needs architectural decision

| File | Line | Marker | Decision needed |
|---|---|---|---|
| `services/api-gateway/src/services/payouts/providers/eft-stub-adapter.ts` | 1-30 | "EFT placeholder adapter" | Pick one: (a) Stripe Treasury, (b) Yapily, (c) per-jurisdiction bank API. Cost & compliance implications differ. |
| `packages/market-intelligence/src/adapters/airbnb.ts` | 13, 181, 182 | TODO(airbnb) | Partner agreement scope: do we ship a public-data scraper, or wait for Airbnb partner API onboarding? |
| `packages/market-intelligence/src/adapters/zillow.ts` | 10, 200, 201 | TODO(zillow) | Same — partner vs. public-data. |
| `packages/compliance-plugins/src/plugins/{tanzania,kenya,uganda,nigeria,south-africa,united-states}.ts` | various | TODO(ph-Z-global) | Per-country CRB / credit-bureau provider selection (CRB-TZ, CRB-KE, TransUnion, Experian, FCRA-gated for US). Each requires legal review + contract. |
| `packages/realtime-rooms/src/brain-peer.ts` | 10, 158 | TODO(B6) | Wait for `@liveblocks/client` 3.x stable, or fork? |
| `apps/admin-platform-portal/src/lib/realtime-rooms-client.ts` | 17 | TODO(B6 follow-up) | Extract to `packages/realtime-rooms-client/` once Liveblocks 3.x settles. |
| `services/api-gateway/src/composition/durable/temporal/eviction-workflow.ts` | 25 | "Phase C TODO" | Adopt Temporal as the durable-workflow runtime, or stick with the current in-process scheduler? |
| `services/api-gateway/src/composition/durable/temporal/temporal-client.ts` | 40 | "Phase C TODO" | Same. |
| `services/document-intelligence/src/scan/scan-service.ts` | 130, 142, 252 | TODO(KI-011) | Native (WASM-OpenCV) vs. cloud OCR for the deskew + assembler path. |
| `services/identity/src/otp/otp-service.ts` | 15 | (resolved — kept for trace) | KEEP-AS-IS: not a TODO, just a doc note. |
| `packages/design-system/src/ScannerCamera.tsx` | 50, 59, 67, 137 | TODO(KI-015) | Build vs. buy the document-scanner UX (WASM-OpenCV vs. Scanbot SDK vs. native getUserMedia). |
| `services/domain-services/src/negotiation/negotiation-service.ts` | 161 | TODO(KI-008) | Anthropic vs. shared LLM-router for negotiation prompts. |
| `services/domain-services/src/inspections/move-out/move-out-checklist-service.ts` | 472 | TODO(KI-007) | AI persona for narrative-generation: shared LLM-router or dedicated agent? |
| `services/domain-services/src/inspections/conditional-survey/conditional-survey-service.ts` | 231, 314 | TODO(KI-007) | Same. |
| `services/domain-services/src/inspections/move-out/photo-comparator.ts` | 5, 39 | TODO(KI-007) | Visual-diff: ML model vs. heuristic vs. human reviewer. |
| `services/domain-services/src/inspections/far/far-scheduler.ts` | 45 | TODO(KI-007) | Same AI-persona question. |
| `services/domain-services/src/routing/station-master-router.ts` | 83 | TODO(KI-010) | GeoNode + polygon-matching strategy: native PostGIS, Turf.js, or Google Maps API? |
| `services/api-gateway/src/routes/feedback.ts` | 123 | TODO(tier-2) | Split `turn_feedback` into its own table or keep embedded? |

---

## KEEP-AS-IS — informational, no action

These are doc-string examples, format-spec notes ("US EIN — 9 digits"),
explanatory comments embedded in code that describe an existing
correctness invariant (not a TODO), or comments inside test fixtures /
sample data. Examples:

- `services/api-gateway/src/routes/cases.hono.ts:19` — "Case numbers are
  generated as `CASE-YYMMDD-XXXX`" — format spec, not a TODO.
- `services/payments/src/mpesa/stk-push.ts:108` — JSDoc describing
  M-Pesa phone format.
- `apps/customer-app/src/lib/hooks/useCurrencyPreference.ts:91` —
  documents the `'XXX'` ISO sentinel behavior (correct semantics, not a
  TODO).
- `packages/compliance-plugins/src/validators/tax-id.ts:59, 64` — note
  fields describing US EIN / SSN formats.
- `services/identity/src/phone-normalize.ts:51` — explanatory comment
  about regex branches.

(57 entries total; left untouched.)

---

## Notes

- The TodoWrite / TaskStop / NotebookEdit tools were intentionally not
  invoked — the brief scopes triage to a written report only.
- ProdFix-1 through ProdFix-5 own files outside this report's
  jurisdiction; their TODOs are listed in this triage but the actual
  wire-up sits in their pull request, not this one.
- Cross-file consistency: the currency-pattern widening in this pass
  (#8, #9, #10 in the brief) keeps three detectors in sync —
  `pii-scrubber.ts`, `policy-gate.ts`, `self-rag.ts`. The shared
  source lives in `packages/ai-copilot/src/security/currency-patterns.ts`.
