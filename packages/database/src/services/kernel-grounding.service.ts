/**
 * Kernel grounding service — Drizzle-backed
 * `GroundingFactsProvider` implementation. The kernel pre-fetches
 * these facts at step 5b and renders them into the system prompt so
 * the sensor answers from real tenant state, not training memory.
 *
 * Catalogue (today): occupancy, vacant unit count, active leases
 * count, open work-orders, lease expiring count. Each fact is
 * tenant-scoped and read-only; cheap to compute (single COUNT
 * queries with covering indexes).
 *
 * The fact selection is keyword-driven so unrelated questions don't
 * trigger expensive queries. Empty result is fine — the kernel
 * simply skips the grounding fragment.
 */

import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { units } from '../schemas/property.schema.js';
import { leases } from '../schemas/lease.schema.js';
import { workOrders } from '../schemas/maintenance.schema.js';
import type { DatabaseClient } from '../client.js';

// Duck-typed copy of the kernel's port — keep in sync with
// @bossnyumba/central-intelligence/kernel/kernel-types.ts.
export interface GroundingFactShape {
  readonly id: string;
  readonly label: string;
  readonly value: string | number;
  readonly unit?: 'pct' | 'count' | 'currency-tzs' | 'currency-kes' | 'days';
  readonly source: string;
  readonly asOf: string;
}

export interface GroundingFactsProviderShape {
  fetch(args: {
    readonly userMessage: string;
    readonly tier: string;
    readonly limit: number;
  }): Promise<ReadonlyArray<GroundingFactShape>>;
}

export interface KernelGroundingDeps {
  readonly tenantId: string | null;
}

const KEYWORD_TRIGGERS: ReadonlyArray<{ kind: GroundingKind; re: RegExp }> = [
  { kind: 'occupancy',         re: /\boccupanc\w+|\bvacanc\w+|\bvacant\b|\bempty\s+unit/i },
  { kind: 'active-leases',     re: /\blease\w*|\btenant\w*|\bresidents?\b/i },
  { kind: 'open-work-orders',  re: /\bwork[- ]?order\w*|\bmaintenance\b|\brepair\w*/i },
  { kind: 'lease-expiring',    re: /\brenew\w*|\bexpir\w*|\bend\s+of\s+lease/i },
];

type GroundingKind = 'occupancy' | 'active-leases' | 'open-work-orders' | 'lease-expiring';

export function createKernelGroundingProvider(
  db: DatabaseClient,
  deps: KernelGroundingDeps,
): GroundingFactsProviderShape {
  // Platform-tier (no tenantId) gets no grounding from this provider —
  // the DP cohort source is the right channel for industry aggregates.
  return {
    async fetch({ userMessage, limit }) {
      if (!deps.tenantId) return [];

      // Pick the unique kinds that match the message; cap at limit.
      const triggered = new Set<GroundingKind>();
      for (const t of KEYWORD_TRIGGERS) {
        if (t.re.test(userMessage)) triggered.add(t.kind);
        if (triggered.size >= limit) break;
      }
      if (triggered.size === 0) return [];

      const tenantId = deps.tenantId;
      const tasks: Array<Promise<GroundingFactShape | null>> = [];
      for (const kind of triggered) {
        tasks.push(runOne(db, tenantId, kind));
      }
      const results = await Promise.all(tasks);
      return results.filter((r): r is GroundingFactShape => r !== null);
    },
  };
}

async function runOne(
  db: DatabaseClient,
  tenantId: string,
  kind: GroundingKind,
): Promise<GroundingFactShape | null> {
  try {
    const at = new Date().toISOString();
    switch (kind) {
      case 'occupancy': {
        const [row] = await db
          .select({
            total: sql<number>`COUNT(*)::int`,
            occupied: sql<number>`COUNT(*) FILTER (WHERE ${units.status} = 'occupied')::int`,
          })
          .from(units)
          .where(eq(units.tenantId, tenantId));
        const total = Number(row?.total ?? 0);
        const occupied = Number(row?.occupied ?? 0);
        if (total === 0) return null;
        return {
          id: 'gf:occupancy',
          label: 'Occupancy',
          value: occupied / total,
          unit: 'pct',
          source: 'units',
          asOf: at,
        };
      }
      case 'active-leases': {
        const [row] = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(leases)
          .where(
            and(
              eq(leases.tenantId, tenantId),
              inArray(leases.status, ['active', 'expiring_soon'] as never[]),
            ),
          );
        return {
          id: 'gf:active-leases',
          label: 'Active leases',
          value: Number(row?.count ?? 0),
          unit: 'count',
          source: 'leases',
          asOf: at,
        };
      }
      case 'open-work-orders': {
        const [row] = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(workOrders)
          .where(
            and(
              eq(workOrders.tenantId, tenantId),
              inArray(
                workOrders.status,
                ['submitted', 'triaged', 'assigned', 'scheduled', 'in_progress', 'pending_parts'] as never[],
              ),
            ),
          );
        return {
          id: 'gf:open-work-orders',
          label: 'Open work orders',
          value: Number(row?.count ?? 0),
          unit: 'count',
          source: 'work_orders',
          asOf: at,
        };
      }
      case 'lease-expiring': {
        const [row] = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(leases)
          .where(
            and(
              eq(leases.tenantId, tenantId),
              eq(leases.status, 'expiring_soon' as never),
              gte(leases.endDate, new Date()),
            ),
          );
        return {
          id: 'gf:lease-expiring',
          label: 'Leases expiring within 30 days',
          value: Number(row?.count ?? 0),
          unit: 'count',
          source: 'leases',
          asOf: at,
        };
      }
    }
  } catch {
    // Swallow per-fact failures — never break the main thought path.
    return null;
  }
}
