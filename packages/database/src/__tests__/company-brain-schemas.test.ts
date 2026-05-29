/**
 * Schema introspection tests for the COMPANY-BRAIN wave (migrations
 * 0285-0286): intelligence_corpus_chunks + entity_index +
 * entity_cross_references.
 *
 * Validates Drizzle column declarations match the migration shape +
 * pgvector dimensions are right + lifecycle enums hold the right
 * values. Runs without a database.
 */

import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';

import { intelligenceCorpusChunks } from '../schemas/intelligence-corpus.schema.js';
import {
  entityIndex,
  entityCrossReferences,
  ENTITY_EMBEDDING_DIM,
  ENTITY_LIFECYCLE_STAGES,
  ENTITY_CROSS_REF_RELATIONSHIPS,
} from '../schemas/entity-index.schema.js';

describe('intelligence_corpus_chunks schema', () => {
  it('exposes the core columns matching migration 0285', () => {
    const cfg = getTableConfig(intelligenceCorpusChunks);
    const cols = cfg.columns.map((c) => c.name);
    expect(cols).toContain('id');
    expect(cols).toContain('tenant_id');
    expect(cols).toContain('source_file');
    expect(cols).toContain('section');
    expect(cols).toContain('text');
    expect(cols).toContain('embedding');
    expect(cols).toContain('language');
    expect(cols).toContain('ingested_at');
  });

  it('tenant_id is nullable so the global corpus is allowed', () => {
    const cfg = getTableConfig(intelligenceCorpusChunks);
    const tenant = cfg.columns.find((c) => c.name === 'tenant_id');
    expect(tenant).toBeDefined();
    expect(tenant?.notNull).toBe(false);
  });

  it('source_file + text + language are not null', () => {
    const cfg = getTableConfig(intelligenceCorpusChunks);
    for (const name of ['source_file', 'text', 'language']) {
      const col = cfg.columns.find((c) => c.name === name);
      expect(col?.notNull, name).toBe(true);
    }
  });

  it('language defaults to en', () => {
    const cfg = getTableConfig(intelligenceCorpusChunks);
    const lang = cfg.columns.find((c) => c.name === 'language');
    expect(lang?.default).toBe('en');
  });

  it('embedding declares the pgvector(1024) data type', () => {
    const cfg = getTableConfig(intelligenceCorpusChunks);
    const emb = cfg.columns.find((c) => c.name === 'embedding');
    expect(emb?.getSQLType().toLowerCase()).toContain('vector(1024)');
  });

  it('declares the four supporting indexes', () => {
    const cfg = getTableConfig(intelligenceCorpusChunks);
    const idx = cfg.indexes.map((i) => i.config.name);
    expect(idx).toContain('intelligence_corpus_chunks_tenant_idx');
    expect(idx).toContain('intelligence_corpus_chunks_lang_idx');
    expect(idx).toContain('intelligence_corpus_chunks_superseded_idx');
  });
});

describe('entity_index schema', () => {
  it('exposes display_name, embedding, tags, summary, lifecycle_stage', () => {
    const cfg = getTableConfig(entityIndex);
    const cols = cfg.columns.map((c) => c.name);
    for (const name of [
      'display_name',
      'embedding',
      'tags',
      'summary',
      'lifecycle_stage',
      'tenant_id',
      'entity_kind',
      'entity_id',
    ]) {
      expect(cols, name).toContain(name);
    }
  });

  it('embedding declares vector(1536) - OpenAI 3-small dim', () => {
    const cfg = getTableConfig(entityIndex);
    const emb = cfg.columns.find((c) => c.name === 'embedding');
    expect(ENTITY_EMBEDDING_DIM).toBe(1536);
    expect(emb?.getSQLType().toLowerCase()).toContain('vector(1536)');
  });

  it('lifecycle_stage default is active', () => {
    const cfg = getTableConfig(entityIndex);
    const lc = cfg.columns.find((c) => c.name === 'lifecycle_stage');
    expect(lc?.default).toBe('active');
  });

  it('lifecycle enum carries the five canonical stages', () => {
    expect([...ENTITY_LIFECYCLE_STAGES].sort()).toEqual([
      'active',
      'archived',
      'deleted',
      'dormant',
      'draft',
    ]);
  });
});

describe('entity_cross_references schema', () => {
  it('relationship enum carries the six canonical edge kinds', () => {
    expect([...ENTITY_CROSS_REF_RELATIONSHIPS].sort()).toEqual([
      'child',
      'depends_on',
      'duplicate',
      'parent',
      'related',
      'supersedes',
    ]);
  });

  it('declares the composite primary key on (tenant, source, target, rel)', () => {
    const cfg = getTableConfig(entityCrossReferences);
    const pkCols = cfg.primaryKeys
      .flatMap((p) => p.columns.map((c) => c.name))
      .sort();
    expect(pkCols).toEqual(
      [
        'relationship',
        'source_id',
        'source_kind',
        'target_id',
        'target_kind',
        'tenant_id',
      ].sort(),
    );
  });

  it('confidence defaults to 1.000 (numeric(4,3))', () => {
    const cfg = getTableConfig(entityCrossReferences);
    const conf = cfg.columns.find((c) => c.name === 'confidence');
    expect(conf?.default).toBe('1.000');
  });

  it('exposes forward / reverse / relationship indexes', () => {
    const cfg = getTableConfig(entityCrossReferences);
    const idx = cfg.indexes.map((i) => i.config.name);
    expect(idx).toContain('entity_cross_references_forward_idx');
    expect(idx).toContain('entity_cross_references_reverse_idx');
    expect(idx).toContain('entity_cross_references_relationship_idx');
  });
});
