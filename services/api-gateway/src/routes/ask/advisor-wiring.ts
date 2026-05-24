// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union; some
//   dependency-injection helpers below intentionally type-erase to keep
//   the wiring layer free of subpath import noise.

/**
 * Lazy advisor wiring.
 *
 * Builds + caches a single `AdvisorApi` instance per process. Ports
 * use the safe in-memory defaults bundled with
 * `@bossnyumba/role-aware-advisor`:
 *
 *   - BrainPort  — `createEchoBrain()`  (placeholder; P5 / composition
 *                  should swap for the real multi-LLM synthesizer
 *                  bound to `services/api-gateway/src/composition/multi-llm-synthesizer-wiring.ts`)
 *
 *   - DataPort   — empty static port (no snippets) until the RAG
 *                  fetcher is wired. The orchestrator + guard still
 *                  function — answers will quote no evidence until
 *                  the real port lands.
 *
 *   - AuditPort  — in-memory worm-shim until the persistent
 *                  WormAuditStore is injected via the composition
 *                  root (see `persistent-stores-wiring.ts`).
 *
 * The boundary is intentional — this file is the single point P5 has
 * to edit to wire real implementations. Routes import only `getAdvisor()`.
 */

import {
  createAdvisor,
  createEchoBrain,
  createStaticDataPort,
  createInMemoryAuditPort,
  type AdvisorApi,
  type AuditPort,
  type BrainPort,
  type DataPort,
} from '@bossnyumba/role-aware-advisor';

interface AdvisorDepsOverride {
  brain?: BrainPort;
  data?: DataPort;
  audit?: AuditPort;
}

let cachedAdvisor: AdvisorApi | null = null;
let cachedAudit: AuditPort | null = null;

/**
 * Get the singleton advisor for this process. First call constructs
 * with defaults; pass `overrides` from tests to inject real or fake
 * ports (the override resets the singleton).
 */
export function getAdvisor(overrides?: AdvisorDepsOverride): AdvisorApi {
  if (overrides && Object.keys(overrides).length > 0) {
    const brain = overrides.brain ?? createEchoBrain();
    const data = overrides.data ?? createStaticDataPort([]);
    const audit = overrides.audit ?? createInMemoryAuditPort();
    cachedAudit = audit;
    cachedAdvisor = createAdvisor({ brain, data, audit });
    return cachedAdvisor;
  }
  if (cachedAdvisor) return cachedAdvisor;
  const brain = createEchoBrain();
  const data = createStaticDataPort([]);
  const audit = createInMemoryAuditPort();
  cachedAudit = audit;
  cachedAdvisor = createAdvisor({ brain, data, audit });
  return cachedAdvisor;
}

/** Test helper — get the last audit port wired so tests can inspect entries. */
export function _getCachedAuditPortForTests(): AuditPort | null {
  return cachedAudit;
}

/** Test helper — wipe the singleton so the next call rebuilds. */
export function _resetAdvisorForTests(): void {
  cachedAdvisor = null;
  cachedAudit = null;
}
