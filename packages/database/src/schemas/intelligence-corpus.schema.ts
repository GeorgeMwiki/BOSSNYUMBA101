/**
 * intelligence_corpus_chunks - pgvector-backed bootstrap brain memory.
 *
 * Ported from Borjie (intelligence-corpus.schema.ts).
 * Companion to migration 0285_intelligence_corpus_chunks.sql.
 *
 * Holds the chunked + embedded text of every primary-source document
 * BossNyumba ships: TZ rental code, tenancy regulations, real-estate
 * reference material, plus tenant-uploaded documents.
 *
 * tenant_id IS NULL => global corpus (read-only for every tenant).
 * RLS allows SELECT when tenant_id matches GUC OR tenant_id IS NULL.
 *
 * Embedding column: vector(1024) (OpenAI text-embedding-3-large with
 * dimensions: 1024). APPEND-ONLY (no DELETE policy).
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  customType,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const vector1024 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1024)';
  },
  toDriver(value) {
    return `[${value.join(',')}]`;
  },
  fromDriver(value) {
    const stripped = value.replace(/^\[|\]$/g, '');
    return stripped ? stripped.split(',').map(Number) : [];
  },
});

export const intelligenceCorpusChunks = pgTable(
  'intelligence_corpus_chunks',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id'),
    sourceFile: text('source_file').notNull(),
    section: text('section'),
    page: integer('page'),
    text: text('text').notNull(),
    embedding: vector1024('embedding'),
    url: text('url'),
    language: text('language').notNull().default('en'),
    metadata: jsonb('metadata').notNull().default({}),
    ingestedAt: timestamp('ingested_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    supersededById: text('superseded_by_id'),
  },
  (t) => ({
    tenantIdx: index('intelligence_corpus_chunks_tenant_idx').on(t.tenantId),
    sourceSectionUniq: uniqueIndex(
      'intelligence_corpus_chunks_source_section_uniq',
    ).on(t.sourceFile, t.section),
    langIdx: index('intelligence_corpus_chunks_lang_idx').on(t.language),
    supersededIdx: index('intelligence_corpus_chunks_superseded_idx').on(
      t.supersededById,
    ),
  }),
);

export type IntelligenceCorpusChunk = typeof intelligenceCorpusChunks.$inferSelect;
export type NewIntelligenceCorpusChunk = typeof intelligenceCorpusChunks.$inferInsert;
