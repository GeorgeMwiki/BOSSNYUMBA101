/**
 * @bossnyumba/sub-md-substrate/hooks — orchestrator hooks.
 *
 * Three hooks every primitive runs:
 *   1. decidePermission   — permission-mode → ledger status + may-act-bit
 *   2. createCapTracker   — autonomy-cap bookkeeping
 *   3. sealLedgerEntry    — deterministic-hashed audit emission
 */

export {
  decidePermission,
  decideFromMode,
  type PermissionDecision,
} from './permission-mode.js';

export {
  createCapTracker,
  type CapTracker,
  type CapMetric,
  type CapConsumeResult,
} from './autonomy-cap.js';

export { sealLedgerEntry, type SealArgs } from './ledger-seal.js';
