/**
 * Public surface of the Company-Brain ingestion service.
 * Wave COMPANY-BRAIN (C-1).
 */
export { ingest, type IngestionDeps, type KnowledgeGraphGrower } from './ingest.js';
// Adapter factory: wire the real-estate KG grower into brain-ingestion.
export { createDefaultKnowledgeGraphGrower } from './grower-adapter.js';
export {
  createDrizzlePersistence,
  type IngestionDb,
  type IngestionPersistence,
} from './persistence.js';
export {
  createOpenAIEmbedder,
  createStubEmbedder,
  resolveEmbedder,
  embedChunks,
  type Embedder,
} from './embedder.js';
export { chunkText } from './chunker.js';
export { parseIncomingDoc } from './parser.js';
export { summariseDoc, type SummariserLlmCall } from './summarizer.js';
export type {
  IncomingDoc,
  IngestReceipt,
  IngestRequest,
  ParsedDoc,
  EmbeddedChunk,
  TextChunk,
  Summary,
  ExtractedFact,
  CorpusDocSourceKind,
  CorpusDocStatus,
} from './types.js';
