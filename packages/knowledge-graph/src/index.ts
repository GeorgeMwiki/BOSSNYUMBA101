/**
 * `@bossnyumba/knowledge-graph` — public barrel.
 *
 * Headline consumer:
 *
 *   const kg = createKnowledgeGraph({
 *     store: createInMemoryStore(),
 *     embedder: createMockGraphEmbedder({ dimension: 64 }),
 *     brain: myBrainPort,
 *     ontology: realEstateOntology,
 *   });
 *
 *   await kg.upsertProperty({ id, name, tenantId, ... });
 *   const ans = await kg.ask({ question: "Which tenants in Karen are
 *     2+ months in arrears?", tenantId });
 */

// Types
export * from './types.js';

// Ontology
export {
  realEstateOntology,
  extendOntology,
  validateOntology,
} from './ontology/index.js';

// Store
export {
  createInMemoryStore,
  type InMemoryStoreOptions,
  createKuzuAdapter,
  createNeo4jAdapter,
  type KuzuAdapterOptions,
  type Neo4jAdapterOptions,
} from './store/index.js';
