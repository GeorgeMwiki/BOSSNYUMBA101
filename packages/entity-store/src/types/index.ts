/**
 * Public type surface for @bossnyumba/entity-store.
 *
 * Consumers should import from here (or from the package root which
 * re-exports everything). Internal modules can reach into the leaf
 * files directly.
 */

export type {
  Entity,
  EntityAttribute,
  EntityRelation,
  EntityType,
  EntityId,
  EntityScope,
  ScopeOwnerType,
} from './entity.js';

export {
  PLATFORM_OWNER_ID,
  ScopeViolationError,
  enforceScope,
} from './scope.js';

export type { CallerPrincipal } from './scope.js';

export {
  InvalidProvenanceError,
  validateProvenance,
  summariseProvenance,
} from './provenance.js';

export type { ProvenanceSource } from './provenance.js';

export {
  EntityNotFoundError,
  EntityTypeNotRegisteredError,
  AttributeValidationError,
  RelationDuplicateError,
  TenantScopeMisuseError,
} from './errors.js';
