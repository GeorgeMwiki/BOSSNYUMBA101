/**
 * Repository surface — port + in-memory adapter.
 *
 * The DB-backed adapter is composed in @bossnyumba/database service path
 * once migration 0167 lands.
 */

export type {
  EntityStoreRepository,
  AttributeInsert,
  FindEntitiesFilter,
  RelationFilter,
} from './port.js';

export { InMemoryEntityStoreRepository } from './in-memory-repository.js';
