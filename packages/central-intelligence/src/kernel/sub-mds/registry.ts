/**
 * Sub-MD registry — line-worker id -> factory (Gap 6).
 *
 * The eight Tier-A/B sub-MDs that ship today, keyed by their canonical
 * `_NAME` and by the hyphenated aliases the VP orchestrators emit. (Some VP
 * line-worker lists spell names with hyphens — `kra.filing-assistant`,
 * `leasing.after-hours-contact` — while the sub-MD `_NAME` constants use
 * underscores; the alias map bridges the two so a VP-emitted spawn id always
 * resolves.)
 *
 * Line-workers a VP may reference but which have NO sub-MD yet (e.g.
 * `tenant.onboarding-officer`, `utility-billing-clerk`, `employee-coordinator`)
 * are intentionally absent. The dispatch route honest-degrades on those:
 * the step is reported `skipped` with `unknown_sub_md`, never fabricated.
 *
 * Pure value module — no I/O. Each factory builds a fresh `SubMd` from an
 * injected scope, so nothing closes over request state.
 */

import type { ScopeFilter, SubMd } from './shared/sub-md-base.js';
import {
  createArrearsChaserSubMd,
  ARREARS_CHASER_NAME,
} from './arrears-chaser/index.js';
import {
  createComplaintTriageSubMd,
  COMPLAINT_TRIAGE_NAME,
} from './complaint-triage/index.js';
import {
  createKraFilingAssistantSubMd,
  KRA_FILING_ASSISTANT_NAME,
} from './kra-filing-assistant/index.js';
import {
  createLeaseCoordinatorSubMd,
  LEASE_COORDINATOR_NAME,
} from './lease-coordinator/index.js';
import {
  createLeasingAfterHoursSubMd,
  LEASING_AFTER_HOURS_NAME,
} from './leasing-after-hours-contact/index.js';
import {
  createMaintenanceDispatchSubMd,
  MAINTENANCE_DISPATCH_NAME,
} from './maintenance-dispatch/index.js';
import {
  createVendorOnboardingSubMd,
  VENDOR_ONBOARDING_NAME,
} from './vendor-onboarding/index.js';
import {
  createWeeklyReportCompilerSubMd,
  WEEKLY_REPORT_COMPILER_NAME,
} from './weekly-report-compiler/index.js';

/** A factory that builds a sub-MD bound to a tenant scope. */
export type SubMdFactory = (args: { readonly scope: ScopeFilter }) => SubMd;

/**
 * Canonical id -> factory. Keyed by each sub-MD's own `_NAME` constant.
 */
const CANONICAL_FACTORIES: Readonly<Record<string, SubMdFactory>> = Object.freeze({
  [ARREARS_CHASER_NAME]: createArrearsChaserSubMd,
  [COMPLAINT_TRIAGE_NAME]: createComplaintTriageSubMd,
  [KRA_FILING_ASSISTANT_NAME]: createKraFilingAssistantSubMd,
  [LEASE_COORDINATOR_NAME]: createLeaseCoordinatorSubMd,
  [LEASING_AFTER_HOURS_NAME]: createLeasingAfterHoursSubMd,
  [MAINTENANCE_DISPATCH_NAME]: createMaintenanceDispatchSubMd,
  [VENDOR_ONBOARDING_NAME]: createVendorOnboardingSubMd,
  [WEEKLY_REPORT_COMPILER_NAME]: createWeeklyReportCompilerSubMd,
});

/**
 * Hyphenated aliases the VP orchestrators emit -> canonical id. Keeps the
 * VP line-worker lists (which spell some names with hyphens) resolvable
 * against the underscore `_NAME` constants without editing either side.
 */
const ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'kra.filing-assistant': KRA_FILING_ASSISTANT_NAME,
  'leasing.after-hours-contact': LEASING_AFTER_HOURS_NAME,
});

/** Every line-worker id that resolves to a real sub-MD (canonical + alias). */
export const REGISTERED_SUB_MD_IDS: ReadonlyArray<string> = Object.freeze([
  ...Object.keys(CANONICAL_FACTORIES),
  ...Object.keys(ALIASES),
]);

/**
 * Resolve a sub-MD factory by line-worker id, accepting hyphen aliases.
 * Returns null when no sub-MD is registered for the id (honest-degrade
 * signal for the dispatch route).
 */
export function getSubMdFactory(lineWorkerId: string): SubMdFactory | null {
  const canonical = CANONICAL_FACTORIES[lineWorkerId];
  if (canonical) return canonical;
  const aliased = ALIASES[lineWorkerId];
  if (aliased) return CANONICAL_FACTORIES[aliased] ?? null;
  return null;
}

/** True when a real sub-MD is registered for the given line-worker id. */
export function hasSubMd(lineWorkerId: string): boolean {
  return getSubMdFactory(lineWorkerId) !== null;
}
