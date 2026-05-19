/**
 * In-memory adapter for EntityStoreRepository.
 *
 * Used by:
 *   - All unit tests in this package
 *   - The MD's startup boot path on a fresh tenant (until the DB migration
 *     has populated the row set; reads return [] safely)
 *
 * Production composition wires a Drizzle-backed adapter against the
 * 0167 migration tables (in @bossnyumba/database service path).
 */

import type {
  Entity,
  EntityAttribute,
  EntityId,
  EntityRelation,
} from '../types/entity.js';
import { RelationDuplicateError } from '../types/errors.js';
import type {
  AttributeInsert,
  EntityStoreRepository,
  FindEntitiesFilter,
  RelationFilter,
} from './port.js';

interface AttributeRow extends EntityAttribute {}

export class InMemoryEntityStoreRepository implements EntityStoreRepository {
  private entities = new Map<EntityId, Entity>();
  private attributes: AttributeRow[] = [];
  private relations: EntityRelation[] = [];

  async insertEntity(entity: Entity): Promise<Entity> {
    if (this.entities.has(entity.id)) {
      throw new Error(`entity id collision: ${entity.id}`);
    }
    this.entities.set(entity.id, entity);
    return entity;
  }

  async getEntity(id: EntityId): Promise<Entity | null> {
    return this.entities.get(id) ?? null;
  }

  async findEntities(filter: FindEntitiesFilter): Promise<ReadonlyArray<Entity>> {
    const includeDeleted = filter.includeDeleted ?? false;
    const out: Entity[] = [];
    for (const e of this.entities.values()) {
      if (!includeDeleted && e.deletedAt) continue;
      if (filter.type && e.type !== filter.type) continue;
      if (filter.scopeOwnerType && e.scopeOwnerType !== filter.scopeOwnerType) continue;
      if (filter.scopeOwnerId && e.scopeOwnerId !== filter.scopeOwnerId) continue;
      if (filter.tenantId && e.tenantId !== filter.tenantId) continue;

      if (filter.attributesEqual && filter.attributesEqual.length > 0) {
        const current = await this.currentAttributes(e.id);
        let allMatch = true;
        for (const req of filter.attributesEqual) {
          const row = current.get(req.key);
          if (!row) { allMatch = false; break; }
          if (!deepEqual(row.value, req.value)) { allMatch = false; break; }
        }
        if (!allMatch) continue;
      }

      out.push(e);
    }
    return out;
  }

  async softDeleteEntity(id: EntityId, deletedAt: string): Promise<void> {
    const existing = this.entities.get(id);
    if (!existing) return;
    this.entities.set(id, { ...existing, deletedAt });
  }

  async insertAttribute(
    input: AttributeInsert,
    createdAt: string,
  ): Promise<EntityAttribute> {
    // Compute next version atomically (single-threaded in JS so this is safe).
    const previous = this.attributes.filter(
      (a) => a.entityId === input.entityId && a.key === input.key,
    );
    const nextVersion = previous.reduce((acc, a) => Math.max(acc, a.version), 0) + 1;
    const row: AttributeRow = {
      entityId: input.entityId,
      key: input.key,
      value: input.value,
      version: nextVersion,
      source: input.source,
      createdAt,
      createdBy: input.createdBy,
    };
    this.attributes.push(row);
    return row;
  }

  async listAttributes(entityId: EntityId): Promise<ReadonlyArray<EntityAttribute>> {
    return this.attributes
      .filter((a) => a.entityId === entityId)
      .slice()
      .sort((a, b) => {
        if (a.key !== b.key) return a.key < b.key ? -1 : 1;
        return a.version - b.version;
      });
  }

  async currentAttributes(
    entityId: EntityId,
  ): Promise<ReadonlyMap<string, EntityAttribute>> {
    const current = new Map<string, EntityAttribute>();
    for (const a of this.attributes) {
      if (a.entityId !== entityId) continue;
      const existing = current.get(a.key);
      if (!existing || existing.version < a.version) {
        current.set(a.key, a);
      }
    }
    return current;
  }

  async updateAttributeSource(
    entityId: EntityId,
    key: string,
    version: number,
    source: EntityAttribute['source'],
  ): Promise<EntityAttribute | null> {
    const idx = this.attributes.findIndex(
      (a) => a.entityId === entityId && a.key === key && a.version === version,
    );
    if (idx < 0) return null;
    const updated: AttributeRow = { ...this.attributes[idx]!, source };
    this.attributes[idx] = updated;
    return updated;
  }

  async insertRelation(relation: EntityRelation): Promise<EntityRelation> {
    const collide = this.relations.some(
      (r) =>
        r.fromId === relation.fromId &&
        r.type === relation.type &&
        r.toId === relation.toId,
    );
    if (collide) {
      throw new RelationDuplicateError(relation.fromId, relation.type, relation.toId);
    }
    this.relations.push(relation);
    return relation;
  }

  async findRelations(filter: RelationFilter): Promise<ReadonlyArray<EntityRelation>> {
    return this.relations.filter((r) => {
      if (filter.fromId && r.fromId !== filter.fromId) return false;
      if (filter.toId && r.toId !== filter.toId) return false;
      if (filter.type && r.type !== filter.type) return false;
      return true;
    });
  }

  async deleteRelation(
    fromId: EntityId,
    type: string,
    toId: EntityId,
  ): Promise<void> {
    this.relations = this.relations.filter(
      (r) => !(r.fromId === fromId && r.type === type && r.toId === toId),
    );
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}
