/**
 * `@bossnyumba/regulator-sim` — public surface.
 *
 * Regulator-readiness simulation for the BossNyumba real-estate operating
 * system. Three capabilities, all pure domain logic behind injected ports:
 *
 *   1. Audit replay over a date range, asserting decision invariants
 *      (CoT present, bilingual en/sw notes, registered model, fresh model
 *      card, allowed reason codes, four-eye distinct approvers, fairness
 *      deltas) across lease / rent / payout decisions.
 *   2. Tanzania PDPA subject-access + erasure drills (legal-hold aware).
 *   3. A deterministic property-regulator supervision document pack.
 *
 * Wire it at the api-gateway composition root with {@link wireRegulatorSim}
 * by injecting an audit store (+ optional audit sink and clock); the
 * simulator ships behind the default-OFF flag {@link REGULATOR_SIM_FLAG}.
 * No direct DB / SDK / env access — every side effect is an injected port.
 *
 * @module @bossnyumba/regulator-sim
 */

export {
  type DecisionOutcome,
  type DecisionDomain,
  type DecisionRecord,
  type AuditReplayInput,
  type AuditFindingCode,
  type FindingSeverity,
  type AuditFinding,
  type AuditReplayResult,
  type SubjectAccessRequest,
  type ErasureRequest,
  type PdpaAction,
  type PdpaResult,
  type SupervisionPackInput,
  type SupervisionDocument,
  type SupervisionPackResult,
  DEFAULT_ALLOWED_REASON_CODES,
  decisionRecordSchema,
  auditReplayInputSchema,
  subjectAccessRequestSchema,
  erasureRequestSchema,
  supervisionPackInputSchema,
} from './types';

export {
  type SubjectArtefact,
  type SubjectArtefactKind,
  type SubjectArtefactResolver,
  type PdpaDataPort,
  type AuditRunRecord,
  type RegulatorAuditStore,
  type RegulatorAuditSink,
  type RegulatorClock,
  systemClock,
} from './ports';

export { replayAudit, summarizeAudit } from './audit-replay';

export {
  buildSupervisionPack,
  SUPERVISION_PACK_REQUIRED_SECTIONS,
} from './supervision-pack';

export {
  fulfilSubjectAccess,
  fulfilErasure,
  pdpaEndToEnd,
} from './pdpa-readiness';

export {
  createInMemoryPdpaSurface,
  createInMemoryAuditStore,
  type InMemoryPdpaSurface,
  type InMemoryAuditStoreOptions,
} from './in-memory-store';

export {
  wireRegulatorSim,
  REGULATOR_SIM_FLAG,
  type RegulatorSim,
  type RegulatorSimDeps,
  type RegulatorSimOutcome,
  type WireRegulatorSimDeps,
} from './wire';
