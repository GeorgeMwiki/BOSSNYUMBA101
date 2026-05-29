/**
 * Entity Index — public barrel.
 */

export {
  ENTITY_INDEX_PERSONAS,
  applyPersonaFilter,
  computePersonaProjection,
  type EntityIndexPersona,
  type EntityIndexRow,
  type PersonaProjection,
  type ComputePersonaProjectionInput,
} from './persona-filter.js';

export {
  queryEntityIndex,
  resolveEntity,
  recentEntities,
  type EntityIndexQueryDb,
  type QueryEntityIndexInput,
  type QueryEntityIndexResult,
} from './query.js';
