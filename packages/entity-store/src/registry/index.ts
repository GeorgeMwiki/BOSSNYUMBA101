/**
 * Registry surface — built-in entity-type specs + the runtime resolver.
 */

export {
  BUILT_IN_TYPES,
  builtInSchemaFor,
  builtInsAsRegistryRows,
} from './built-in-types.js';

export type { BuiltInTypeSpec } from './built-in-types.js';

export {
  createEntityTypeRegistry,
} from './registry.js';

export type { EntityTypeRegistry } from './registry.js';
