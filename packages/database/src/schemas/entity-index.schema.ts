/**
 * Entity Index + Cross References — Wave COMPANY-BRAIN (migration 0286).
 *
 * Ported from Borjie entity-index.schema.ts.
 *
 * Companion to:
 *   - packages/database/src/migrations/0286_entity_index.sql
 *   - services/api-gateway/src/services/knowledge-graph/grower.ts
 *
 * Two tables back the "entire estate fully legible to AI" contract:
 *
 *   - entity_index            one row per (tenant, kind, id) with a
 *                             semantic embedding + faceted tags +
 *                             summary so the brain can resolve any
 *                             natural-language phrase to a concrete
 *                             entity (a property, lease, tenant,
 *                             maintenance ticket, etc.).
 *   - entity_cross_references typed (source -> target) edges so the
 *                             brain can traverse the graph in one hop
 *                             ("trace this complaint to the unit it
 *                              concerns").
 *
 * Tenant-scoped via the canonical `app.current_tenant_id` GUC.
 * RLS is FORCE-enabled on both tables per CLAUDE.md hard rule.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  numeric,
  index,
  uniqueIndex,
  primaryKey,
  customType,
} from 'drizzle-orm/pg-core';

const vector = (dim: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dim})`;
    },
    toDriver(value) {
      return `[${value.join(',')}]`;
    },
    fromDriver(value) {
      const inner = String(value).replace(/^\[|\]$/g, '');
      return inner
        .split(',')
        .filter(Boolean)
        .map((n) => Number(n));
    },
  });

/** OpenAI text-embedding-3-small dimensionality. */
export const ENTITY_EMBEDDING_DIM = 1536;

export const ENTITY_LIFECYCLE_STAGES = [
  'draft',
  'active',
  'dormant',
  'archived',
  'deleted',
] as const;
export type EntityLifecycleStage = (typeof ENTITY_LIFECYCLE_STAGES)[number];

export const ENTITY_CROSS_REF_RELATIONSHIPS = [
  'parent',
  'child',
  'related',
  'duplicate',
  'depends_on',
  'supersedes',
] as const;
export type EntityCrossRefRelationship =
  (typeof ENTITY_CROSS_REF_RELATIONSHIPS)[number];

export const entityIndex = pgTable(
  'entity_index',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    entityKind: text('entity_kind').notNull(),
    entityId: text('entity_id').notNull(),
    displayName: text('display_name').notNull(),
    embedding: vector(ENTITY_EMBEDDING_DIM)('embedding'),
    tags: text('tags').array().notNull().default([]),
    summary: text('summary').notNull().default(''),
    lifecycleStage: text('lifecycle_stage').notNull().default('active'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    naturalKeyIdx: uniqueIndex('entity_index_natural_key_idx').on(
      table.tenantId,
      table.entityKind,
      table.entityId,
    ),
    recentIdx: index('entity_index_recent_idx').on(
      table.tenantId,
      table.entityKind,
      table.refreshedAt,
    ),
    tagsGinIdx: index('entity_index_tags_gin_idx').on(table.tags),
  }),
);

export type EntityIndexRow = typeof entityIndex.$inferSelect;
export type NewEntityIndexRow = typeof entityIndex.$inferInsert;

export const entityCrossReferences = pgTable(
  'entity_cross_references',
  {
    tenantId: text('tenant_id').notNull(),
    sourceKind: text('source_kind').notNull(),
    sourceId: text('source_id').notNull(),
    targetKind: text('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    relationship: text('relationship').notNull(),
    confidence: numeric('confidence', { precision: 4, scale: 3 })
      .notNull()
      .default('1.000'),
    derivedAt: timestamp('derived_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    derivationSource: text('derivation_source').notNull().default(''),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (table) => ({
    pk: primaryKey({
      columns: [
        table.tenantId,
        table.sourceKind,
        table.sourceId,
        table.targetKind,
        table.targetId,
        table.relationship,
      ],
    }),
    forwardIdx: index('entity_cross_references_forward_idx').on(
      table.tenantId,
      table.sourceKind,
      table.sourceId,
    ),
    reverseIdx: index('entity_cross_references_reverse_idx').on(
      table.tenantId,
      table.targetKind,
      table.targetId,
    ),
    relationshipIdx: index('entity_cross_references_relationship_idx').on(
      table.tenantId,
      table.relationship,
      table.sourceKind,
    ),
  }),
);

export type EntityCrossReferenceRow = typeof entityCrossReferences.$inferSelect;
export type NewEntityCrossReferenceRow =
  typeof entityCrossReferences.$inferInsert;
