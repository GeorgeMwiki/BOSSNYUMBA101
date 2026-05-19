/**
 * Service surface — the factory and its argument shapes.
 */

export {
  createEntityStoreService,
} from './entity-store-service.js';

export type {
  EntityStoreService,
  EntityStoreServiceDeps,
  CreateEntityArgs,
  AddAttributeArgs,
  LinkEntitiesArgs,
  ApplyProvenanceArgs,
  EntitySnapshot,
} from './entity-store-service.js';
