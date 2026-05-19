/**
 * EntityStoreService — the universal CRUD surface the MD calls when it
 * wants to create / read / link any entity.
 *
 * Operations:
 *   - createEntity     : create a new entity (atomic with its initial
 *                        attribute bag); validates against the registered
 *                        type schema and enforces scope.
 *   - addAttribute     : append a versioned attribute. Returns the new
 *                        row including its assigned `version`.
 *   - getEntity        : load an entity + its CURRENT attribute snapshot.
 *   - findEntities     : query by type / scope / attribute equality.
 *   - linkEntities     : create a typed relation (idempotent on (from,
 *                        type, to); duplicate raises RelationDuplicateError).
 *   - applyProvenance  : retroactively attach research provenance to an
 *                        existing attribute version (e.g. the MD ran web
 *                        research after the value was written manually).
 *
 * Constructor deps:
 *   - repository : EntityStoreRepository port
 *   - registry   : EntityTypeRegistry — built-ins + DB-loaded extensions
 *   - now        : injectable clock for deterministic tests
 *   - idFactory  : injectable UUID/ULID generator
 */

import type {
  Entity,
  EntityAttribute,
  EntityId,
  EntityRelation,
} from '../types/entity.js';
import { EntityNotFoundError, TenantScopeMisuseError } from '../types/errors.js';
import type { ProvenanceSource } from '../types/provenance.js';
import { validateProvenance } from '../types/provenance.js';
import {
  enforceScope,
  type CallerPrincipal,
  type EntityScope,
} from '../types/scope.js';
import type { EntityTypeRegistry } from '../registry/registry.js';
import type {
  AttributeInsert,
  EntityStoreRepository,
  FindEntitiesFilter,
  RelationFilter,
} from '../repository/port.js';

export interface CreateEntityArgs {
  readonly type: string;
  readonly scope: EntityScope;
  /** Required iff scope.ownerType === 'tenant'. */
  readonly tenantId?: string;
  readonly createdBy: string;
  readonly source: ProvenanceSource;
  /** Initial attribute bag (validated against the registered Zod schema). */
  readonly attributes: Record<string, unknown>;
  readonly principal?: CallerPrincipal;
}

export interface AddAttributeArgs {
  readonly entityId: EntityId;
  readonly key: string;
  readonly value: unknown;
  readonly source: ProvenanceSource;
  readonly createdBy?: string;
  readonly principal?: CallerPrincipal;
}

export interface LinkEntitiesArgs {
  readonly fromId: EntityId;
  readonly toId: EntityId;
  readonly type: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy: string;
  readonly principal?: CallerPrincipal;
}

export interface ApplyProvenanceArgs {
  readonly entityId: EntityId;
  readonly key: string;
  /** If omitted, applies to the LATEST version. */
  readonly version?: number;
  readonly source: ProvenanceSource;
  readonly principal?: CallerPrincipal;
}

export interface EntitySnapshot {
  readonly entity: Entity;
  readonly attributes: Record<string, EntityAttribute>;
}

export interface EntityStoreService {
  createEntity(args: CreateEntityArgs): Promise<EntitySnapshot>;
  addAttribute(args: AddAttributeArgs): Promise<EntityAttribute>;
  getEntity(
    id: EntityId,
    principal?: CallerPrincipal,
  ): Promise<EntitySnapshot | null>;
  findEntities(
    filter: FindEntitiesFilter,
    principal?: CallerPrincipal,
  ): Promise<ReadonlyArray<Entity>>;
  linkEntities(args: LinkEntitiesArgs): Promise<EntityRelation>;
  applyProvenance(args: ApplyProvenanceArgs): Promise<EntityAttribute>;
  /** Soft delete — sets deletedAt. Find queries exclude by default. */
  softDelete(id: EntityId, principal?: CallerPrincipal): Promise<void>;
  /** Convenience: traverse outgoing relations for the entity. */
  outgoingRelations(
    fromId: EntityId,
    type?: string,
  ): Promise<ReadonlyArray<EntityRelation>>;
  incomingRelations(
    toId: EntityId,
    type?: string,
  ): Promise<ReadonlyArray<EntityRelation>>;
}

export interface EntityStoreServiceDeps {
  readonly repository: EntityStoreRepository;
  readonly registry: EntityTypeRegistry;
  readonly now?: () => Date;
  readonly idFactory?: () => string;
}

