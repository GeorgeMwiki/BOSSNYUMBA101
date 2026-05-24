/**
 * @bossnyumba/document-quality-guarantor — public barrel.
 *
 * The single import surface for the rest of the system. Callers wire
 * engines + gates + queue + escalation + audit into the factory and
 * receive a fully assembled façade.
 *
 * Subsystems beyond intake/output/format-coverage/audit (quality
 * gates, retry queue, escalation) land in milestones 2 and 3; this
 * barrel re-exports them as they ship so consumers never have to
 * change their import paths.
 */

export * from './types.js';

export {
  createInMemoryAuditChainStore,
  replayOperation,
  AUDIT_EVENT_KINDS,
  type AuditChainStore,
  type AuditEntry,
  type AuditEventKind,
  type OperationReplay,
} from './audit/index.js';

export {
  createFormatRegistry,
  BUILT_IN_HANDLERS,
  type FormatRegistry,
} from './format-coverage/index.js';

export {
  createIntakeOrchestrator,
  type IntakeOrchestrator,
  type IntakeOrchestratorDeps,
} from './intake/index.js';

export {
  createOutputOrchestrator,
  type OutputOrchestrator,
  type OutputOrchestratorDeps,
} from './output/index.js';
