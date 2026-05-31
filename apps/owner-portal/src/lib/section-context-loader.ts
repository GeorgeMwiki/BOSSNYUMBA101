/**
 * Section-context loader for the OWNER PORTAL.
 *
 * The @bossnyumba/dynamic-sections engine evaluates each section's
 * visibility predicate against a SectionContext. This loader populates
 * that context with the real-estate signals consumed by the seed
 * sections:
 *
 *   - active_leases_count
 *   - rent_due_soon_count
 *   - maintenance_open_count
 *   - lease_renewal_window_count
 *   - kra_vat_filing_window_open  (0 or 1)
 *   - tra_vat_filing_window_open  (0 or 1)
 *   - vacancy_listings_count
 *   - accountant_month_end_window_open  (0 or 1)
 *
 * Calendar windows are evaluated CLIENT-SIDE (date math is cheap +
 * deterministic + matches the user's local clock). Entity counts come
 * from the api-gateway via `/owner/sections/context`. If the endpoint
 * is unreachable we surface zero counts so sections stay HIDDEN rather
 * than render against stale data — fail-closed is the right default.
 */

import type { SectionScope } from '@bossnyumba/dynamic-sections';
import { sectionSignalKeys } from '@bossnyumba/dynamic-sections';
import { api } from './api';

interface SectionContextSnapshot {
  readonly entityCounts: Readonly<Record<string, number>>;
  readonly roles: readonly string[];
  readonly featureFlags: readonly string[];
}

interface SectionContextLoaderArgs {
  readonly tenantId: string;
  readonly orgId?: string | undefined;
  readonly scope: SectionScope;
}

interface BackendCountsResponse {
  readonly activeLeases?: number;
  readonly rentDueSoon?: number;
  readonly maintenanceOpen?: number;
  readonly leaseRenewalWindow?: number;
  readonly vacancyListings?: number;
  readonly internalStaff?: number;
  readonly roles?: readonly string[];
  readonly featureFlags?: readonly string[];
  /**
   * Optional explicit jurisdiction override sent by the backend so the
   * loader doesn't have to guess from the tenant slug. Either 'KE',
   * 'TZ', or null/undefined for tenants without an authoritative
   * jurisdiction binding.
   */
  readonly jurisdiction?: 'KE' | 'TZ' | null;
}

/**
 * VAT filing window — KE + TZ both fall on the 10th to the 20th of the
 * month inclusive. Outside this range the section stays hidden.
 */
function isVatFilingWindowOpen(now: Date): boolean {
  const day = now.getDate();
  return day >= 10 && day <= 20;
}

/**
 * Month-end window — the last 5 calendar days of the month. The
 * accountant section nudges the close BEFORE the cutoff so the close
 * isn't being chased on day 31.
 */
function isMonthEndWindowOpen(now: Date): boolean {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysLeft = Math.ceil(
    (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  return daysLeft <= 5;
}

/**
 * Fetch the backend counts. Returns an empty payload on failure so the
 * loader stays fail-closed.
 */
async function fetchBackendCounts(): Promise<BackendCountsResponse> {
  try {
    const res = await api.get<BackendCountsResponse>(
      '/owner/sections/context',
    );
    if (!res.success || !res.data) return {};
    return res.data;
  } catch (error) {
    // Pino-style structured log; surface to ops without blowing up
    // the render. The provider's TanStack Query layer will retry once.
    if (typeof console !== 'undefined') {
      console.warn('section-context-loader: backend counts unavailable', error);
    }
    return {};
  }
}

export async function loadSectionContext(
  _args: SectionContextLoaderArgs,
): Promise<SectionContextSnapshot> {
  const backend = await fetchBackendCounts();
  const now = new Date();

  // Per-jurisdiction VAT signals. When the tenant has no jurisdiction
  // binding, both are zero (the section stays hidden).
  const inFilingWindow = isVatFilingWindowOpen(now);
  const kraOpen =
    backend.jurisdiction === 'KE' && inFilingWindow ? 1 : 0;
  const traOpen =
    backend.jurisdiction === 'TZ' && inFilingWindow ? 1 : 0;
  const monthEnd = isMonthEndWindowOpen(now) ? 1 : 0;

  const entityCounts: Record<string, number> = {
    [sectionSignalKeys.activeLeases]: backend.activeLeases ?? 0,
    [sectionSignalKeys.rentDueSoon]: backend.rentDueSoon ?? 0,
    [sectionSignalKeys.maintenanceOpen]: backend.maintenanceOpen ?? 0,
    [sectionSignalKeys.leaseRenewalWindow]:
      backend.leaseRenewalWindow ?? 0,
    [sectionSignalKeys.kraVatFilingWindow]: kraOpen,
    [sectionSignalKeys.traVatFilingWindow]: traOpen,
    [sectionSignalKeys.vacancyListings]: backend.vacancyListings ?? 0,
    [sectionSignalKeys.accountantMonthEnd]: monthEnd,
    [sectionSignalKeys.internalStaff]: backend.internalStaff ?? 0,
  };

  return {
    entityCounts,
    roles: backend.roles ?? [],
    featureFlags: backend.featureFlags ?? [],
  };
}
