/**
 * Mr. Mwikila autonomy service — public barrel.
 *
 * Composition order:
 *   1. createMwikilaDelegationStore({ db })
 *   2. createMwikilaInboxRecorder({ db })
 *   3. createMwikilaHandlerRuntime({ recorder, delegations,
 *      resolveDomesticCurrency, isKillSwitchOpen })
 *   4. Five canonical handlers: createRentSchedulerHandler,
 *      createRegulatoryFilingHandler, createLeaseRenewalHandler,
 *      createPayrollHandler, createListingCounterOfferHandler.
 *
 * Worker tick: each cron tick walks the registered handlers and calls
 * runtime.run({ tenantId, actingOnUserId, handler }).
 */

export {
  DELEGATION_CATEGORIES,
  DELEGATION_TIERS,
  ACTION_STATUSES,
  RecordActionInputSchema,
  MwikilaError,
  type DelegationCategory,
  type DelegationTier,
  type ActionStatus,
  type MwikilaInboxRow,
  type RecordActionInput,
} from './types.js';

export {
  createMwikilaDelegationStore,
  type MwikilaDelegationStore,
  type MwikilaDelegationStoreDeps,
} from './delegation-store.js';

export {
  createMwikilaInboxRecorder,
  pickInitialStatus,
  type MwikilaInboxRecorder,
  type MwikilaInboxRecorderDeps,
} from './inbox-recorder.js';

export {
  createMwikilaHandlerRuntime,
  type MwikilaHandler,
  type MwikilaHandlerProposal,
  type MwikilaHandlerRuntime,
  type MwikilaHandlerRuntimeDeps,
} from './handler-runtime.js';

export * from './handlers/index.js';
