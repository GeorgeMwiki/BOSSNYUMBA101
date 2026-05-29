/**
 * Knowledge-graph grower — extraction heuristic tests.
 *
 * Unit-only: covers the deterministic real-estate entity-detection
 * heuristic without touching the database. Integration tests for the
 * DB upsert paths live in __tests__/grower.integration.test.ts (gated
 * by DATABASE_URL).
 */

import { describe, expect, it } from 'vitest';
import { _extractEntitiesForTest, growKnowledgeGraphFromDoc } from '../grower.js';
import type { ParsedDoc, TextChunk } from '../../brain-ingestion/types.js';

function makeChunks(texts: ReadonlyArray<string>): ReadonlyArray<TextChunk> {
  return texts.map((text, i) => ({
    id: `chunk-${i}`,
    text,
    section: null,
    chunkIndex: i,
  }));
}

function makeParsed(text: string, lang: 'en' | 'sw' | 'unknown' = 'en'): ParsedDoc {
  return {
    text,
    warnings: [],
    detectedLanguage: lang,
    extractedFacts: [],
  };
}

describe('knowledge-graph grower extraction', () => {
  it('always promotes the upload itself as a doc_upload entity', () => {
    const chunks = makeChunks(['Tenancy agreement for apartment 4B.']);
    const parsed = makeParsed('Tenancy agreement for apartment 4B.');
    const entities = _extractEntitiesForTest('upload-xyz', parsed, chunks);
    const doc = entities.find((e) => e.kind === 'doc_upload');
    expect(doc).toBeDefined();
    expect(doc?.id).toBe('upload-xyz');
  });

  it('detects unit_type "apartment"', () => {
    const chunks = makeChunks(['The apartment shall be handed over on 1 June.']);
    const parsed = makeParsed(chunks[0]!.text);
    const entities = _extractEntitiesForTest('u1', parsed, chunks);
    const apt = entities.find((e) => e.kind === 'unit_type' && e.id === 'apartment');
    expect(apt).toBeDefined();
    expect(apt?.displayName).toBe('Apartment');
  });

  it('detects Swahili unit_type "nyumba"', () => {
    const chunks = makeChunks(['Nyumba hii ina vyumba vitatu.']);
    const parsed = makeParsed(chunks[0]!.text, 'sw');
    const entities = _extractEntitiesForTest('u1', parsed, chunks);
    const house = entities.find((e) => e.kind === 'unit_type' && e.id === 'house');
    expect(house).toBeDefined();
  });

  it('detects "lease" and "rent" concept tokens', () => {
    const chunks = makeChunks(['This lease covers monthly rent payments.']);
    const parsed = makeParsed(chunks[0]!.text);
    const entities = _extractEntitiesForTest('u1', parsed, chunks);
    expect(entities.find((e) => e.kind === 'concept' && e.id === 'lease')).toBeDefined();
    expect(entities.find((e) => e.kind === 'concept' && e.id === 'rent')).toBeDefined();
  });

  it('detects "amana" deposit (Swahili)', () => {
    const chunks = makeChunks(['Mpangaji atalipa amana ya TZS 500,000.']);
    const parsed = makeParsed(chunks[0]!.text, 'sw');
    const entities = _extractEntitiesForTest('u1', parsed, chunks);
    expect(entities.find((e) => e.kind === 'concept' && e.id === 'deposit')).toBeDefined();
    expect(entities.find((e) => e.kind === 'role' && e.id === 'tenant')).toBeDefined();
  });

  it('detects regulators NHC, TRA, KRA', () => {
    const chunks = makeChunks([
      'Submit to NHC and copy TRA for tax. KRA filing follows.',
    ]);
    const parsed = makeParsed(chunks[0]!.text);
    const entities = _extractEntitiesForTest('u1', parsed, chunks);
    expect(entities.find((e) => e.id === 'nhc')).toBeDefined();
    expect(entities.find((e) => e.id === 'tra')).toBeDefined();
    expect(entities.find((e) => e.id === 'kra')).toBeDefined();
  });

  it('detects landlord / tenant / caretaker roles bilingually', () => {
    const chunks = makeChunks([
      'Mwenye nyumba na mpangaji wamekutana na mlinzi.',
    ]);
    const parsed = makeParsed(chunks[0]!.text, 'sw');
    const entities = _extractEntitiesForTest('u1', parsed, chunks);
    expect(entities.find((e) => e.id === 'landlord')).toBeDefined();
    expect(entities.find((e) => e.id === 'tenant')).toBeDefined();
    expect(entities.find((e) => e.id === 'caretaker')).toBeDefined();
  });

  it('detects money mentions with TZS / KES / USD', () => {
    const chunks = makeChunks(['Rent is TZS 800,000 or USD 320 or KES 45,000.']);
    const parsed = makeParsed(chunks[0]!.text);
    const entities = _extractEntitiesForTest('u1', parsed, chunks);
    const money = entities.filter((e) => e.kind === 'money_mention');
    expect(money.length).toBeGreaterThanOrEqual(3);
  });

  it('detects date mentions in ISO and slash formats', () => {
    const chunks = makeChunks(['Lease begins 2026-07-01 and ends 30/06/2027.']);
    const parsed = makeParsed(chunks[0]!.text);
    const entities = _extractEntitiesForTest('u1', parsed, chunks);
    const dates = entities.filter((e) => e.kind === 'date_mention');
    expect(dates.length).toBeGreaterThanOrEqual(2);
  });

  it('detects email and phone mentions', () => {
    const chunks = makeChunks([
      'Contact tenant at asha@example.com or +255712345678.',
    ]);
    const parsed = makeParsed(chunks[0]!.text);
    const entities = _extractEntitiesForTest('u1', parsed, chunks);
    expect(entities.find((e) => e.kind === 'email_mention')).toBeDefined();
    expect(entities.find((e) => e.kind === 'phone_mention')).toBeDefined();
  });

  it('detects KE phone format +254...', () => {
    const chunks = makeChunks(['Call John on +254712345678 today.']);
    const parsed = makeParsed(chunks[0]!.text);
    const entities = _extractEntitiesForTest('u1', parsed, chunks);
    expect(entities.find((e) => e.kind === 'phone_mention')).toBeDefined();
  });

  it('extracts proper-noun candidate entities (stop-words excluded)', () => {
    const chunks = makeChunks([
      'Asha Mwakikoti signed with Bahari Heights Limited for unit 5C.',
    ]);
    const parsed = makeParsed(chunks[0]!.text);
    const entities = _extractEntitiesForTest('u1', parsed, chunks);
    const candidates = entities.filter((e) => e.kind === 'candidate_entity');
    expect(candidates.length).toBeGreaterThan(0);
    // BossNyumba is a stop-word — should not appear as candidate
    expect(candidates.find((e) => e.id === 'bossnyumba')).toBeUndefined();
  });

  it('returns preview entities (max 5, doc_upload excluded) when no DB', async () => {
    const chunks = makeChunks([
      'Tenant Asha rents apartment in Bahari Heights for TZS 800,000.',
    ]);
    const parsed = makeParsed(chunks[0]!.text);
    const result = await growKnowledgeGraphFromDoc({
      tenantId: 'tenant-1',
      uploadId: 'u-no-db',
      originalFilename: 'lease.pdf',
      parsed,
      chunks,
    });
    expect(result.previewEntities.length).toBeLessThanOrEqual(5);
    expect(result.previewEntities.length).toBeGreaterThan(0);
    // doc_upload itself excluded from preview
    expect(result.previewEntities.find((e) => e.kind === 'doc_upload')).toBeUndefined();
    expect(result.crossRefsCreated).toBe(0);
  });

  it('deduplicates the same canonical token across multiple chunks', () => {
    const chunks = makeChunks([
      'Apartment block A.',
      'The apartment is on floor 3.',
      'Apartment view is east-facing.',
    ]);
    const parsed = makeParsed(chunks.map((c) => c.text).join(' '));
    const entities = _extractEntitiesForTest('u1', parsed, chunks);
    const apts = entities.filter((e) => e.kind === 'unit_type' && e.id === 'apartment');
    expect(apts.length).toBe(1);
  });

  it('returns an immutable entity list (frozen)', () => {
    const chunks = makeChunks(['Apartment 1.']);
    const parsed = makeParsed(chunks[0]!.text);
    const entities = _extractEntitiesForTest('u1', parsed, chunks);
    expect(Object.isFrozen(entities)).toBe(true);
  });
});
