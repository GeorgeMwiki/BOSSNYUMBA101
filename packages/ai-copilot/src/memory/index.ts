/**
 * BOSSNYUMBA AI memory module — Wave-11.
 *
 * Semantic memory + rule-based extraction + exponential decay sweep.
 */

export {
  createSemanticMemory,
  createInMemorySemanticMemoryRepo,
  createHashEmbedder,
  cosineSimilarity,
  type SemanticMemory,
  type SemanticMemoryRepository,
  type SemanticMemoryRow,
  type SemanticMemoryDeps,
  type RememberInput,
  type RecallResult,
  type Embedder,
  type MemoryType,
} from './semantic-memory.js';

export {
  extractInsightsFromTurn,
  analyzeAndRemember,
  type ConversationTurn,
  type ExtractedInsight,
  type ExtractorDeps,
} from './memory-extractor.js';

export {
  computeDecayedScore,
  sweepTenantDecay,
  DEFAULT_DECAY,
  type DecayPolicy,
  type DecaySweepDeps,
  type DecayResult,
} from './memory-decay.js';

// Mem0 ADD/UPDATE/DELETE/NOOP semantics (Park et al. 2024). Ported
// from LITFIN — pure decision module used by the consolidation
// worker's promote stage to avoid double-writing contradicted or
// duplicated facts. See ./mem0-semantics.ts header.
export {
  decideMem0Op,
  describeMem0Decision,
  jaccardSimilarity,
  cosineSimilarity as mem0CosineSimilarity,
  withEmbedding as withMem0Embedding,
  DEFAULT_CONTRADICTION_THRESHOLD as MEM0_DEFAULT_CONTRADICTION_THRESHOLD,
  DEFAULT_NOOP_THRESHOLD as MEM0_DEFAULT_NOOP_THRESHOLD,
  DEFAULT_DELETE_THRESHOLD as MEM0_DEFAULT_DELETE_THRESHOLD,
  type FactType as Mem0FactType,
  type Mem0Decision,
  type Mem0Candidate,
  type Mem0ExistingFact,
  type DecideMem0Options,
  type Mem0Embedder,
} from './mem0-semantics.js';

// Federated Personal Knowledge Base (migration 0296) — ported from
// Borjie. Tenant-scoped memory (semantic-memory + core-memory-blocks)
// keeps the active-tenancy recall; PersonLayer adds the federated
// person-level overlay so a multi-tenancy landlord no longer loses
// her preferences when she switches estates. boundary-tagger enforces
// the Chinese-wall on every cross-tenant numeric synthesis.
export {
  loadPersonLayer,
  upsertPersonalFact,
  flattenPersonLayer,
  PERSON_CELL_KINDS,
  PERSON_LAYER_PER_KIND_LIMIT,
  type PersonCellKind,
  type PersonalMemoryCell,
  type PersonLayerResult,
  type LoadPersonLayerArgs,
  type UpsertPersonalFactArgs,
  type PersonLayerDrizzleClient,
  type PersonLayerSqlTemplate,
} from './person-layer.js';
export {
  enforceChineseWall,
  assertChineseWall,
  tagBoundary,
  cellContainsNumeric,
  K_ANONYMITY_FLOOR,
  PersonalKbBoundaryViolation,
  type EnforceChineseWallArgs,
  type EnforceChineseWallResult,
  type CrossTenantCount,
  type BoundaryTags,
  type TagBoundaryArgs,
} from './boundary-tagger.js';
export {
  composePromptWithPersonLayer,
  type ComposePromptWithPersonLayerArgs,
  type ComposePromptWithPersonLayerResult,
} from './compose-prompt-with-person-layer.js';
