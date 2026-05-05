/**
 * Service-level orchestration on top of repositories.
 */

export {
  MigrationWriterService,
  type ExtractedBundle,
  type WriterReport,
  type WriterRowOutcome,
  type WriterOptions,
  type PropertyDraft,
  type UnitDraft,
  type TenantDraft,
  type EmployeeDraft,
  type DepartmentDraft,
  type TeamDraft,
} from './migration-writer.service.js';

// Brain kernel substrate — Drizzle-backed sinks for the central
// intelligence kernel's CoT reservoir, persona drift, and provenance.
export {
  createKernelSubstrateService,
  type KernelSubstrateService,
  type KernelSinkScope,
  type CotSampleShape,
  type PersonaDriftShape,
  type ProvenanceShape,
} from './kernel-substrate.service.js';

// Kernel memory — Drizzle-backed prior-turns loader and recent-user-
// turn counter for the central intelligence kernel. Reads thread_events
// (the brain's existing conversation log) — read-only, never mutates.
export {
  createKernelMemoryService,
  type KernelMemoryService,
  type KernelMemoryDeps,
  type KernelPriorTurn,
} from './kernel-prior-turns.service.js';
