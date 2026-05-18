# LITFIN → BOSSNYUMBA brain+mind parity plan

Date: 2026-05-05
Status: in progress

## Status as of 2026-05-18

**This umbrella plan is now SUPERSEDED for parity-claim purposes by `.planning/parity-litfin/00-STATUS-2026-05-18.md`.** That doc carries the canonical SHIPPED / PARTIAL / OPEN / IN-FLIGHT status across all 13 original gaps in this plan + the 10 deep-dive docs `01..10-*.md` written 2026-05-15.

Of the 13 original kernel-discipline gaps in §"Real gaps" below:

| # | Gap                                  | Status 2026-05-18 |
|---|--------------------------------------|-------------------|
| 1 | 13-step cognitive pipeline           | ✅ SHIPPED — `kernel/kernel.ts` 2421 LOC, all 13 steps + 13a-f post-decision cluster (Wave-K) |
| 2 | Identity-first prompt assembly       | ✅ SHIPPED — `kernel/identity.ts:277-297` `[IDENTITY — DO NOT OVERRIDE]` block (Wave-K) |
| 3 | Inviolable refusal gates             | ✅ SHIPPED — 7-cat authed `inviolable.ts:33-42` + 6-cat public `public-inviolable.ts:44-141`. **BOSSNYUMBA-AHEAD** |
| 4 | Policy gate at output                | ✅ SHIPPED — `kernel/policy-gate.ts:34-92` (Phase D9 adds 4 more checks) |
| 5 | Self-awareness + persona drift       | ✅ SHIPPED — `self-awareness.ts:159-477` + 24-dim drift vector `persona-drift/vectors.ts:28-53`. **BOSSNYUMBA-AHEAD** |
| 6 | Theory of mind + cognitive load      | ✅ SHIPPED — stateful accumulators `theory-of-mind.ts:152-390` + `cognitive-load.ts:101-279` (Phase A) |
| 7 | Awareness scopes                     | ✅ SHIPPED — `kernel/awareness-scopes.ts` |
| 8 | Confidence scoring                   | ✅ SHIPPED — `kernel/confidence.ts` (4-axis vector) + Phase D12 5-C extension in flight |
| 9 | CoT reservoir sampling               | ✅ SHIPPED — `kernel/cot-reservoir.ts` 1/5/50/100% by stakes; Phase D3 ✅ adds PII scrub + RLS + queryCot |
| 10 | Sensor failover                     | ✅ SHIPPED — `sensor-failover.ts:38-321` with rolling 60s window + 3-strike breaker (Phase A) |
| 11 | Brain-side cache                    | ✅ SHIPPED — `brain-cache.ts:77-125` with pattern-family hit + semantic cache layering (Phase D4) |
| 12 | Output normalizer                   | ✅ SHIPPED — `normalizer.ts:33-287` (7 preamble + 4 trailing + smart-quote + JSON repair + ui_block extract) |
| 13 | Continuous grading dimension        | ✅ SHIPPED — `continuous-grading.ts:158-535` (5-axis × 80-150 LOC). **BOSSNYUMBA-AHEAD** (696 LOC vs LITFIN 404) |

**All 13 gaps in the original plan are SHIPPED.** BOSSNYUMBA is now AHEAD of LITFIN on 15 dimensions tracked in `00-STATUS-2026-05-18.md` §3 (24-dim drift, streaming kernel, 18-tool BrainToolSpec, persistent privacy-budget, tier-scaled k-anonymity, AsyncLocalStorage tenant-isolation, two-track inviolable gates, HMAC-rotation audit chain, 696-LOC continuous-grading, advisory-lock sovereign ledger, OTel 0.218 full stack, per-agent Grafana D6, Temporal Entity Graph + Louvain, DB-backed sensor-routing control plane, tenant credit-rating model).

For any new work referencing this plan, also read `00-STATUS-2026-05-18.md` §4 (Phase E candidates) and §5 (Wave-M / deferred) before opening a PR.

---


## Goal

Bring BOSSNYUMBA's central intelligence to LITFIN-grade discipline — the
"Jarvis from Iron Man, but for property management" target — by mirroring
LITFIN's brain+mind kernel patterns, scoped to real-estate, while reusing
the security and orchestration primitives BOSSNYUMBA already ships.

## What both projects already have

