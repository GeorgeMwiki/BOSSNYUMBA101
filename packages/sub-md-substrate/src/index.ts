/**
 * @bossnyumba/sub-md-substrate — Phase J4
 *
 * Generic substrate of 6 sub-MD primitives + vertical packs that bind
 * primitives to specific entity types and connectors.
 *
 * Primitives (domain-agnostic):
 *   Triage     classify-and-route
 *   Dispatch   pick-counterparty + send
 *   Draft      generate reviewable artifact (never sends)
 *   Chase      multi-step follow-up with escalation
 *   Compile    aggregate signals into a report
 *   Reconcile  match two sides + flag deltas
 *
 * Verticals shipped:
 *   property-management   owner-customer flows (subset 1)
 *   bossnyumba-internal   the org running itself (subset 2)
 *
 * Existing kernel sub-MDs in
 * `packages/central-intelligence/src/kernel/sub-mds/` are NOT modified
 * in this phase. The substrate is built alongside; migration is the
 * next phase.
 */

export {
  type ScopeFilter,
  type PermissionMode,
  type AutonomyCap,
  DEFAULT_AUTONOMY_CAP,
  type LedgerEntry,
  type LedgerStatus,
  type LedgerSealPort,
  type PrimitiveKind,
  type PrimitiveContext,
  type PrimitiveResult,
  type InScopeResult,
  isInScope,
  scopeFilterSchema,
  permissionModeSchema,
  autonomyCapSchema,
  ledgerEntrySchema,
} from './types.js';

export * from './primitives/index.js';
export * from './hooks/index.js';
export * from './vertical-pack/index.js';

export { fingerprint, stableStringify } from './util/hash.js';
export {
  createLedgerRecorder,
  type LedgerRecorder,
} from './util/ledger-recorder.js';

export * as propertyManagement from './verticals/property-management/index.js';
export * as bossnyumbaInternal from './verticals/bossnyumba-internal/index.js';
