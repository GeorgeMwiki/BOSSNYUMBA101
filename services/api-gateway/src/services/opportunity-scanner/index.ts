/**
 * Opportunity Scanner — public barrel (real-estate domain).
 *
 * Mr. Mwikila proactively scans the owner's tenant state for upside
 * (vacancy reduction, rent uplift, tax efficiency, regulatory
 * windows, market timing, peer best practices, etc.) every
 * conversational turn. Surfaces the top-ranked Opportunity blocks
 * below the AI bubble via SSE `opportunity_proposed` events.
 *
 * Brain-tools `property.opportunities.scan|expand|schedule` are
 * registered via composition layer (brain agent).
 */

export type {
  Opportunity,
  OpportunityAction,
  OpportunityKind,
  ScanRule,
  ScanState,
  Bilingual,
} from './types.js';
export {
  OpportunitySchema,
  OpportunityActionSchema,
  OPPORTUNITY_KINDS,
  BilingualSchema,
} from './types.js';

export { SCAN_RULES, ALL_SCAN_RULES } from './scan-rules.js';

export {
  scanOpportunities,
  renderOpportunityHeadline,
  renderOpportunityNarrative,
  type ScanOptions,
} from './scanner.js';
export { scanAndPublishOpportunities } from './publish.js';
