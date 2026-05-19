/**
 * Universal entity store — Drizzle schemas for migrations 0167 / 0168.
 *
 * Tables:
 *   - entities             : header row per entity
 *   - entity_attributes    : versioned JSONB attribute bag
 *   - entity_relations     : typed edges between entities
 *   - entity_types         : registry of allowed type strings + schema handle
 *
 * The package @bossnyumba/entity-store ships the business logic; this
 * file is purely the Drizzle mirror so consumers can query through the
 * typed client without hand-rolling raw SQL.
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  primaryKey,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────────────────
// entity_types — registry. Platform-wide; no tenant_id.
// ─────────────────────────────────────────────────────────────────────────
export const entityTypes = pgTable('entity_types', {
  name: text('name').primaryKey(),
  schemaZod: text('schema_zod').notNull(),
  jurisdictionAware: boolean('jurisdiction_aware').notNull().default(false),
  scope: text('scope').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// entities — header rows.
// ─────────────────────────────────────────────────────────────────────────
export const entities = pgTable(
  'entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(),
    scopeOwnerType: text('scope_owner_type').notNull(),
    scopeOwnerId: uuid('scope_owner_id').notNull(),
    tenantId: uuid('tenant_id'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    sourceProvenance: jsonb('source_provenance').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    typeIdx: index('idx_entities_type').on(t.type),
    tenantIdx: index('idx_entities_tenant_id').on(t.tenantId),
    scopeOwnerIdx: index('idx_entities_scope_owner').on(
      t.scopeOwnerType,
      t.scopeOwnerId,
    ),
    typeTenantIdx: index('idx_entities_type_tenant').on(t.type, t.tenantId),
    activeIdx: index('idx_entities_active').on(t.type),
    // Mirror of the DB-level CHECK constraint for documentation; Drizzle
    // doesn't enforce CHECKs in the application layer.
    tenantConsistency: check(
      'entities_tenant_consistency',
      sql`(${t.scopeOwnerType} = 'platform' AND ${t.tenantId} IS NULL) OR (${t.scopeOwnerType} = 'tenant' AND ${t.tenantId} IS NOT NULL AND ${t.tenantId} = ${t.scopeOwnerId})`,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// entity_attributes — versioned bag.
// ─────────────────────────────────────────────────────────────────────────
export const entityAttributes = pgTable(
  'entity_attributes',
  {
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    version: integer('version').notNull(),
    source: jsonb('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid('created_by').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.entityId, t.key, t.version] }),
    entityIdx: index('idx_entity_attributes_entity').on(t.entityId),
    keyIdx: index('idx_entity_attributes_key').on(t.key),
    currentIdx: index('idx_entity_attributes_current').on(
      t.entityId,
      t.key,
      t.version,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// entity_relations — typed edges.
// ─────────────────────────────────────────────────────────────────────────
export const entityRelations = pgTable(
  'entity_relations',
  {
    fromId: uuid('from_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    toId: uuid('to_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid('created_by').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.fromId, t.type, t.toId] }),
    fromIdx: index('idx_entity_relations_from').on(t.fromId),
    toIdx: index('idx_entity_relations_to').on(t.toId),
    typeIdx: index('idx_entity_relations_type').on(t.type),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// Drizzle relations declarations.
// ─────────────────────────────────────────────────────────────────────────
export const entitiesRelations = relations(entities, ({ many }) => ({
  attributes: many(entityAttributes),
  outgoing: many(entityRelations, { relationName: 'from_relation' }),
  incoming: many(entityRelations, { relationName: 'to_relation' }),
}));

export const entityAttributesRelations = relations(
  entityAttributes,
  ({ one }) => ({
    entity: one(entities, {
      fields: [entityAttributes.entityId],
      references: [entities.id],
    }),
  }),
);

export const entityRelationsRelations = relations(
  entityRelations,
  ({ one }) => ({
    from: one(entities, {
      fields: [entityRelations.fromId],
      references: [entities.id],
      relationName: 'from_relation',
    }),
    to: one(entities, {
      fields: [entityRelations.toId],
      references: [entities.id],
      relationName: 'to_relation',
    }),
  }),
);
