import { describe, expect, it } from 'vitest';

import {
  buildProvenance,
  computeProvenanceHash,
  hashFileBytes,
} from '../provenance/hash.js';

const baseSeed = {
  file_hash: 'abc123',
  conversation_id: 'conv-1',
  message_id: 'msg-1',
  row_idx: 0,
  llm_inferred_schema_version: 'sniff-v1',
  ingest_plan_id: 'plan-1',
  timestamp: '2026-05-19T10:00:00.000Z',
};

describe('provenance hash', () => {
  it('produces a 64-char lowercase hex sha256', () => {
    const hash = computeProvenanceHash(baseSeed);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for identical inputs', () => {
    const a = computeProvenanceHash(baseSeed);
    const b = computeProvenanceHash({ ...baseSeed });
    expect(a).toEqual(b);
  });

  it('differs when row_idx changes', () => {
    const a = computeProvenanceHash(baseSeed);
    const b = computeProvenanceHash({ ...baseSeed, row_idx: 1 });
    expect(a).not.toEqual(b);
  });

  it('differs when file_hash changes', () => {
    const a = computeProvenanceHash(baseSeed);
    const b = computeProvenanceHash({ ...baseSeed, file_hash: 'different' });
    expect(a).not.toEqual(b);
  });

  it('differs when ingest_plan_id changes', () => {
    const a = computeProvenanceHash(baseSeed);
    const b = computeProvenanceHash({ ...baseSeed, ingest_plan_id: 'plan-2' });
    expect(a).not.toEqual(b);
  });

  it('differs when llm_inferred_schema_version changes', () => {
    const a = computeProvenanceHash(baseSeed);
    const b = computeProvenanceHash({
      ...baseSeed,
      llm_inferred_schema_version: 'sniff-v2',
    });
    expect(a).not.toEqual(b);
  });

  it('IGNORES message_id and timestamp (not identity-bearing)', () => {
    // The hash recipe explicitly excludes message_id and timestamp so the
    // same row from the same plan, re-sent in a different chat message,
    // is still idempotent.
    const a = computeProvenanceHash(baseSeed);
    const b = computeProvenanceHash({
      ...baseSeed,
      message_id: 'msg-2',
      timestamp: '2030-01-01T00:00:00.000Z',
    });
    expect(a).toEqual(b);
  });

  it('buildProvenance returns a frozen record with all fields', () => {
    const prov = buildProvenance(baseSeed);
    expect(prov.file_hash).toEqual('abc123');
    expect(prov.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(prov)).toBe(true);
  });

  it('hashFileBytes hashes Buffer + Uint8Array consistently', () => {
    const buf = Buffer.from('hello world', 'utf8');
    const u8 = new Uint8Array(buf);
    expect(hashFileBytes(buf)).toEqual(hashFileBytes(u8));
    expect(hashFileBytes(buf)).toEqual(hashFileBytes('hello world'));
  });
});
