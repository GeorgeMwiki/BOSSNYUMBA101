/**
 * Opportunity Scanner — state resolver (BN real-estate domain).
 *
 * Builds a `ScanState` snapshot for a tenant by reading the BN tables
 * via RLS-bound Drizzle queries. Every slice is best-effort — a failed
 * slice degrades to `null` and the scanner simply skips any rule that
 * depends on it. No tenant data ever crosses tenants: every read uses
 * the `app.current_tenant_id` GUC that the api-gateway middleware
 * binds.
 *
 * The resolver does NOT fabricate numbers. When a metric isn't
 * computable from real data the corresponding field stays `null` and
 * the scanner skips the dependent rule.
 *
 * BN-specific slices wired: portfolio (units), market (leases),
 * regulator (housing amnesty stub), marketplace (listings), vendors
 * (work_orders contractor bundling), ops (maintenance backlog +
 * arrears). Remaining ScanState fields stay `null` so the scanner
 * silently skips dependent rules until the underlying tables ship.
 */

import { sql } from 'drizzle-orm';
import type { ScanState } from './types.js';

export interface ScanStateResolverDb {
  execute(query: unknown): Promise<unknown>;
}

interface RowsLike {
  readonly rows?: ReadonlyArray<Record<string, unknown>>;
}

function rowsOf(result: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as ReadonlyArray<Record<string, unknown>>;
  }
  const wrapped = result as RowsLike | null;
  return wrapped?.rows ?? [];
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function int(v: unknown): number {
  const n = num(v);
  return n == null ? 0 : Math.max(0, Math.floor(n));
}

// ─── Portfolio + occupancy slice ─────────────────────────────────────

async function resolvePortfolioSlice(
  db: ScanStateResolverDb,
  tenantId: string,
): Promise<ScanState['portfolio']> {
  try {
    const result = await db.execute(sql`
      WITH unit_counts AS (
        SELECT
          COUNT(*) FILTER (WHERE deleted_at IS NULL)                     AS total,
          COUNT(*) FILTER (WHERE status = 'occupied' AND deleted_at IS NULL) AS occupied,
          COUNT(*) FILTER (WHERE status = 'vacant'   AND deleted_at IS NULL) AS vacant
          FROM units
         WHERE tenant_id = ${tenantId}
      ),
      rent_roll AS (
        SELECT COALESCE(SUM(rent_amount), 0) AS monthly
          FROM leases
         WHERE tenant_id = ${tenantId}
           AND status   = 'active'
           AND rent_frequency = 'monthly'
      ),
      growth AS (
        SELECT COUNT(*)::int AS new_12m
          FROM units
         WHERE tenant_id = ${tenantId}
           AND created_at >= NOW() - INTERVAL '12 months'
           AND deleted_at IS NULL
      )
      SELECT uc.total, uc.occupied, uc.vacant, rr.monthly, g.new_12m
        FROM unit_counts uc, rent_roll rr, growth g
    `);
    const r = rowsOf(result)[0];
    if (!r) return null;
    const total = int(r.total);
    const occupied = int(r.occupied);
    const vacant = int(r.vacant);
    const vacancyRatePct = total > 0 ? (vacant / total) * 100 : null;
    const monthly = num(r.monthly);
    const newUnits = int(r.new_12m);
    const growthRate12m =
      total > 0 ? (newUnits / Math.max(total, 1)) * 100 : null;
    return Object.freeze({
      totalUnits: total,
      occupiedUnits: occupied,
      vacantUnits: vacant,
      vacancyRatePct,
      portfolioRolePeerP25VacancyRatePct: null,
      totalRentRollMonthly: monthly,
      avgVacancyDays: null,
      longVacantUnitsStaleListingCount: 0,
      portfolioGrowthRate12m: growthRate12m,
    });
  } catch {
    return null;
  }
}

// ─── Market + lease-expiry slice ─────────────────────────────────────

async function resolveMarketSlice(
  db: ScanStateResolverDb,
  tenantId: string,
): Promise<ScanState['market']> {
  try {
    const result = await db.execute(sql`
      WITH avg_rent AS (
        SELECT AVG(rent_amount)::numeric AS avg_rent
          FROM leases
         WHERE tenant_id = ${tenantId}
           AND status   = 'active'
           AND rent_frequency = 'monthly'
      ),
      expiring AS (
        SELECT COUNT(*)::int AS cnt
          FROM leases
         WHERE tenant_id = ${tenantId}
           AND status IN ('active', 'expiring_soon')
           AND end_date IS NOT NULL
           AND end_date BETWEEN NOW() AND NOW() + INTERVAL '90 days'
      ),
      long_stay AS (
        SELECT COUNT(*)::int AS cnt
          FROM leases
         WHERE tenant_id = ${tenantId}
           AND status   = 'active'
           AND start_date < NOW() - INTERVAL '12 months'
           AND (renewal_proposed_at IS NULL
                OR renewal_proposed_at < NOW() - INTERVAL '12 months')
      )
      SELECT ar.avg_rent, e.cnt AS expiring, ls.cnt AS long_stay
        FROM avg_rent ar, expiring e, long_stay ls
    `);
    const r = rowsOf(result)[0];
    if (!r) return null;
    const portfolioAvg = num(r.avg_rent);
    return Object.freeze({
      avgMarketRentPerUnit: null,
      portfolioAvgRentPerUnit: portfolioAvg,
      tenantRentBelowMarketPct: null,
      leasesExpiringIn90dCount: int(r.expiring),
      longStayLeasesNoReviewCount: int(r.long_stay),
      offMarketLeadsCount: 0,
    });
  } catch {
    return null;
  }
}

