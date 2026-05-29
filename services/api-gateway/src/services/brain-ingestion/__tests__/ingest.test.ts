import { describe, expect, it } from 'vitest';
import { ingest, type IngestionDeps, type KnowledgeGraphGrower } from '../ingest.js';
import type { IngestionPersistence } from '../persistence.js';
import { createStubEmbedder } from '../embedder.js';
import type { CorpusDocStatus, EmbeddedChunk, Summary } from '../types.js';

function makeMemoryPersistence(): IngestionPersistence & {
  readonly state: {
    uploads: Map<string, { status: CorpusDocStatus; chunksCount: number; error?: string }>;
    chunks: Map<string, EmbeddedChunk[]>;
    summaries: Map<string, Summary>;
  };
} {
  const state = {
    uploads: new Map<string, { status: CorpusDocStatus; chunksCount: number; error?: string }>(),
    chunks: new Map<string, EmbeddedChunk[]>(),
    summaries: new Map<string, Summary>(),
  };
  let nextId = 0;
  return {
    state,
    async insertUpload(row) {
      void row;
      const uploadId = `upload-${++nextId}`;
      state.uploads.set(uploadId, { status: 'pending', chunksCount: 0 });
      return Object.freeze({ uploadId });
    },
    async updateUploadStatus(args) {
      const cur = state.uploads.get(args.uploadId) ?? { status: 'pending' as CorpusDocStatus, chunksCount: 0 };
      const patch = { ...cur, status: args.status };
      if (args.chunksCount !== undefined) patch.chunksCount = args.chunksCount;
      if (args.errorMessage !== undefined) patch.error = args.errorMessage;
      state.uploads.set(args.uploadId, patch);
    },
    async upsertChunks(args) {
      state.chunks.set(args.uploadId, [...args.chunks]);
    },
    async insertSummary(args) {
      state.summaries.set(args.uploadId, args.summary);
    },
  };
}

function makeDeps(overrides: Partial<IngestionDeps> = {}): {
  deps: IngestionDeps;
  persistence: ReturnType<typeof makeMemoryPersistence>;
} {
  const persistence = makeMemoryPersistence();
  return {
    persistence,
    deps: { persistence, embedder: createStubEmbedder(), ...overrides },
  };
}

describe('ingest - happy path', () => {
  it('moves the upload through pending -> indexed', async () => {
    const { deps, persistence } = makeDeps();
    const receipt = await ingest(deps, {
      tenantId: 't-1', userId: 'u-1', storageUrl: 's3://lease.pdf',
      doc: {
        originalFilename: 'lease.txt', sourceKind: 'text',
        text: 'This Lease Agreement is between landlord and tenant',
      },
    });
    expect(receipt.status).toBe('indexed');
    expect(receipt.chunksCount).toBeGreaterThanOrEqual(1);
    expect(persistence.state.uploads.get(receipt.uploadId)?.status).toBe('indexed');
  });
  it('writes chunks to the chunks map', async () => {
    const { deps, persistence } = makeDeps();
    const receipt = await ingest(deps, {
      tenantId: 't-1', userId: 'u-1', storageUrl: 's3://x',
      doc: { originalFilename: 'notes.txt', sourceKind: 'text', text: 'rent due tomorrow' },
    });
    expect(persistence.state.chunks.get(receipt.uploadId)?.length).toBeGreaterThan(0);
  });
  it('persists a deterministic summary when no llm provided', async () => {
    const { deps, persistence } = makeDeps();
    const receipt = await ingest(deps, {
      tenantId: 't-1', userId: 'u-1', storageUrl: 's3://x',
      doc: { originalFilename: 'rent.txt', sourceKind: 'text', text: 'monthly rent for unit B-3' },
    });
    expect(persistence.state.summaries.get(receipt.uploadId)).toBeDefined();
    expect(persistence.state.summaries.get(receipt.uploadId)?.summaryEn).toContain('rent.txt');
  });
  it('writes a placeholder chunk when parser yields empty text', async () => {
    const { deps, persistence } = makeDeps();
    const receipt = await ingest(deps, {
      tenantId: 't-1', userId: 'u-1', storageUrl: 's3://x',
      doc: { originalFilename: 'empty.txt', sourceKind: 'text', text: '' },
    });
    expect(receipt.status).toBe('indexed');
    expect(persistence.state.chunks.get(receipt.uploadId)?.length).toBeGreaterThan(0);
  });
});

describe('ingest - knowledge-graph wiring', () => {
  it('invokes the grower when provided and surfaces previewEntities', async () => {
    const grower: KnowledgeGraphGrower = async () =>
      Object.freeze({
        entitiesExtracted: 3,
        previewEntities: Object.freeze([
          { kind: 'property', displayName: 'Block A' },
          { kind: 'tenant', displayName: 'Asha M.' },
        ]),
      });
    const { deps } = makeDeps({ grower });
    const receipt = await ingest(deps, {
      tenantId: 't', userId: 'u', storageUrl: 's3://x',
      doc: { originalFilename: 'r.txt', sourceKind: 'text', text: 'rent' },
    });
    expect(receipt.entitiesExtracted).toBe(3);
    expect(receipt.previewEntities).toHaveLength(2);
  });
  it('does not fail when grower throws', async () => {
    const grower: KnowledgeGraphGrower = async () => { throw new Error('boom'); };
    const { deps } = makeDeps({ grower });
    const receipt = await ingest(deps, {
      tenantId: 't', userId: 'u', storageUrl: 's3://x',
      doc: { originalFilename: 'r.txt', sourceKind: 'text', text: 'rent' },
    });
    expect(receipt.status).toBe('indexed');
    expect(receipt.entitiesExtracted).toBe(0);
  });
});

describe('ingest - failure modes', () => {
  it('lands status=failed when parser throws', async () => {
    const { deps, persistence } = makeDeps();
    const receipt = await ingest(deps, {
      tenantId: 't', userId: 'u', storageUrl: 's3://x',
      doc: { originalFilename: 'r.xlsx', sourceKind: 'xlsx' },
    });
    expect(receipt.status).toBe('failed');
    expect(receipt.errorMessage).toBeDefined();
    expect(persistence.state.uploads.get(receipt.uploadId)?.status).toBe('failed');
  });
  it('lands status=failed when embedder throws', async () => {
    const failing = {
      dimensions: 1024,
      async embed() { throw new Error('embed boom'); },
    } as const;
    const { deps, persistence } = makeDeps({ embedder: failing });
    const receipt = await ingest(deps, {
      tenantId: 't', userId: 'u', storageUrl: 's3://x',
      doc: { originalFilename: 'r.txt', sourceKind: 'text', text: 'rent' },
    });
    expect(receipt.status).toBe('failed');
    expect(persistence.state.uploads.get(receipt.uploadId)?.status).toBe('failed');
  });
});
