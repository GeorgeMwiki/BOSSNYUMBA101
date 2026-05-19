/**
 * Domain errors for the entity store.
 *
 * Service callers should `instanceof` these classes to drive HTTP / UX
 * branches (404 vs 422 vs 403). Generic `Error` is reserved for
 * unexpected DB failures and is logged + surfaced as 500.
 */

import type { EntityId } from './entity.js';

export class EntityNotFoundError extends Error {
  constructor(public readonly id: EntityId) {
    super(`entity not found: ${id}`);
    this.name = 'EntityNotFoundError';
  }
}

export class EntityTypeNotRegisteredError extends Error {
  constructor(public readonly typeName: string) {
    super(`entity type not registered: ${typeName}`);
    this.name = 'EntityTypeNotRegisteredError';
  }
}

export class AttributeValidationError extends Error {
  constructor(
    public readonly typeName: string,
    public readonly issues: ReadonlyArray<string>,
  ) {
    super(`attribute validation failed for type ${typeName}: ${issues.join('; ')}`);
    this.name = 'AttributeValidationError';
  }
}

export class RelationDuplicateError extends Error {
  constructor(
    public readonly fromId: EntityId,
    public readonly type: string,
    public readonly toId: EntityId,
  ) {
    super(`relation already exists: ${fromId} -[${type}]-> ${toId}`);
    this.name = 'RelationDuplicateError';
  }
}

export class TenantScopeMisuseError extends Error {
  constructor(message: string) {
    super(`tenant scope misuse: ${message}`);
    this.name = 'TenantScopeMisuseError';
  }
}
