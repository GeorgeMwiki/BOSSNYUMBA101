/**
 * Provenance carried by every attribute write. The shape is intentionally
 * narrow — anything that affects deterministic identity goes into the hash;
 * anything purely human-readable goes into the record.
 *
 * `hash` is computed from:
 *   sha256(
 *     file_hash || ':' || conversation_id || ':' || ingest_plan_id ||
 *     ':' || row_idx || ':' || llm_inferred_schema_version
 *   )
 *
 * The same row, ingested from the same file, by the same plan version, will
 * always produce the same provenance hash → idempotency.
 */
export interface Provenance {
  /** sha256 of the raw file bytes (lower-case hex). */
  readonly file_hash: string;
  /** Conversation in which the owner uploaded the file. */
  readonly conversation_id: string;
  /** The specific chat message that carried the file attachment. */
  readonly message_id: string;
  /** Zero-based row index within the inferred table. */
  readonly row_idx: number;
  /** Bump this whenever the schema-inference output format changes. */
  readonly llm_inferred_schema_version: string;
  /** Identifier of the IngestPlan that produced this write. */
  readonly ingest_plan_id: string;
  /** ISO-8601 timestamp at the moment the write was emitted. */
  readonly timestamp: string;
  /** Deterministic sha256 over the identity-bearing fields above. Lower-case hex. */
  readonly hash: string;
}

export interface ProvenanceSeed {
  readonly file_hash: string;
  readonly conversation_id: string;
  readonly message_id: string;
  readonly row_idx: number;
  readonly llm_inferred_schema_version: string;
  readonly ingest_plan_id: string;
  readonly timestamp: string;
}
