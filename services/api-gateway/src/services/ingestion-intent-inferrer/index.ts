/**
 * Public surface of the ingestion intent inferrer service.
 * Wave COMPANY-BRAIN (Y-A).
 */

export {
  inferIngestIntent,
  type InferIntentOptions,
  type InferrerLlmCall,
} from './inferrer.js';
export {
  generateHeuristicIntent,
  type HeuristicOptions,
} from './heuristic.js';
export type {
  IngestIntent,
  IngestSnapshot,
  ProposedOpportunity,
  ProposedReminder,
  ProposedRisk,
  ProposedTab,
} from './types.js';
