/**
 * Feature Flags Schema
 *
 * Backs the database loader registered by services into
 * `@bossnyumba/config/feature-flags`. Resolution precedence in the loader
 * follows "most-specific-wins":
 *
 *   user-scoped row     (tenant_id = T, user_id = U)
 *   tenant-scoped row   (tenant_id = T, user_id = NULL)
 *   global row          (tenant_id = NULL, user_id = NULL)
 *
 * NULL columns are treated as wildcards. To keep that semantics enforceable
 * in the schema we use a partial unique index built with COALESCE so a single
 * row exists per (flag_key, scope) combination — including the all-NULL
 * "global" scope which would otherwise be allowed to duplicate under
 * standard NULLs-distinct unique semantics.
 */

import {
  pgTable,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  sql,
} from 'drizzle-orm/pg-core';

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: text('id').primaryKey(),

    /** The flag identifier — matches FeatureFlagName from @bossnyumba/config. */
    flagKey: text('flag_key').notNull(),

    /** NULL = global (applies to every tenant). */
    tenantId: text('tenant_id'),

    /** NULL = tenant-wide (applies to every user in `tenantId`). */
    userId: text('user_id'),

    /** Hard on/off. Combine with `rolloutPercent` for partial rollouts. */
    enabled: boolean('enabled').notNull().default(false),

    /** 0-100 (nullable). When set, treat as a percentage rollout gate. */
    rolloutPercent: integer('rollout_percent'),

    /** Free-form metadata (e.g., owner, ticket link, description). */
    metadata: jsonb('metadata').notNull().default({}),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    flagKeyIdx: index('feature_flags_flag_key_idx').on(table.flagKey),
    tenantIdIdx: index('feature_flags_tenant_id_idx').on(table.tenantId),
    userIdIdx: index('feature_flags_user_id_idx').on(table.userId),
    flagTenantUserIdx: index('feature_flags_flag_tenant_user_idx').on(
      table.flagKey,
      table.tenantId,
      table.userId
    ),
    // COALESCE-based unique index so NULL-scoped rows are still treated as
    // a single wildcard slot per (flag_key, tenant_id, user_id).
    scopeUniqueIdx: uniqueIndex('feature_flags_scope_unique_idx').on(
      table.flagKey,
      sql`COALESCE(${table.tenantId}, '__GLOBAL__')`,
      sql`COALESCE(${table.userId}, '__ALL__')`
    ),
  })
);

export type FeatureFlagRow = typeof featureFlags.$inferSelect;
export type NewFeatureFlagRow = typeof featureFlags.$inferInsert;
