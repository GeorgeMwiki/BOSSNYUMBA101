import { createHash } from 'node:crypto';

import type { Provenance, ProvenanceSeed } from './types.js';

/**
 * Compute a stable sha256 over the identity-bearing fields of a provenance
 * seed. Lower-case hex.
 *
 * Field order is FIXED — do NOT reorder; the same input must always produce
 * the same hash. Increment llm_inferred_schema_version when the inference
 * output format changes (so old + new schema versions don't collide).
 */
export function computeProvenanceHash(seed: ProvenanceSeed): string {
  const payload = [
    seed.file_hash,
    seed.conversation_id,
    seed.ingest_plan_id,
    String(seed.row_idx),
    seed.llm_inferred_schema_version,
  ].join(':');
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Build a full provenance record from a seed. The timestamp is preserved
 * exactly; the caller is responsible for any clock-stability concerns.
 */
export function buildProvenance(seed: ProvenanceSeed): Provenance {
  const hash = computeProvenanceHash(seed);
  return Object.freeze({
    file_hash: seed.file_hash,
    conversation_id: seed.conversation_id,
    message_id: seed.message_id,
    row_idx: seed.row_idx,
    llm_inferred_schema_version: seed.llm_inferred_schema_version,
    ingest_plan_id: seed.ingest_plan_id,
    timestamp: seed.timestamp,
    hash,
  });
}

/**
 * Hash arbitrary file bytes. Used by callers to derive file_hash for a
 * Provenance record from the original upload.
 */
export function hashFileBytes(bytes: Uint8Array | Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}
