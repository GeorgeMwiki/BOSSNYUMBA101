/**
 * Tenant directory adapter — lists the tenants the nightly sweep should
 * process and resolves each tenant's jurisdiction for the constitution
 * verifier.
 *
 * Backed by the canonical `tenants` table:
 *   - `listActiveTenants()` returns every tenant whose `status = 'active'`
 *     or `'trial'` (both run the brain live), newest-first, capped.
 *   - `jurisdictionFor(tenantId)` returns the tenant's ISO-3166-1 alpha-2
 *     `country`, upper-cased, falling back to the platform default when a
 *     tenant predates the country backfill (migration 0034 dropped the
 *     legacy 'KE' default — see tenant.schema.ts).
 *
 * The jurisdiction map is loaded once per sweep (in `listActiveTenants`)
 * so `jurisdictionFor` is a synchronous lookup — the cron-handler calls it
 * inside a sync `.map(...)` over deltas and must not await.
 *
 * Pure raw-SQL adapter (same pattern as the sibling consolidation-worker
 * reservoir source) — no compile-time dependency on the Drizzle schema
 * objects, so this module builds without pulling `@bossnyumba/database`
 * schema types into the worker's tsconfig.
 */

import { sql } from 'drizzle-orm';

import type { TenantDirectory } from '../schedule/cron-handler.js';
import type { BrainWorkerLogger } from '../types.js';
import {
  asString,
  clampLimit,
  toRows,
  type DrizzleLikeClient,
} from './shared.js';

/**
 * Platform default jurisdiction. TZ is the launch jurisdiction
 * (see CLAUDE.md — "Tanzania is the starting jurisdiction at launch").
 * Never hard-coded into business logic — this is only the directory's
 * fallback when a tenant row carries no country.
 */
const DEFAULT_JURISDICTION = 'TZ';
const MAX_TENANTS = 10_000;

export interface DirectoryAdapterDeps {
  readonly db: DrizzleLikeClient;
  readonly logger?: BrainWorkerLogger;
}

/**
 * Build a tenant directory over the live `tenants` table. The
 * jurisdiction cache is populated lazily on the first
 * `listActiveTenants()` call and reused by `jurisdictionFor`.
 */
export function createDirectoryAdapter(
  deps: DirectoryAdapterDeps,
): TenantDirectory {
  const jurisdictionByTenant = new Map<string, string>();

  return {
    async listActiveTenants() {
      const lim = clampLimit(MAX_TENANTS, MAX_TENANTS);
      const result = (await deps.db.execute(
        sql`SELECT id, country
            FROM tenants
            WHERE status IN ('active', 'trial')
            ORDER BY created_at DESC
            LIMIT ${lim}`,
      )) as unknown;

      const rows = toRows(result) as ReadonlyArray<{
        id?: unknown;
        country?: unknown;
      }>;

      const tenantIds: string[] = [];
      for (const row of rows) {
        const id = asString(row.id);
        if (!id) continue;
        tenantIds.push(id);
        jurisdictionByTenant.set(id, normaliseJurisdiction(row.country));
      }

      deps.logger?.info?.(
        { activeTenants: tenantIds.length },
        'brain-evolution-worker: tenant directory loaded',
      );
      return tenantIds;
    },

    jurisdictionFor(tenantId) {
      return jurisdictionByTenant.get(tenantId) ?? DEFAULT_JURISDICTION;
    },
  };
}

function normaliseJurisdiction(country: unknown): string {
  const raw = asString(country);
  if (!raw) return DEFAULT_JURISDICTION;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : DEFAULT_JURISDICTION;
}

export { DEFAULT_JURISDICTION, MAX_TENANTS, normaliseJurisdiction };