export function createEntityStoreService(
  deps: EntityStoreServiceDeps,
): EntityStoreService {
  const { repository, registry } = deps;
  const now = deps.now ?? (() => new Date());
  const idFactory = deps.idFactory ?? defaultIdFactory;

  function assertTenantConsistency(scope: EntityScope, tenantId?: string): void {
    if (scope.ownerType === 'tenant') {
      if (!tenantId) {
        throw new TenantScopeMisuseError(
          'tenantId required when scope.ownerType === tenant',
        );
      }
      if (tenantId !== scope.ownerId) {
        throw new TenantScopeMisuseError(
          `tenantId (${tenantId}) must equal scope.ownerId (${scope.ownerId})`,
        );
      }
    } else {
      // platform scope — tenantId MUST be omitted
      if (tenantId) {
        throw new TenantScopeMisuseError(
          'tenantId must be omitted when scope.ownerType === platform',
        );
      }
    }
  }

  return {
    async createEntity(args) {
      // 1. Provenance + registry validation FIRST so we never half-create.
      validateProvenance(args.source);
      registry.assertScopeFits(args.type, args.scope.ownerType);
      registry.validate(args.type, args.attributes);
      assertTenantConsistency(args.scope, args.tenantId);

      // 2. Scope enforcement against the caller principal (if supplied).
      if (args.principal) enforceScope(args.principal, args.scope);

      // 3. Mint header.
      const id = idFactory();
      const ts = now().toISOString();
      const entityRow: Entity = {
        id,
        type: args.type,
        scopeOwnerType: args.scope.ownerType,
        scopeOwnerId: args.scope.ownerId,
        ...(args.scope.ownerType === 'tenant'
          ? { tenantId: args.tenantId as string }
          : {}),
        createdBy: args.createdBy,
        createdAt: ts,
        sourceProvenance: args.source,
        deletedAt: null,
      };
      await repository.insertEntity(entityRow);

      // 4. Write every initial attribute as version 1.
      const attributeRows: EntityAttribute[] = [];
      for (const [key, value] of Object.entries(args.attributes)) {
        const insert: AttributeInsert = {
          entityId: id,
          key,
          value,
          source: args.source,
          createdBy: args.createdBy,
        };
        const row = await repository.insertAttribute(insert, ts);
        attributeRows.push(row);
      }

      const attributes: Record<string, EntityAttribute> = {};
      for (const a of attributeRows) attributes[a.key] = a;

      return { entity: entityRow, attributes };
    },

    async addAttribute(args) {
      validateProvenance(args.source);
      const entity = await repository.getEntity(args.entityId);
      if (!entity) throw new EntityNotFoundError(args.entityId);
      if (args.principal) {
        enforceScope(args.principal, {
          ownerType: entity.scopeOwnerType,
          ownerId: entity.scopeOwnerId,
        });
      }

      // Validate the resulting bag against the type schema. We project the
      // current snapshot and overlay the new key so we catch type-mismatch
      // on partial updates (e.g. attribute that should be a number gets
      // overwritten with a string).
      const current = await repository.currentAttributes(args.entityId);
      const projected: Record<string, unknown> = {};
      for (const [k, v] of current.entries()) projected[k] = v.value;
      projected[args.key] = args.value;
      registry.validate(entity.type, projected);

      const ts = now().toISOString();
      return repository.insertAttribute(
        {
          entityId: args.entityId,
          key: args.key,
          value: args.value,
          source: args.source,
          createdBy: args.createdBy ?? entity.createdBy,
        },
        ts,
      );
    },

    async getEntity(id, principal) {
      const entity = await repository.getEntity(id);
      if (!entity) return null;
      if (principal) {
        enforceScope(principal, {
          ownerType: entity.scopeOwnerType,
          ownerId: entity.scopeOwnerId,
        });
      }
      const current = await repository.currentAttributes(id);
      const attributes: Record<string, EntityAttribute> = {};
      for (const [k, v] of current.entries()) attributes[k] = v;
      return { entity, attributes };
    },

    async findEntities(filter, principal) {
      // If the caller is a tenant-user, force a tenantId narrowing — they
      // simply CANNOT see other tenants. A tenant-user with no tenantId is
      // a misconfigured caller; we fall through to the principal check
      // below which will reject every row.
      let narrowed: FindEntitiesFilter = filter;
      if (principal && principal.role === 'tenant-user' && principal.tenantId) {
        narrowed = {
          ...filter,
          scopeOwnerType: 'tenant',
          scopeOwnerId: principal.tenantId,
          tenantId: principal.tenantId,
        };
      }

      const rows = await repository.findEntities(narrowed);

      if (!principal) return rows;
      // Final scope check per row (defence-in-depth against the in-memory
      // repo missing a filter clause).
      return rows.filter((e) => {
        try {
          enforceScope(principal, {
            ownerType: e.scopeOwnerType,
            ownerId: e.scopeOwnerId,
          });
          return true;
        } catch {
          return false;
        }
      });
    },

    async linkEntities(args) {
      const from = await repository.getEntity(args.fromId);
      const to = await repository.getEntity(args.toId);
      if (!from) throw new EntityNotFoundError(args.fromId);
      if (!to) throw new EntityNotFoundError(args.toId);

      if (args.principal) {
        enforceScope(args.principal, {
          ownerType: from.scopeOwnerType,
          ownerId: from.scopeOwnerId,
        });
        enforceScope(args.principal, {
          ownerType: to.scopeOwnerType,
          ownerId: to.scopeOwnerId,
        });
      }

      // Cross-scope leak guard: a tenant-scoped entity cannot point at a
      // different tenant's entity. Platform → tenant relations ARE allowed
      // (e.g. customer-owner [platform] -[owns]-> property [tenant]).
      if (
        from.scopeOwnerType === 'tenant' &&
        to.scopeOwnerType === 'tenant' &&
        from.scopeOwnerId !== to.scopeOwnerId
      ) {
        throw new TenantScopeMisuseError(
          `cross-tenant relation rejected: ${from.id}(${from.scopeOwnerId}) -[${args.type}]-> ${to.id}(${to.scopeOwnerId})`,
        );
      }

      const ts = now().toISOString();
      const relation: EntityRelation = {
        fromId: args.fromId,
        toId: args.toId,
        type: args.type,
        metadata: args.metadata ?? {},
        createdAt: ts,
        createdBy: args.createdBy,
      };
      return repository.insertRelation(relation);
    },

    async applyProvenance(args) {
      validateProvenance(args.source);
      const entity = await repository.getEntity(args.entityId);
      if (!entity) throw new EntityNotFoundError(args.entityId);
      if (args.principal) {
        enforceScope(args.principal, {
          ownerType: entity.scopeOwnerType,
          ownerId: entity.scopeOwnerId,
        });
      }

      const all = await repository.listAttributes(args.entityId);
      const ofKey = all.filter((a) => a.key === args.key);
      if (ofKey.length === 0) {
        throw new EntityNotFoundError(`${args.entityId}/${args.key}` as EntityId);
      }
      const targetVersion =
        args.version ?? Math.max(...ofKey.map((a) => a.version));
      const updated = await repository.updateAttributeSource(
        args.entityId,
        args.key,
        targetVersion,
        args.source,
      );
      if (!updated) {
        throw new EntityNotFoundError(
          `${args.entityId}/${args.key}/v${targetVersion}` as EntityId,
        );
      }
      return updated;
    },

    async softDelete(id, principal) {
      const entity = await repository.getEntity(id);
      if (!entity) throw new EntityNotFoundError(id);
      if (principal) {
        enforceScope(principal, {
          ownerType: entity.scopeOwnerType,
          ownerId: entity.scopeOwnerId,
        });
      }
      await repository.softDeleteEntity(id, now().toISOString());
    },

    async outgoingRelations(fromId, type) {
      const filter: RelationFilter = type ? { fromId, type } : { fromId };
      return repository.findRelations(filter);
    },

    async incomingRelations(toId, type) {
      const filter: RelationFilter = type ? { toId, type } : { toId };
      return repository.findRelations(filter);
    },
  };
}

// ---- helpers ----

function defaultIdFactory(): string {
  // Crypto-strong UUIDv4 — uses globalThis.crypto in Node 19+, browsers,
  // and Bun. Avoids `node:crypto` import so the module is isomorphic.
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback (tests / older runtimes): RFC4122-shaped pseudo-UUID. The
  // production DB adapter never reaches this path because Node 20+ ships
  // crypto.randomUUID.
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
    if (i === 7 || i === 11 || i === 15 || i === 19) out += '-';
  }
  return out;
}
