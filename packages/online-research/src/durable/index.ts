/**
 * durable — public surface.
 *
 * Closes L2 #8: Inngest AgentKit durable execution. Preferred over
 * Temporal because it's TS-native + survives workflow-history-
 * saturation issues that bite Temporal users with large LLM payloads.
 */

export { defineDurableFlow } from './define.js';
export {
  createInMemoryDurableEngine,
  type InMemoryDurableEngineDeps,
} from './in-memory-engine.js';
export {
  buildLeaseRenewalFlow,
  buildEvictionFlow,
  buildKraFilingFlow,
  buildOnboardingFlow,
  type LeaseRenewalArgs,
  type EvictionArgs,
  type KraArgs,
  type OnboardingArgs,
  type FlowCallbacks,
} from './flows.js';
