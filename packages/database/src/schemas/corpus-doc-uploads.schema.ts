/**
 * corpus_doc_uploads + corpus_doc_summaries — Company Brain ingestion.
 *
 * Companion to migration 0280. Ported from Borjie 0140 (domain-neutral
 * — kept verbatim per CLAUDE.md "brain layer kept verbatim" guideline).
 *
 * Landlord-uploaded documents (leases, inspection reports, building
 * plans, tenant correspondence, photos, audio). Lifecycle:
 * pending → parsing → chunking → embedded → indexed.
 *
 * Bilingual sw/en summaries. APPEND-ONLY (no DELETE policy).
 */

import {
  pgTable,
  text,
  bigint,
  integer,
  timestamp,
  jsonb,
  uuid,
  index,
} from 'drizzle-orm/pg-core';

export const CORPUS_DOC_SOURCE_KINDS = [
  'csv',
  'xlsx',
  'pdf',
  'photo',
  'audio',
  'text',
  'json',
  'email',
  'webpage',
] as const;
export type CorpusDocSourceKind = (typeof CORPUS_DOC_SOURCE_KINDS)[number];

export const CORPUS_DOC_STATUSES = [
  'pending',
  'parsing',
  'chunking',
  'embedded',
  'indexed',
  'failed',
  'redacted',
] as const;
export type CorpusDocStatus = (typeof CORPUS_DOC_STATUSES)[number];

export const corpusDocUploads = pgTable(
  'corpus_doc_uploads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    uploadedByUserId: text('uploaded_by_user_id').notNull(),
    sourceKind: text('source_kind').$type<CorpusDocSourceKind>().notNull(),
    originalFilename: text('original_filename').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storageUrl: text('storage_url').notNull(),
    status: text('status').$type<CorpusDocStatus>().notNull().default('pending'),
    chunksCount: integer('chunks_count').notNull().default(0),
    entitiesExtracted: integer('entities_extracted').notNull().default(0),
    errorMessage: text('error_message'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (t) => ({
    tenantUploadedIdx: index('corpus_doc_uploads_tenant_uploaded_idx').on(
      t.tenantId,
      t.uploadedAt,
    ),
    tenantStatusIdx: index('corpus_doc_uploads_tenant_status_idx').on(
      t.tenantId,
      t.status,
    ),
    userIdx: index('corpus_doc_uploads_user_idx').on(
      t.tenantId,
      t.uploadedByUserId,
    ),
  }),
);

export const corpusDocSummaries = pgTable(
  'corpus_doc_summaries',
  {
    uploadId: uuid('upload_id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    summaryMd: text('summary_md').notNull(),
    summaryEn: text('summary_en').notNull(),
    summarySw: text('summary_sw').notNull(),
    keyFacts: jsonb('key_facts').notNull().default([]),
    generatedAt: timestamp('generated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantIdx: index('corpus_doc_summaries_tenant_idx').on(t.tenantId),
  }),
);

export type CorpusDocUploadRow = typeof corpusDocUploads.$inferSelect;
export type NewCorpusDocUploadRow = typeof corpusDocUploads.$inferInsert;
export type CorpusDocSummaryRow = typeof corpusDocSummaries.$inferSelect;
export type NewCorpusDocSummaryRow = typeof corpusDocSummaries.$inferInsert;