*(Refreshed 2026-05-18 — see also `parity-litfin/00-STATUS-2026-05-18.md` §3 for the 15-item BOSSNYUMBA-ahead list.)*

| Capability                 | LITFIN              | BOSSNYUMBA              | Verdict 2026-05-18 |
|----------------------------|---------------------|-------------------------|--------------------|
| Central intelligence agent | brain-kernel.ts 1628 LOC | `kernel.ts` 2421 LOC + `thinkStream()` | **BOSSNYUMBA-ahead** (streaming kernel) |
| Hash-chain audit           | block32_audit_events | `audit-hash-chain.ts` HMAC-SHA-256 + rotation + `timingSafeEqual` | **BOSSNYUMBA-ahead** (rotation discipline) |
| Knowledge graph            | Neo4j               | Neo4j + temporal-entity-graph + Louvain (922 LOC) | **BOSSNYUMBA-ahead** (Louvain communities) |
| Forecasting                | TGN + foundation    | TGN + conformal         | parity |
| HQ portal                  | litfin-ai-ops       | admin-platform-portal + mission-eval UI | parity |
| LLM tool-use               | `tools.ts` 4 brain tools | `tool-spec.ts:510` 510 LOC + 18 `platform.*` typed-action bus | **BOSSNYUMBA-ahead** (18 vs 4) |
| Personas                   | `identity.ts` single-tenant | `identity.ts` 374 LOC, 8 personas + `branding.ts` per-tenant resolver | **BOSSNYUMBA-ahead** (per-tenant DNA) |
| Eval harness               | self-review judge   | `ai-copilot/eval` + `central-intelligence/__tests__/eval` 309 scenarios + per-PR CI | **BOSSNYUMBA-ahead** (CI + dual mode) |
| Vacancy pipeline           | n/a (lending)       | vacancy-to-lease orch   | BOSSNYUMBA-only |
| DP aggregation             | Laplace only        | Laplace + Gaussian + persistent ε,δ budget + crypto-RNG | **BOSSNYUMBA-ahead** (Gaussian + persistence) |
| k-anonymity                | global k=5          | tier-scaled lattice 5 → 7 → 10 → 15 → 20 → 25 | **BOSSNYUMBA-ahead** |
| Tenant isolation           | `buildTenantFilter` helper | AsyncLocalStorage `runWithTenantContext` + `TenantScoped` generic | **BOSSNYUMBA-ahead** (type-level) |
| Persona drift              | 1-D Jaccard scalar  | 24-dim persona-vector probe + alert pipeline | **BOSSNYUMBA-ahead** |
| Observability              | Sentry + platform_events | OpenTelemetry 0.218 + Grafana JSON + Prom alerts + Langfuse | **BOSSNYUMBA-ahead** (OTel full stack) |
| Inviolable refusal gates   | single authed gate  | 7-cat authed + 6-cat public (two-track) | **BOSSNYUMBA-ahead** |
| Continuous grading         | `five-c-continuous.ts` 404 LOC (credit-side) | `continuous-grading.ts` 696 LOC (property-side) | **BOSSNYUMBA-ahead** |
| Killswitch HALT            | brain-kernel.ts:814-869 | `kernel/killswitch.ts:202` + migration 0138 | parity |
| Reflexion lesson loop      | context-hash + decayed rerank | `kernel/reflexion/` + migration 0134 | parity |
| Regulatory mirror          | TZ statute via `regulatoryAudit` | `kernel/regulatory-mirror.ts:179` TZ Landlord & Tenant (Phase D8) | parity (TZ); KE/UG deferred Wave-M |
| Uncertainty policy         | resolveUncertainty `deliver/caveat/ask/tool/escalate` | `kernel/uncertainty-policy.ts:230` | parity |
| Secret rotation runbook    | Docs/SECRETS-ROTATION.md + 4-phase | Docs/SECRETS_ROTATION.md + scripts/rotate-keys.mjs | parity |
| SBOM + Trivy + red-team CI | security.yml         | sbom.yml + trivy.yml + red-team.yml | parity |
| Tenant credit rating       | borrower 5-C model  | `ai-copilot/credit-rating/` (rent-arrears + lease-tenure + occupancy) | BOSSNYUMBA-only (property-mgmt) |

## Real gaps (LITFIN has, BOSSNYUMBA does not)

