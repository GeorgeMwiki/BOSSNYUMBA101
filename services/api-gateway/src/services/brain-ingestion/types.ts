/**
 * Public types for the Company-Brain ingestion service (Wave COMPANY-BRAIN C-1).
 * Ported from Borjie services/api-gateway/src/services/brain-ingestion/types.ts.
 */

import { CORPUS_DOC_SOURCE_KINDS, CORPUS_DOC_STATUSES } from '@bossnyumba/database/schemas';

// Derived from the exported const arrays via the `/schemas` subpath, whose
// `exports.types` resolves to source. The bare `@bossnyumba/database` barrel
// resolves to dist (no co-located d.ts) and surfaces these as `any`/namespace
// (TS2709 / never-widening); the subpath gives the real string-literal union.
export type CorpusDocSourceKind = (typeof CORPUS_DOC_SOURCE_KINDS)[number];
export type CorpusDocStatus = (typeof CORPUS_DOC_STATUSES)[number];

export interface IncomingDoc {
  readonly originalFilename: string;
  readonly sourceKind: CorpusDocSourceKind;
  readonly mimeType?: string | undefined;
  readonly bytes?: Uint8Array | undefined;
  readonly text?: string | undefined;
  readonly languageHint?: 'en' | 'sw' | 'auto' | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface ParsedDoc {
  readonly text: string;
  readonly table?:
    | {
        readonly headers: ReadonlyArray<string>;
        readonly rows: ReadonlyArray<ReadonlyArray<string>>;
      }
    | undefined;
  readonly warnings: ReadonlyArray<string>;
  readonly detectedLanguage: 'en' | 'sw' | 'unknown';
  readonly extractedFacts: ReadonlyArray<ExtractedFact>;
}

export interface ExtractedFact {
  readonly kind: string;
  readonly value: string;
  readonly confidence: number;
}

export interface TextChunk {
  readonly id: string;
  readonly text: string;
  readonly section: string | null;
  readonly chunkIndex: number;
}

export interface EmbeddedChunk extends TextChunk {
  readonly embedding: ReadonlyArray<number>;
}

export interface Summary {
  readonly summaryMd: string;
  readonly summaryEn: string;
  readonly summarySw: string;
  readonly keyFacts: ReadonlyArray<ExtractedFact>;
}

export interface IngestRequest {
  readonly tenantId: string;
  readonly userId: string;
  readonly doc: IncomingDoc;
  readonly storageUrl: string;
  readonly uploadedAtIso?: string | undefined;
}

export interface IngestReceipt {
  readonly uploadId: string;
  readonly status: CorpusDocStatus;
  readonly chunksCount: number;
  readonly entitiesExtracted: number;
  readonly summary: Summary | null;
  readonly warnings: ReadonlyArray<string>;
  readonly previewEntities: ReadonlyArray<{
    readonly kind: string;
    readonly displayName: string;
  }>;
  readonly errorMessage?: string | undefined;
}
