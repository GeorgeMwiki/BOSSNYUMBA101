/**
 * EntityTypeRegistry — runtime resolver for `entity_types` rows.
 *
 * Two sources of truth:
 *   1. Built-in (TypeScript) — the 14 specs in `built-in-types.ts`. Compiled
 *      at module-load. Always available, even on a fresh DB.
 *   2. DB-backed — additional types the MD writes at runtime via
 *      `createEntityType(...)`. Loaded by the repository at boot.
 *
 * The registry's job is to:
 *   - validate an attribute bag against a type's schema
 *   - enforce the (`type.scope` ↔ `entity.scope_owner_type`) contract
 *   - tell callers whether a type is jurisdiction-aware
 */

import type { ZodTypeAny } from 'zod';
import type { EntityType } from '../types/entity.js';
import {
  AttributeValidationError,
  EntityTypeNotRegisteredError,
  TenantScopeMisuseError,
} from '../types/errors.js';
import type { ScopeOwnerType } from '../types/scope.js';
import { BUILT_IN_TYPES, builtInSchemaFor } from './built-in-types.js';

export interface EntityTypeRegistry {
  /** Return the registered type spec, or throw EntityTypeNotRegisteredError. */
  get(name: string): EntityType;
  /** True iff this registry knows the type. */
  has(name: string): boolean;
  /** List all registered type names. */
  list(): ReadonlyArray<string>;
  /**
   * Validate an attribute bag against the registered schema. Throws
   * AttributeValidationError with a list of human-readable issues.
   */
  validate(typeName: string, attributes: Record<string, unknown>): void;
  /**
   * Verify (type.scope ↔ entity.scope_owner_type) contract. Throws
   * TenantScopeMisuseError on mismatch.
   */
  assertScopeFits(typeName: string, scopeOwnerType: ScopeOwnerType): void;
  /** Register a new runtime type (e.g. one the MD just invented). */
  registerRuntimeType(t: EntityType, schema: ZodTypeAny): void;
}

interface RuntimeEntry {
  readonly spec: EntityType;
  readonly schema: ZodTypeAny;
}

export function createEntityTypeRegistry(
  runtimeRows: ReadonlyArray<{ spec: EntityType; schema: ZodTypeAny }> = [],
): EntityTypeRegistry {
  // Built-in entries — always available.
  const builtInMap = new Map<string, RuntimeEntry>();
  const nowIso = new Date(0).toISOString();
  for (const spec of BUILT_IN_TYPES) {
    builtInMap.set(spec.name, {
      spec: {
        name: spec.name,
        schemaZod: `built-in:${spec.name}`,
        jurisdictionAware: spec.jurisdictionAware,
        scope: spec.scope,
        description: spec.description,
        createdAt: nowIso,
      },
      schema: spec.schema,
    });
  }

  // Runtime-added entries (DB-loaded).
  const runtimeMap = new Map<string, RuntimeEntry>();
  for (const entry of runtimeRows) {
    runtimeMap.set(entry.spec.name, entry);
  }

  function resolve(name: string): RuntimeEntry {
    const entry = runtimeMap.get(name) ?? builtInMap.get(name);
    if (!entry) throw new EntityTypeNotRegisteredError(name);
    return entry;
  }

  return {
    get(name) {
      return resolve(name).spec;
    },

    has(name) {
      return runtimeMap.has(name) || builtInMap.has(name);
    },

    list() {
      return [
        ...new Set([...builtInMap.keys(), ...runtimeMap.keys()]),
      ].sort();
    },

    validate(typeName, attributes) {
      const entry = resolve(typeName);
      const schema = entry.schema ?? builtInSchemaFor(typeName);
      if (!schema) {
        // Schema unresolvable — treat as fatal so callers cannot bypass
        // validation by registering a type without a schema.
        throw new AttributeValidationError(typeName, [
          'no schema available for type',
        ]);
      }
      const result = schema.safeParse(attributes);
      if (!result.success) {
        const issues = result.error.issues.map(
          (i) => `${i.path.join('.') || '<root>'}: ${i.message}`,
        );
        throw new AttributeValidationError(typeName, issues);
      }
    },

    assertScopeFits(typeName, scopeOwnerType) {
      const entry = resolve(typeName);
      const allowed = entry.spec.scope;
      if (allowed === 'both') return;
      if (allowed === scopeOwnerType) return;
      throw new TenantScopeMisuseError(
        `type "${typeName}" requires scope=${allowed} but entity declared scope_owner_type=${scopeOwnerType}`,
      );
    },

    registerRuntimeType(t, schema) {
      runtimeMap.set(t.name, { spec: t, schema });
    },
  };
}