These are kernel-discipline patterns, not missing subsystems:

1. **13-step cognitive pipeline** — atomic `think()` orchestrator that
   sequences cache → memory → cohort → policy framing → sensor →
   tools → normalize → judge → gate → confidence → provenance → cache
   write. BOSSNYUMBA's agent-loop streams tools but skips normalize,
   judge, gate, and confidence.
2. **Identity-first prompt assembly** — first-person system prompt
   injected before all other instructions; persona is in a dedicated
   module, not inlined in the loop.
3. **Inviolable refusal gates** — hard refusals for cross-tenant
   leakage / IP / privacy / regulatory. Distinct from prompt-shield
   (which sanitises) and output-guard (which redacts).
4. **Policy gate at output** — deterministic post-processing for PII /
   numerical claims / regulatory hedges. Wraps existing output-guard.
5. **Self-awareness + persona drift detection** — measures voice
   consistency turn-over-turn; flags drift; halts on serious drift.
6. **Theory of mind + cognitive load** — observed mental state of
   the user; throttles depth when overload detected.
7. **Awareness scopes** — tier-scoped visibility bubbles richer than
   the binary tenant/platform split (Tenant → Lease → Block → Property
   → Portfolio → Org → Industry).
8. **Confidence scoring** — composite (groundedness, stability, review,
   numerical consistency) attached to every decision.
9. **CoT reservoir sampling** — sampled chain-of-thought stored for
   audit replay (1% sample by default; 100% on high-stakes).
10. **Sensor failover** — multi-provider routing with health tracking
    and degradation mode (Anthropic primary, OpenAI fallback for vision,
    DeepSeek for batch).
11. **Brain-side cache** — 60s LRU keyed on (scope, message-hash,
    persona) — separate from LLM provider cache.
12. **Output normalizer** — strip preamble, repair JSON, extract
    ui_block, coerce shape.
13. **Continuous grading dimension** — LITFIN's five-C-continuous
    equivalent for property: continuous Property/Tenant/Lease grade
    rolled into kernel context.

## Approach

Build a new `packages/central-intelligence/src/kernel/` subpackage
that **composes** existing pieces (prompt-shield, output-guard,
pii-scrubber, audit-hash-chain, agent-loop) and **adds** the missing
layers. The kernel exposes one entry point — `think(request)` — that
returns a `BrainDecision`. The streaming `agent-loop` remains the
underlying transport for tool-use; the kernel wraps it.

## Module map

```
packages/central-intelligence/src/kernel/
├── kernel.ts            — think() orchestrator (13-step pipeline)
├── kernel-types.ts      — ThoughtRequest, BrainDecision, ConfidenceVector
├── identity.ts          — first-person personas (Tenant, Owner, Estate Mgr, Sovereign)
├── inviolable.ts        — hard refusal gates
├── policy-gate.ts       — deterministic output validation
├── self-awareness.ts    — persona drift detection
├── theory-of-mind.ts    — observed user mental state
├── cognitive-load.ts    — overload detection / throttling
├── awareness-scopes.ts  — tier-scoped visibility bubbles
├── confidence.ts        — composite confidence scoring
├── cot-reservoir.ts     — sampled CoT capture
├── sensor-failover.ts   — multi-provider routing with health
├── brain-cache.ts       — 60s LRU thought cache
├── normalizer.ts        — output normalisation
├── continuous-grading.ts — Property/Tenant/Lease continuous grade
├── cohort-signal.ts     — k-anonymous aggregate evidence mix-in
└── index.ts             — public exports
```

## Migration

`packages/database/src/schemas/kernel-substrate.schema.ts` adds:
- `cot_reservoir` — sampled chain-of-thought for audit replay
- `persona_drift_events` — voice-consistency violations
- `kernel_provenance` — per-think() decision provenance

Follow-on Drizzle migration: `0099_kernel_substrate.sql`.

## Wiring

The existing `agent-loop.ts` stays untouched. New consumers can opt in:

```ts
import { createBrainKernel } from '@bossnyumba/central-intelligence/kernel';

const kernel = createBrainKernel({ ... });
const decision = await kernel.think({ scope, userMessage, threadId });
```

The chat router and orchestrators can adopt incrementally; the
agent-loop remains for streaming tool-use within a single think() call.

## Tests