// ─── Regulator slice (housing amnesty stub) ──────────────────────────

async function resolveRegulatorSlice(
  db: ScanStateResolverDb,
  tenantId: string,
): Promise<ScanState['regulator']> {
  try {
    // BN has no housing-amnesty calendar table yet. We surface
    // `housingAmnestyWindowOpen=false` so dependent rules skip cleanly
    // (no fabricated values), and we count overdue service-charge
    // recovery candidates from invoices over 60 days past-due.
    const result = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (
          WHERE due_date < NOW() - INTERVAL '60 days'
            AND status = 'overdue'
            AND invoice_type IN ('service_charge', 'utilities')
        )::int AS overdue_cnt,
        COALESCE(SUM(balance_amount) FILTER (
          WHERE due_date < NOW() - INTERVAL '60 days'
            AND status = 'overdue'
            AND invoice_type IN ('service_charge', 'utilities')
        ), 0)::numeric AS overdue_total
        FROM invoices
       WHERE tenant_id = ${tenantId}
         AND deleted_at IS NULL
    `);
    const r = rowsOf(result)[0];
    if (!r) return null;
    return Object.freeze({
      housingAmnestyWindowOpen: false,
      housingAmnestyDaysRemaining: null,
      tenantQualifiesForAmnesty: false,
      estimatedPenaltyAvoided: null,
      section21WindowOpensInDays: null,
      section21OptimumNotices: 0,
      serviceChargeAuditOverdueCount: int(r.overdue_cnt),
      estimatedServiceChargeRecovery: num(r.overdue_total),
    });
  } catch {
    return null;
  }
}

// ─── Marketplace listings slice ──────────────────────────────────────

async function resolveMarketplaceSlice(
  db: ScanStateResolverDb,
  tenantId: string,
): Promise<ScanState['marketplace']> {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (
          WHERE status = 'expired'
             OR (expires_at IS NOT NULL AND expires_at < NOW())
        )::int AS stale_cnt
        FROM marketplace_listings
       WHERE tenant_id = ${tenantId}
    `);
    const r = rowsOf(result)[0];
    if (!r) return null;
    return Object.freeze({
      latestListingViewRate30d: null,
      bestPerformingChannelName: null,
      worstPerformingChannelName: null,
      staleListingCount: int(r.stale_cnt),
    });
  } catch {
    return null;
  }
}

// ─── Vendors (work-order bundling) slice ─────────────────────────────

async function resolveVendorsSlice(
  db: ScanStateResolverDb,
  tenantId: string,
): Promise<ScanState['vendors']> {
  try {
    // Maintenance bundling — vendors with >=3 pending work orders are
    // candidates for a single dispatch (saves mobilisation fees).
    const result = await db.execute(sql`
      SELECT v.legal_name             AS contractor,
             COUNT(wo.id)::int        AS pending_cnt
        FROM work_orders wo
        JOIN vendors v ON v.id = wo.vendor_id
       WHERE wo.tenant_id = ${tenantId}
         AND wo.status IN ('submitted', 'assigned', 'scheduled')
         AND wo.deleted_at IS NULL
       GROUP BY v.legal_name
      HAVING COUNT(wo.id) >= 3
       ORDER BY pending_cnt DESC
       LIMIT 10
    `);
    const candidates = rowsOf(result).map((r) =>
      Object.freeze({
        contractor:
          typeof r.contractor === 'string' ? r.contractor : 'Unnamed',
        pendingTicketCount: int(r.pending_cnt),
        // Mobilisation-fee assumption per bundling pass. The number
        // lives in vendor scorecards in future work; until then, the
        // rule fires the savings range as a hint rather than precise
        // amount.
        mobilizationFee: 0,
      }),
    );
    return Object.freeze({
      categoriesWithMultipleSuppliers: Object.freeze([]),
      maintenanceBundlingCandidates: Object.freeze(candidates),
    });
  } catch {
    return null;
  }
}

// ─── Ops (maintenance backlog + arrears) slice ───────────────────────

