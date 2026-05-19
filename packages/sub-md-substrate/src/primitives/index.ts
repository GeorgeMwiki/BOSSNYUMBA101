/**
 * @bossnyumba/sub-md-substrate/primitives — the 6 generic primitives.
 *
 * Every primitive: (a) takes a `PrimitiveContext`, (b) runs the three
 * substrate hooks (permission-mode / autonomy-cap / ledger-seal), (c)
 * returns a frozen `PrimitiveResult<TOutput>` with a sealed ledger entry.
 */

export {
  createTriage,
  type TriagePrimitive,
  type TriageOptions,
  type TriageStrategy,
  type TriageClassification,
} from './triage.js';

export {
  createDispatch,
  type DispatchPrimitive,
  type DispatchOptions,
  type DispatchSelector,
  type DispatchTransportPort,
  type DispatchCandidate,
  type DispatchRoute,
} from './dispatch.js';

export {
  createDraft,
  type DraftPrimitive,
  type DraftOptions,
  type DraftStrategy,
  type DraftArtifact,
} from './draft.js';

export {
  createChase,
  type ChasePrimitive,
  type ChaseOptions,
  type ChaseLadder,
  type ChaseLadderRung,
  type ChaseDecision,
  type ChaseHistoryEntry,
} from './chase.js';

export {
  createCompile,
  type CompilePrimitive,
  type CompileOptions,
  type CompileStrategy,
  type CompileWindow,
  type CompileReport,
} from './compile.js';

export {
  createReconcile,
  type ReconcilePrimitive,
  type ReconcileOptions,
  type ReconcileStrategy,
  type ReconcileResult,
  type ReconcileRow,
  type ReconcileMatch,
} from './reconcile.js';
