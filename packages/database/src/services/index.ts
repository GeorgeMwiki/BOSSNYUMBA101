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

// Kernel grounding — Drizzle-backed GroundingFactsProvider that reads
// occupancy, active leases, open work-orders, and lease-expiry counts.
// Triggered by user-message keywords; produces tenant-scoped facts the
// kernel mixes into the system prompt as grounding evidence.
export {
  createKernelGroundingProvider,
  type GroundingFactShape,
  type GroundingFactsProviderShape,
  type KernelGroundingDeps,
} from './kernel-grounding.service.js';

// Kernel cohort — Drizzle-backed TenantAggregateSource for the
// graph-privacy DP aggregator. Composed at the api-gateway sovereign
// composition root; reads cross-tenant arrears / collections /
// renewals / maintenance-TTC. Returns per-tenant per-statistic
// contributions; missing data ⇒ empty array (the aggregator handles
// that path safely). Port shape duck-typed locally so this package
// does not compile-time-depend on @bossnyumba/graph-privacy.
export {
  createPgTenantAggregateSource,
  type TenantAggregateSourceShape,
  type ContributionsArgs,
  type PlatformSliceShape,
} from './kernel-cohort.service.js';
