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
