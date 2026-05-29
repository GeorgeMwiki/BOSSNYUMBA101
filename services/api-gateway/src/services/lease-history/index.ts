/**
 * Lease history — public surface (real-estate chain-of-custody).
 */
export {
  LeaseHistoryService,
  LeaseHistoryError,
  computeStepAuditHash,
  type LeaseHistoryServiceDeps,
} from './service.js';
export {
  LEASE_HISTORY_ACTIONS,
  LEASE_HISTORY_ACTOR_ROLES,
  type LeaseHistoryAction,
  type LeaseHistoryActorRole,
  type AppendLeaseHistoryStepInput,
  type LeaseHistoryStep,
  type ShowLeaseTraceInput,
  type ShowLeaseTraceResult,
} from './types.js';
