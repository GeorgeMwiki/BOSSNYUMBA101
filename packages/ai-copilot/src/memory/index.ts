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
