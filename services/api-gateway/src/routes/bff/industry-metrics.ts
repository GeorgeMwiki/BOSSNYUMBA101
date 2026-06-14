/**
 * Industry dashboard KPI aggregators — HQ-tier, cross-tenant.
 *
 * Backs the admin-platform-portal `/industry` hero page (six DP-style
 * platform KPIs). Each slot computes a single real number from a
 * canonical table via the service-role db handle (the same cross-tenant
 * path `platform-overview.hono.ts` uses): the industry surface is a
 * BossNyumba-HQ rollup, NOT a single-tenant view, so we deliberately
 * read across tenants rather than binding `app.current_tenant_id`.
 *
 * Every slot returns the same shape the page renders:
 *   { metric: string; value: number | string; unit?: string }
 *
 * On a hard DB failure each computation returns `null`; the caller then
 * surfaces a 503 so the page renders its honest DegradedCard instead of
 * a fabricated zero. No mock values are ever returned.
 */

import { and, avg, count, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import {
  arrearsCases,
  frictionFingerprints,
  leases,
  units,
  workOrders,
} from '@bossnyumba/database';

// any — Drizzle's select-builder generic chain widens through union
// generics with no runtime safety gain. Rows are narrowed via the
// `.select({…})` projection in each helper.
type DrizzleDb = any;

export interface SlotPayload {
  readonly metric: string;
  readonly value: number | string;
  readonly unit?: string;
}

export type IndustrySlotKey =
  | 'arrears-by-jurisdiction'
  | 'occupancy-by-class'
  | 'vendor-reopen-rate'
  | 'sentiment-index'
  | 'renewal-rate'
  | 'maintenance-ttc';

export const INDUSTRY_SLOT_KEYS: ReadonlyArray<IndustrySlotKey> = [
  'arrears-by-jurisdiction',
  'occupancy-by-class',
  'vendor-reopen-rate',
  'sentiment-index',
  'renewal-rate',
  'maintenance-ttc',
];

function isIndustrySlotKey(value: string): value is IndustrySlotKey {
  return (INDUSTRY_SLOT_KEYS as ReadonlyArray<string>).includes(value);
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal place
}

// ───────────────────────────────────────────────────────────────────────
// Per-slot computations. Each returns `null` on hard DB failure so the
// caller can emit a 503 → honest degraded card (never a fabricated 0).
// ───────────────────────────────────────────────────────────────────────

/**
 * Arrears headline — count of OPEN arrears cases across the platform.
 * "Open" = the collection-active states (active / payment_plan /
 * legal_action / disputed); settled + written_off are excluded.
 */
async function arrearsHeadline(db: DrizzleDb): Promise<SlotPayload | null> {
  try {
    const rows = await db
      .select({ value: count() })
      .from(arrearsCases)
      .where(
        sql`${arrearsCases.status} in ('active','payment_plan','legal_action','disputed')`,
      );
    return {
      metric: 'open_arrears_cases',
      value: toNumber(rows[0]?.value),
      unit: 'cases',
    };
  } catch {
    return null;
  }
}

/**
 * Occupancy — occupied units / (occupied + vacant) units, as a percent.
 * Soft-deleted units are excluded. `reserved` / `under_maintenance` /
 * `not_available` are treated as neither occupied nor vacant-available
 * so the ratio tracks realised tenancy, not theoretical capacity.
 */
async function occupancyByClass(db: DrizzleDb): Promise<SlotPayload | null> {
  try {
    const rows = (await db
      .select({ status: units.status, value: count() })
      .from(units)
      .where(isNull(units.deletedAt))
      .groupBy(units.status)) as ReadonlyArray<{
      status: string | null;
      value: number | string;
    }>;
    let occupied = 0;
    let vacant = 0;
    for (const r of rows) {
      if (r.status === 'occupied') occupied += toNumber(r.value);
      else if (r.status === 'vacant') vacant += toNumber(r.value);
    }
    return {
      metric: 'occupancy_rate',
      value: pct(occupied, occupied + vacant),
      unit: '%',
    };
  } catch {
    return null;
  }
}

/**
 * Vendor reopen rate — work orders currently in the `reopened` state as
 * a percent of all non-deleted work orders. A direct proxy for vendor
 * quality: a job reopened is a job that didn't fix the problem.
 */
async function vendorReopenRate(db: DrizzleDb): Promise<SlotPayload | null> {
  try {
    const [totalRows, reopenedRows] = await Promise.all([
      db
        .select({ value: count() })
        .from(workOrders)
        .where(isNull(workOrders.deletedAt)),
      db
        .select({ value: count() })
        .from(workOrders)
        .where(
          and(eq(workOrders.status, 'reopened'), isNull(workOrders.deletedAt)),
        ),
    ]);
    return {
      metric: 'vendor_reopen_rate',
      value: pct(toNumber(reopenedRows[0]?.value), toNumber(totalRows[0]?.value)),
      unit: '%',
    };
  } catch {
    return null;
  }
}

/**
 * Tenant sentiment index — mean of `current_sentiment` across all
 * friction fingerprints, scaled from the stored [0,1] decimal to a
 * 0–100 index. Fingerprints without a current sentiment are skipped.
 */
async function sentimentIndex(db: DrizzleDb): Promise<SlotPayload | null> {
  try {
    const rows = (await db
      .select({ value: avg(frictionFingerprints.currentSentiment) })
      .from(frictionFingerprints)
      .where(isNotNull(frictionFingerprints.currentSentiment))) as ReadonlyArray<{
      value: string | number | null;
    }>;
    const mean = rows[0]?.value;
    if (mean === null || mean === undefined) {
      return { metric: 'sentiment_index', value: 0, unit: '/100' };
    }
    const scaled = Math.round(toNumber(mean) * 1000) / 10; // 0..1 → 0..100, 1dp
    return { metric: 'sentiment_index', value: scaled, unit: '/100' };
  } catch {
    return null;
  }
}

/**
 * Renewal rate — accepted renewals as a percent of DECIDED renewals
 * (accepted + declined). Only decided outcomes count toward the rate so
 * in-flight (`window_opened` / `proposed`) leases don't drag it down.
 */
async function renewalRate(db: DrizzleDb): Promise<SlotPayload | null> {
  try {
    const rows = (await db
      .select({ renewalStatus: leases.renewalStatus, value: count() })
      .from(leases)
      .where(
        sql`${leases.renewalStatus} in ('accepted','declined')`,
      )
      .groupBy(leases.renewalStatus)) as ReadonlyArray<{
      renewalStatus: string | null;
      value: number | string;
    }>;
    let accepted = 0;
    let decided = 0;
    for (const r of rows) {
      const n = toNumber(r.value);
      decided += n;
      if (r.renewalStatus === 'accepted') accepted += n;
    }
    return { metric: 'renewal_rate', value: pct(accepted, decided), unit: '%' };
  } catch {
    return null;
  }
}

/**
 * Maintenance time-to-close — mean wall-clock days between a work
 * order's creation and completion, across completed/verified work
 * orders that carry a `completed_at`. Computed in Postgres via
 * EXTRACT(EPOCH …) so the average is over real durations, not a
 * client-side reduce.
 */
async function maintenanceTtc(db: DrizzleDb): Promise<SlotPayload | null> {
  try {
    const rows = (await db
      .select({
        value: sql<string | null>`avg(extract(epoch from (${workOrders.completedAt} - ${workOrders.createdAt})))`,
      })
      .from(workOrders)
      .where(
        and(isNotNull(workOrders.completedAt), isNull(workOrders.deletedAt)),
      )) as ReadonlyArray<{ value: string | number | null }>;
    const avgSeconds = rows[0]?.value;
    if (avgSeconds === null || avgSeconds === undefined) {
      return { metric: 'maintenance_ttc', value: 0, unit: 'days' };
    }
    const days = Math.round((toNumber(avgSeconds) / 86_400) * 10) / 10;
    return { metric: 'maintenance_ttc', value: days, unit: 'days' };
  } catch {
    return null;
  }
}

const SLOT_COMPUTERS: Record<
  IndustrySlotKey,
  (db: DrizzleDb) => Promise<SlotPayload | null>
> = {
  'arrears-by-jurisdiction': arrearsHeadline,
  'occupancy-by-class': occupancyByClass,
  'vendor-reopen-rate': vendorReopenRate,
  'sentiment-index': sentimentIndex,
  'renewal-rate': renewalRate,
  'maintenance-ttc': maintenanceTtc,
};

/**
 * Compute a single industry slot. Returns `null` on an unknown slot key
 * OR a hard DB failure — the caller distinguishes the two (404 vs 503).
 */
export async function computeIndustrySlot(
  db: DrizzleDb,
  slot: string,
): Promise<SlotPayload | null> {
  if (!isIndustrySlotKey(slot)) return null;
  return SLOT_COMPUTERS[slot](db);
}

/**
 * Compute every industry slot in parallel. Slots that fail are returned
 * as `null` in the map so the caller can mark them degraded individually
 * rather than failing the whole dashboard.
 */
export async function computeAllIndustrySlots(
  db: DrizzleDb,
): Promise<Record<IndustrySlotKey, SlotPayload | null>> {
  const entries = await Promise.all(
    INDUSTRY_SLOT_KEYS.map(
      async (key) => [key, await SLOT_COMPUTERS[key](db)] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<
    IndustrySlotKey,
    SlotPayload | null
  >;
}

export { isIndustrySlotKey };