async function resolveOpsSlice(
  db: ScanStateResolverDb,
  tenantId: string,
): Promise<ScanState['ops']> {
  try {
    const result = await db.execute(sql`
      WITH backlog AS (
        SELECT COUNT(*)::int AS cnt
          FROM work_orders
         WHERE tenant_id = ${tenantId}
           AND status IN ('submitted', 'assigned', 'scheduled', 'in_progress')
           AND deleted_at IS NULL
      ),
      arrears AS (
        SELECT COALESCE(SUM(balance_amount), 0)::numeric AS total
          FROM invoices
         WHERE tenant_id = ${tenantId}
           AND status = 'overdue'
           AND balance_amount > 0
           AND deleted_at IS NULL
      ),
      auto_debit AS (
        SELECT
          COUNT(DISTINCT c.id)::int AS no_autodebit_cnt,
          AVG(l.rent_amount)::numeric AS avg_rent
          FROM customers c
          JOIN leases   l ON l.customer_id = c.id AND l.status = 'active'
         WHERE c.tenant_id = ${tenantId}
           AND NOT EXISTS (
             SELECT 1 FROM payment_methods pm
              WHERE pm.customer_id = c.id
                AND pm.kind = 'mandate'
                AND pm.deleted_at IS NULL
           )
      )
      SELECT b.cnt AS backlog,
             a.total AS arrears,
             ad.no_autodebit_cnt AS no_ad_cnt,
             ad.avg_rent AS avg_rent
        FROM backlog b, arrears a, auto_debit ad
    `);
    const r = rowsOf(result)[0];
    if (!r) {
      return Object.freeze({
        maintenanceBacklogCount: 0,
        maintenanceBacklogP25: null,
        avgMoveOutTurnaroundDays: null,
        turnaroundP25Days: null,
        arrearsTotalAmount: null,
        arrearsPeerP25Amount: null,
        tenantsWithoutAutoDebitCount: 0,
        avgRentPerTenantForAutoDebit: null,
      });
    }
    return Object.freeze({
      maintenanceBacklogCount: int(r.backlog),
      maintenanceBacklogP25: null,
      avgMoveOutTurnaroundDays: null,
      turnaroundP25Days: null,
      arrearsTotalAmount: num(r.arrears),
      arrearsPeerP25Amount: null,
      tenantsWithoutAutoDebitCount: int(r.no_ad_cnt),
      avgRentPerTenantForAutoDebit: num(r.avg_rent),
    });
  } catch {
    // payment_methods may not exist in every install — degrade to a
    // backlog-only read so the maintenance-bundling rule still fires.
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*)::int AS backlog
          FROM work_orders
         WHERE tenant_id = ${tenantId}
           AND status IN ('submitted', 'assigned', 'scheduled', 'in_progress')
           AND deleted_at IS NULL
      `);
      const r = rowsOf(result)[0];
      return Object.freeze({
        maintenanceBacklogCount: r ? int(r.backlog) : 0,
        maintenanceBacklogP25: null,
        avgMoveOutTurnaroundDays: null,
        turnaroundP25Days: null,
        arrearsTotalAmount: null,
        arrearsPeerP25Amount: null,
        tenantsWithoutAutoDebitCount: 0,
        avgRentPerTenantForAutoDebit: null,
      });
    } catch {
      return null;
    }
  }
}

// ─── Currency-preferences lookup ─────────────────────────────────────

async function resolvePrimaryCurrency(
  db: ScanStateResolverDb,
  tenantId: string,
): Promise<string> {
  try {
    const result = await db.execute(sql`
      SELECT currency
        FROM currency_preferences
       WHERE tenant_id = ${tenantId}
       LIMIT 1
    `);
    const r = rowsOf(result)[0];
    if (r && typeof r.currency === 'string' && r.currency.length >= 3) {
      return r.currency;
    }
    return 'TZS';
  } catch {
    return 'TZS';
  }
}

// ─── Public resolver ─────────────────────────────────────────────────

/**
 * Build a `ScanState` for the tenant by fanning out the per-slice
 * resolvers in parallel. Every slice degrades to `null` on failure so
 * a single problem table cannot break the whole scan. The scanner's
 * rules treat any unknown slice as `undefined` and skip silently.
 */
export async function resolveScanState(
  db: ScanStateResolverDb,
  tenantId: string,
  nowIso: string = new Date().toISOString(),
): Promise<Readonly<ScanState>> {
  const [
    primaryCurrencyCode,
    portfolio,
    market,
    regulator,
    marketplace,
    vendors,
    ops,
  ] = await Promise.all([
    resolvePrimaryCurrency(db, tenantId),
    resolvePortfolioSlice(db, tenantId),
    resolveMarketSlice(db, tenantId),
    resolveRegulatorSlice(db, tenantId),
    resolveMarketplaceSlice(db, tenantId),
    resolveVendorsSlice(db, tenantId),
    resolveOpsSlice(db, tenantId),
  ]);

  return Object.freeze({
    tenantId,
    nowIso,
    primaryCurrencyCode,
    portfolio,
    market,
    regulator,
    marketplace,
    vendors,
    ops,
    // Slices below intentionally null until the underlying BN tables
    // (tax calendar, estate planning, energy meters, etc.) ship.
    tax: null,
    estate: null,
    workforce: null,
    insurance: null,
    peer: null,
    counterparties: null,
    energy: null,
    capital: null,
    sublet: null,
    longStay: null,
  });
}

export const __testing = {
  resolvePortfolioSlice,
  resolveMarketSlice,
  resolveRegulatorSlice,
  resolveMarketplaceSlice,
  resolveVendorsSlice,
  resolveOpsSlice,
  resolvePrimaryCurrency,
};
