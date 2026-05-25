/**
 * `@bossnyumba/sleep-pass-orchestrator` — public surface.
 *
 * Heartbeat orchestrator + 8 universally-applicable sleep passes ported
 * from LITFIN PROJECT/src/core/heartbeat. Production wires real adapters
 * at the composition root; in-memory adapters under `./passes/adapters`
 * power tests + local development.
 */

export * from './types.js';
export {
  createOrchestrator,
  nextDueFrom,
  type Orchestrator,
} from './orchestrator.js';
export * from './passes/index.js';
