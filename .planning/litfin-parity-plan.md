# LITFIN → BOSSNYUMBA brain+mind parity plan

Date: 2026-05-05
Status: in progress

## Goal

Bring BOSSNYUMBA's central intelligence to LITFIN-grade discipline — the
"Jarvis from Iron Man, but for property management" target — by mirroring
LITFIN's brain+mind kernel patterns, scoped to real-estate, while reusing
the security and orchestration primitives BOSSNYUMBA already ships.

## What both projects already have

| Capability                 | LITFIN              | BOSSNYUMBA              |
|----------------------------|---------------------|-------------------------|
| Central intelligence agent | brain-kernel.ts     | central-intelligence/agent-loop |
| Hash-chain audit           | block32_audit_events| ai-audit-chain          |
| Knowledge graph            | Neo4j               | Neo4j (CPG)             |
| Forecasting                | TGN + foundation    | TGN + conformal         |
| HQ portal                  | litfin-ai-ops       | admin-platform-portal   |
| LLM tool-use               | tools.ts            | tools/registry.ts       |
| Personas                   | identity.ts         | personas/ + voice/      |
| Eval harness               | self-review judge   | ai-copilot/eval         |
| Vacancy pipeline           | n/a (lending)       | vacancy-to-lease orch   |
| DP aggregation             | not present         | graph-privacy           |

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
