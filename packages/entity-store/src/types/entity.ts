/**
 * Core entity types — the polymorphic substrate types every higher
 * concept (employee, lease, vendor, ...) sits on top of.
 *
 * Storage shape:
 *   entities             one row per entity, addressed by (id)
 *   entity_attributes    one row per (entity_id, key, version) — versioned
 *   entity_relations     one row per (from_id, type, to_id)
 *   entity_types         registry of allowed `type` strings + Zod schema
 *
 * The substrate is intentionally generic: attributes live as JSONB so the
 * MD can write a new entity type at runtime without a migration. The
 * `entity_types` registry validates the bag and gives us a stable handle
 * for jurisdiction-aware policy.
 */

import type { ProvenanceSource } from './provenance.js';
import type { ScopeOwnerType, EntityScope } from './scope.js';

/** Stable string identifier for an entity. */
export type EntityId = string;

/**
 * An entity row — the "header" record. Attributes live in
 * `entity_attributes`. `type` references the registry.
 */
export interface Entity {
  readonly id: EntityId;
  readonly type: string;
  readonly scopeOwnerType: ScopeOwnerType;
  readonly scopeOwnerId: string;
  /** REQUIRED iff scopeOwnerType === 'tenant'. */
  readonly tenantId?: string;
  readonly createdBy: string;
  readonly createdAt: string; // ISO-8601
  /** The provenance source for the create event itself. */
  readonly sourceProvenance: ProvenanceSource;
  /** ISO-8601; null until soft-deleted. */
  readonly deletedAt?: string | null;
}

/**
 * One versioned attribute. (entity_id, key, version) is the natural key.
 * The CURRENT value is the row with the highest version per (entity_id,
 * key). Older rows are retained for audit and "what did this look like
 * yesterday?" queries.
 */
export interface EntityAttribute {
  readonly entityId: EntityId;
  readonly key: string;
  /** Drizzle-JSONB shape — anything serialisable. */
  readonly value: unknown;
  /** Monotonic per (entity_id, key); starts at 1. */
  readonly version: number;
  readonly source: ProvenanceSource;
  readonly createdAt: string; // ISO-8601
  readonly createdBy: string;
}

/**
 * Typed edge between two entities. (from_id, type, to_id) is unique;
 * carrying metadata lets us decorate the edge ("primary_address",
 * "weight: 0.8", "ownership_pct: 25").
 */
export interface EntityRelation {
  readonly fromId: EntityId;
  readonly type: string;
  readonly toId: EntityId;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string; // ISO-8601
  readonly createdBy: string;
}

/**
 * Registry row — defines an entity type's permitted attribute schema.
 *
 * `schemaZod` is a stringified Zod expression (JSON-safe). The runtime
 * registry compiles it back via `parseRegisteredSchema`.
 *
 * `jurisdictionAware` flags types whose attributes vary by tenant
 * country / region. The MD's prompt-composition layer reads this to
 * decide whether to ask "where is this lease located?" before writing.
 *
 * `scope` constrains where a type may exist:
 *   - 'platform'    — only platform-scope rows allowed (e.g. internal-staff)
 *   - 'tenant'      — only tenant-scope rows allowed (e.g. lease, property)
 *   - 'both'        — either scope allowed (e.g. vendor, lead, ticket)
 */
export interface EntityType {
  readonly name: string;
  /** JSON-encoded Zod schema for the attribute bag. */
  readonly schemaZod: string;
  readonly jurisdictionAware: boolean;
  readonly scope: 'platform' | 'tenant' | 'both';
  readonly description: string;
  readonly createdAt: string; // ISO-8601
}

// Re-export the dependent types so consumers can `import { Entity,
// EntityScope, ... }` from a single path.
export type { EntityScope, ScopeOwnerType };
