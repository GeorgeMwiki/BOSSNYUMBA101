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
  type GroundingViewRole,
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

// Platform privacy-budget ledger — Drizzle-backed PlatformBudgetLedger
// (port duck-typed locally; see platform-budget-ledger.service.ts).
// Composed at the api-gateway sovereign composition root in place of
// the in-memory ledger so cohort DP-aggregator budget consumption
// survives api-gateway restarts. Backed by migration 0116.
export {
  createPgPlatformBudgetLedger,
  PrivacyBudgetExhaustedError,
  type PlatformBudgetLedgerShape,
  type PgBudgetLedgerDeps,
} from './platform-budget-ledger.service.js';

// Currency rates — Drizzle-backed FX normaliser used by the
// platform-overview HQ KPI router. Loads ISO-4217 → USD snapshots
// from `currency_rates` (migration 0117) and converts mixed-currency
// payment sums into a single USD total. Unknown codes contribute 0
// with a soft warn — never throws on lookup misses.
export {
  createCurrencyRatesService,
  type CurrencyRate,
  type CurrencySum,
  type CurrencyRatesService,
} from './currency-rates.service.js';

// Persona branding — Drizzle-backed persistence for per-tenant
// kernel-persona overrides (displayName / openingPreamble / voice
// profile id). Adapts to the kernel's PersonaBrandingResolver port at
// the api-gateway sovereign composition root. Migration 0118.
export {
  createPersonaBrandingService,
  type PersonaBrandingShape,
  type PersonaBrandingService,
} from './persona-branding.service.js';

// Currency preferences — per-user / per-tenant / platform-default
// display-currency choice. Resolution chain: user → tenant → platform.
// Built for the world, starting with TZ — operators add new currencies
// via the table without code changes. Migration 0119.
export {
  createCurrencyPreferencesService,
  type CurrencyPreferenceRow,
  type CurrencyPreferenceScopeKind,
  type CurrencyPreferencesService,
  type ResolvePreferenceArgs,
  type ResolvedCurrency,
} from './currency-preferences.service.js';
