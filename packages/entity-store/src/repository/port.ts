/**
 * Repository port — the surface a service implementation talks to.
 *
 * The substrate ships TWO adapters:
 *   - InMemoryEntityStoreRepository : default for tests + boot before DB
 *   - (DB-backed adapter)            : composed at the api-gateway root,
 *                                     not part of this package (lives in
 *                                     @bossnyumba/database service path
 *                                     once the migrations land).
 *
 * Keeping the port here means the service has no direct dependency on
 * drizzle / postgres-js. The DB adapter implements this interface.
 */

import type {
  Entity,
  EntityAttribute,
  EntityId,
  EntityRelation,
} from '../types/entity.js';

export interface AttributeInsert {
  readonly entityId: EntityId;
  readonly key: string;
  readonly value: unknown;
  readonly source: EntityAttribute['source'];
  readonly createdBy: string;
}

export interface FindEntitiesFilter {
  readonly type?: string;
  readonly scopeOwnerType?: 'platform' | 'tenant';
  readonly scopeOwnerId?: string;
  readonly tenantId?: string;
  readonly includeDeleted?: boolean;
  /** Required key/value attribute match (subset). */
  readonly attributesEqual?: ReadonlyArray<{ key: string; value: unknown }>;
}

export interface RelationFilter {
  readonly fromId?: EntityId;
  readonly toId?: EntityId;
  readonly type?: string;
}

export interface EntityStoreRepository {
  // ----- entities -----
  insertEntity(entity: Entity): Promise<Entity>;
  getEntity(id: EntityId): Promise<Entity | null>;
  findEntities(filter: FindEntitiesFilter): Promise<ReadonlyArray<Entity>>;
  softDeleteEntity(id: EntityId, deletedAt: string): Promise<void>;

  // ----- attributes (versioned) -----
  insertAttribute(input: AttributeInsert, createdAt: string): Promise<EntityAttribute>;
  listAttributes(entityId: EntityId): Promise<ReadonlyArray<EntityAttribute>>;
  /** Current value per key (max(version) per (entity_id, key)). */
  currentAttributes(entityId: EntityId): Promise<ReadonlyMap<string, EntityAttribute>>;
  /**
   * Replace the source envelope on a specific (entityId, key, version)
   * row. Used by `applyProvenance` when the MD adds research provenance
   * to an attribute after the fact.
   */
  updateAttributeSource(
    entityId: EntityId,
    key: string,
    version: number,
    source: EntityAttribute['source'],
  ): Promise<EntityAttribute | null>;

  // ----- relations -----
  insertRelation(relation: EntityRelation): Promise<EntityRelation>;
  findRelations(filter: RelationFilter): Promise<ReadonlyArray<EntityRelation>>;
  deleteRelation(
    fromId: EntityId,
    type: string,
    toId: EntityId,
  ): Promise<void>;
}