Each kernel module ships with a vitest unit test covering:
- Pure-function determinism
- Edge cases (empty input, drift, overload, scope mismatch)
- Composition (kernel.test.ts runs the full 13-step pipeline against a
  mock LLM adapter)

Target ≥80% statement coverage for the kernel subpackage.

## Out of scope (deferred)

- Mobile (React Native) — separate phase.
- Voice audio I/O — schema exists, audio pipeline is separate.
- Real-time WebSocket — orthogonal infra concern.
- Real Zillow/Airbnb adapters — already stubbed; closing those is a
  data-integration phase, not a kernel concern.

## Adjacent work shipped (not kernel parity, but unblocks the agent layer)

These are NOT items from the LITFIN-parity gap list; they are the
AI-native agent persistence + gateway wirings the kernel sits next to.
Logged here so reviewers do not re-open the same gap on the agent side.

- [x] `packages/database/src/schemas/` — typed Drizzle mirrors for
  legacy migrations 0099 / 0103 / 0106 / 0110 (`voice-turns`,
  `tenant-predictions` + `predictive_intervention_opportunities`,
  `market-rate-snapshots`, `monthly-close-runs` +
  `monthly_close_run_steps`). Commit `ea93ed6`.
- [x] `packages/database/src/services/` — Drizzle services on top of
  the four schemas (voice-turns, market-rate-snapshots,
  tenant-predictions, monthly-close-runs). Duck-typed at the boundary;
  no compile-time dep on `@bossnyumba/ai-copilot`. Commit `e33cebc`.
- [x] `services/api-gateway/src/composition/` — four agent wirings
  (`monthly-close-wiring.ts`, `voice-agent-wiring.ts`,
  `market-surveillance-wiring.ts`,
  `predictive-interventions-wiring.ts`) plus the matching
  `ServiceRegistry` slots (`monthlyClose`, `voiceAgent`,
  `marketSurveillance`, `predictiveInterventions`). Each returns
  `null` when `DATABASE_URL` is unset, preserving the degraded-mode
  contract. Commit `f3f02d2`.
- [x] **Real Drizzle period-bulk adapters for the Monthly Close
  Orchestrator.** The four port stubs (Reconciliation / Statement /
  Disbursement / Notification) have been replaced with tenant-scoped
  Drizzle adapters under
  `services/api-gateway/src/services/monthly-close/`. Disbursements
  queue `MonthlyCloseDisbursementProposed` to `event_outbox`;
  notifications insert into `notification_dispatch_log`. Statement
  PDF rendering remains a follow-up worker (rows persist with
  `degraded_reason: 'no_pdf_renderer'`). Commit `0ac239f`.
- [x] **BrainKernel constructed at the api-gateway composition root.**
  `services/api-gateway/src/composition/brain-kernel-wiring.ts` (203
  lines) constructs the central-intelligence kernel against the
  budget-guarded Anthropic client + the in-memory `cot-reservoir`,
  `brain-cache`, and `sensor-failover` adapters. Voice-agent wiring
  now flips from the polite `VOICE_BRAIN_NOT_CONFIGURED` stub to the
  real kernel-think path when `ANTHROPIC_API_KEY` is set. Commit
  `eb21991`.
- [x] **Customer-app currency hook + KES-literal cleanup.**
  `apps/customer-app/src/lib/hooks/useCurrencyPreference.ts` resolves
  the user → tenant → platform-default chain via api-client.
  Hardcoded `'KES'` removed from 8 customer-app files. `/messages`
  page wired to `messagingService.list` + `send`. Commit `464f139`.
- [x] **Estate-manager home + briefing pages wired to head-briefing
  router.** New `packages/api-client/src/services/head-briefing.ts`
  with typed `getMyBriefing()` / `getMyBriefingMarkdown()` /
  `getMyBriefingVoiceNarration()`. Estate-manager home + briefing
  pages render all six `BriefingDocument` sections live. Commit
  `0796887`.

Stubs still open (data-integration / external-adapter phase):
concrete Reconciliation / Statement / Disbursement port adapters for
the Monthly Close Orchestrator, Anthropic-backed `VoiceBrainPort` for
the voice agent, real `MarketRatePort` adapter (Zillow / Rentometer),
and the occupancy / leases `listActive*` adapters for both
surveillance and predictive interventions.
