/**
 * Company-Brain ingestion orchestrator. Drives the full lifecycle:
 *   pending -> parsing -> chunking -> embedded -> indexed
 *           \-> failed
 *
 * Ported from Borjie ingest.ts. Grower is optional (pluggable).
 */
import type { Embedder } from './embedder.js';
import type { IngestionPersistence } from './persistence.js';
import { embedChunks } from './embedder.js';
import { chunkText } from './chunker.js';
import { parseIncomingDoc } from './parser.js';
import { summariseDoc, type SummariserLlmCall } from './summarizer.js';
import type { IngestReceipt, IngestRequest, Summary, ParsedDoc, TextChunk } from './types.js';

export interface KnowledgeGraphGrower {
  (input: {
    readonly tenantId: string;
    readonly uploadId: string;
    readonly originalFilename: string;
    readonly parsed: ParsedDoc;
    readonly chunks: ReadonlyArray<TextChunk>;
  }): Promise<{
    readonly entitiesExtracted: number;
    readonly previewEntities: ReadonlyArray<{
      readonly kind: string;
      readonly displayName: string;
    }>;
  }>;
}

export interface IngestionDeps {
  readonly persistence: IngestionPersistence;
  readonly embedder: Embedder;
  readonly grower?: KnowledgeGraphGrower | undefined;
  readonly llmCall?: SummariserLlmCall | undefined;
  readonly logger?: {
    info(obj: Record<string, unknown>, msg?: string): void;
    warn(obj: Record<string, unknown>, msg?: string): void;
    error(obj: Record<string, unknown>, msg?: string): void;
  } | undefined;
}

export async function ingest(deps: IngestionDeps, req: IngestRequest): Promise<IngestReceipt> {
  const log = deps.logger;
  const { tenantId, userId, doc, storageUrl } = req;

  const sizeBytes = doc.bytes ? doc.bytes.byteLength : doc.text ? Buffer.byteLength(doc.text, 'utf8') : 0;
  const { uploadId } = await deps.persistence.insertUpload({
    tenantId,
    uploadedByUserId: userId,
    sourceKind: doc.sourceKind,
    originalFilename: doc.originalFilename,
    sizeBytes,
    storageUrl,
    metadata: {
      ...(doc.metadata ?? {}),
      ...(doc.mimeType !== undefined ? { mimeType: doc.mimeType } : {}),
      ...(doc.languageHint !== undefined ? { languageHint: doc.languageHint } : {}),
    },
  });
  log?.info({ tenantId, userId, uploadId, sourceKind: doc.sourceKind, sizeBytes }, 'brain-ingest: upload row inserted');

  await deps.persistence.updateUploadStatus({ tenantId, uploadId, status: 'parsing' });
  let parsed: ParsedDoc;
  try {
    parsed = await parseIncomingDoc(doc);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log?.warn({ tenantId, uploadId, error: message }, 'brain-ingest: parse failed');
    await deps.persistence.updateUploadStatus({ tenantId, uploadId, status: 'failed', errorMessage: message, markProcessed: true });
    return failedReceipt(uploadId, message);
  }

  await deps.persistence.updateUploadStatus({ tenantId, uploadId, status: 'chunking' });
  const chunks = chunkText(parsed.text, { seed: uploadId });
  log?.info({ tenantId, uploadId, chunks: chunks.length }, 'brain-ingest: chunked');

  const effectiveChunks =
    chunks.length === 0
      ? chunkText(`[ingested ${doc.originalFilename} - no extractable text]`, { seed: uploadId })
      : chunks;

  let embedded;
  try {
    embedded = await embedChunks(deps.embedder, effectiveChunks);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log?.warn({ tenantId, uploadId, error: message }, 'brain-ingest: embed failed');
    await deps.persistence.updateUploadStatus({ tenantId, uploadId, status: 'failed', errorMessage: `embed: ${message}`, markProcessed: true });
    return failedReceipt(uploadId, message);
  }
  await deps.persistence.updateUploadStatus({ tenantId, uploadId, status: 'embedded', chunksCount: embedded.length });

  try {
    await deps.persistence.upsertChunks({
      tenantId,
      uploadId,
      originalFilename: doc.originalFilename,
      chunks: embedded,
      language: parsed.detectedLanguage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log?.error({ tenantId, uploadId, error: message }, 'brain-ingest: chunk persistence failed');
    await deps.persistence.updateUploadStatus({ tenantId, uploadId, status: 'failed', errorMessage: `persist_chunks: ${message}`, markProcessed: true });
    return failedReceipt(uploadId, message);
  }

  let entitiesExtracted = 0;
  const previewEntities: Array<{ kind: string; displayName: string }> = [];
  if (deps.grower) {
    try {
      const growth = await deps.grower({
        tenantId,
        uploadId,
        originalFilename: doc.originalFilename,
        parsed,
        chunks: effectiveChunks,
      });
      entitiesExtracted = growth.entitiesExtracted;
      for (const e of growth.previewEntities) {
        previewEntities.push({ kind: e.kind, displayName: e.displayName });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log?.warn({ tenantId, uploadId, error: message }, 'brain-ingest: kg growth failed (non-fatal)');
    }
  }

  let summary: Summary | null = null;
  try {
    summary = await summariseDoc({
      tenantId,
      filename: doc.originalFilename,
      sourceKind: doc.sourceKind,
      parsed,
      llmCall: deps.llmCall,
    });
    await deps.persistence.insertSummary({ tenantId, uploadId, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log?.warn({ tenantId, uploadId, error: message }, 'brain-ingest: summarise failed (non-fatal)');
  }

  await deps.persistence.updateUploadStatus({
    tenantId,
    uploadId,
    status: 'indexed',
    chunksCount: embedded.length,
    entitiesExtracted,
    markProcessed: true,
  });

  return Object.freeze({
    uploadId,
    status: 'indexed' as const,
    chunksCount: embedded.length,
    entitiesExtracted,
    summary,
    warnings: parsed.warnings,
    previewEntities: Object.freeze(previewEntities.slice(0, 5)),
  });
}

function failedReceipt(uploadId: string, message: string): IngestReceipt {
  return Object.freeze({
    uploadId,
    status: 'failed' as const,
    chunksCount: 0,
    entitiesExtracted: 0,
    summary: null,
    warnings: Object.freeze([message]),
    previewEntities: Object.freeze([]),
    errorMessage: message,
  });
}
