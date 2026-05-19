/**
 * orchestrator-worker — public surface.
 *
 * Closes L1 #10: Anthropic Multi-Agent Research orchestrator-worker.
 */

export { runResearchTask, type RunResearchTaskInput } from './run.js';
export {
  clampWorkerCount,
  suggestWorkerCount,
  toposortSubQuestions,
  validatePlan,
} from './decompose.js';
export { buildWorkerSpec, buildWorkerInput } from './worker-spec.js';
