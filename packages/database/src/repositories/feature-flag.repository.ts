/**
 * FeatureFlagRepository
 *
 * Backs the DB loader registered into `@bossnyumba/config/feature-flags`.
 *
 * Resolution rule (most-specific-wins):
 *
 *   1. user-scoped row     (flag_key = K, tenant_id = T, user_id = U)
 *   2. tenant-scoped row   (flag_key = K, tenant_id = T, user_id IS NULL)
 *   3. global row          (flag_key = K, tenant_id IS NULL, user_id IS NULL)
 *
 * NULL columns are wildcards. We use a single ORDER BY that ranks rows by
 * specificity and takes the top one, so a missing user-scoped row falls
 * through to a tenant row, which falls through to a global row.
 */

import { and, eq, isNull, or, sql, asc, desc } from 'drizzle-orm';
import type { DatabaseClient } from '../client.js';
import { featureFlags } from '../schemas/index.js';

export interface FeatureFlagLookup {
  enabled: boolean;
  rolloutPercent?: number;
}

export class FeatureFlagRepository {
  constructor(private readonly db: DatabaseClient) {}

  /**
   * Find the most-specific configured row for `flagKey` in the given scope.
   *
   * Returns `null` when no row exists at any scope — callers (the registered
   * loader) should map that to `undefined` so `isEnabled()` can fall through
   * to the static default.
   */
  async findByFlag(
    flagKey: string,
    tenantId?: string,
    userId?: string
  ): Promise<FeatureFlagLookup | null> {
    // Build the scope predicate: include the global row plus any tenant row
    // matching `tenantId` plus any user row matching (tenantId, userId).
    const scopeMatches = or(
      // Global wildcard
      and(isNull(featureFlags.tenantId), isNull(featureFlags.userId)),
      // Tenant-scoped (user wildcard)
      tenantId
        ? and(eq(featureFlags.tenantId, tenantId), isNull(featureFlags.userId))
        : undefined,
      // User-scoped (must have both tenant + user)
      tenantId && userId
        ? and(eq(featureFlags.tenantId, tenantId), eq(featureFlags.userId, userId))
        : undefined
    );

    // Specificity rank: 2 = user, 1 = tenant, 0 = global.
    // Higher rank wins. Use ORDER BY rank DESC, updated_at DESC LIMIT 1 so
    // the most-specific (and most-recently-updated) row is selected.
    const rows = await this.db
      .select({
        enabled: featureFlags.enabled,
        rolloutPercent: featureFlags.rolloutPercent,
        rank: sql<number>`(
          CASE
            WHEN ${featureFlags.userId} IS NOT NULL THEN 2
            WHEN ${featureFlags.tenantId} IS NOT NULL THEN 1
            ELSE 0
          END
        )`.as('rank'),
      })
      .from(featureFlags)
      .where(and(eq(featureFlags.flagKey, flagKey), scopeMatches))
      .orderBy(desc(sql`rank`), desc(featureFlags.updatedAt), asc(featureFlags.id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      enabled: row.enabled,
      ...(row.rolloutPercent != null ? { rolloutPercent: row.rolloutPercent } : {}),
    };
  }
}
