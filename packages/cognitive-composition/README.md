# @bossnyumba/cognitive-composition

**Wave NEURO-WIRING-SOTA, Phase 3.**

Composition root that wires the 12 cognitive subsystems into a single named
pipeline and owns the operator-grade 12-wire health probe.

Persona: Mr. Mwikila. Brand: Borjie.

See `Docs/DESIGN/NEURO_WIRING_SOTA_2026.md` for the full design — this
package is the implementation of §6 (composition root) and §8 (12-wire
health probe + migration 0076).

## What it does

- **`createCognitiveComposition(deps)`** returns a composer with two methods:
  - `compose(input)` → runs the full 9-stage pipeline and returns a
    `CognitiveOutput` with provenance + confidence label.
  - `wireHealth()` → runs the 12-wire health probe (each probe bounded by
    `PROBE_TIMEOUT_MS = 2000ms`) and persists the result to the
    `cognitive_wiring_health` table.

## The 12 wires

| # | Wire | Source package |
|---|------|----------------|
| 1 | `cognitive-engine.inference`           | `@bossnyumba/cognitive-engine` |
| 2 | `cognitive-memory.episodic`            | `@bossnyumba/cognitive-memory` |
| 3 | `cognitive-memory.semantic`            | `@bossnyumba/cognitive-memory` |
| 4 | `cognitive-memory.procedural`          | `@bossnyumba/cognitive-memory` |
| 5 | `cognitive-memory.reflective`          | `@bossnyumba/cognitive-memory` |
| 6 | `extended-reasoning.cot`               | `@bossnyumba/extended-reasoning` |
| 7 | `reasoning-substrate.compile`          | `@bossnyumba/reasoning-substrate` |
| 8 | `central-intelligence.kernel`          | `@bossnyumba/central-intelligence` |
| 9 | `calibration-monitor.confidence`       | `@bossnyumba/calibration-monitor` |
| 10 | `conformal-calibration-online.update` | `@bossnyumba/conformal-calibration-online` |
| 11 | `audit-hash-chain.append`             | `@bossnyumba/audit-hash-chain` |
| 12 | `brain-llm-router.cascade`            | `@bossnyumba/brain-llm-router` |

Status classification per probe:

- **ok** — resolved, latency ≤ 800ms
- **degraded** — resolved, latency > 800ms
- **down** — rejected or timed out (≥ 2000ms)

## Dependency injection

The package never imports the heavy upstream subsystems directly — it
defines port interfaces (`InferencePort`, `MemoryTierPort`, `CotPort`, …)
that callers satisfy with thin adapters. This keeps the workspace dep
graph acyclic and the unit/integration tests fast.

## Migration

The companion table lives in `packages/database/drizzle/0076_cognitive_wiring_health.sql`
and is tenant-scoped via the canonical `current_setting('app.tenant_id', true)`
GUC RLS policy from migration 0003.
