/**
 * Provenance — every attribute carries a `source` envelope so we can
 * answer "where did this value come from?" for any cell in the store.
 *
 * Required: `timestamp` (ISO-8601). At least one origin signal must be
 * present (file_hash, conversation_id, manual, llm_research, or
 * llm_inferred_schema_version). The service validates this on every
 * insert / addAttribute / applyProvenance call.
 *
 * Examples:
 *
 *   // MD auto-creates employee from chat
 *   {
 *     conversationId: 'conv_2026_05_19_md_001',
 *     messageId: 'msg_42',
 *     llmInferredSchemaVersion: 1,
 *     timestamp: '2026-05-19T10:00:00Z',
 *   }
 *
 *   // Bulk-import from spreadsheet
 *   {
 *     fileHash: 'sha256:...',
 *     rowIdx: 17,
 *     timestamp: '2026-05-19T10:00:00Z',
 *   }
 *
 *   // Internal admin types it by hand
 *   { manual: true, timestamp: '2026-05-19T10:00:00Z' }
 *
 *   // MD did web research and pulled the answer
 *   {
 *     llmResearch: true,
 *     conversationId: 'conv_...',
 *     timestamp: '2026-05-19T10:00:00Z',
 *   }
 */

export interface ProvenanceSource {
  /** SHA-256 of an uploaded file the value came from (CSV row, PDF, ...). */
  readonly fileHash?: string;
  /** Brain conversation id the MD was in when it inferred / wrote the value. */
  readonly conversationId?: string;
  /** Specific message inside that conversation. */
  readonly messageId?: string;
  /** Row index inside the source file (paired with `fileHash`). */
  readonly rowIdx?: number;
  /** Version of the LLM-inferred schema used when the MD wrote this. */
  readonly llmInferredSchemaVersion?: number;
  /** True iff a human typed this value (internal-admin or owner). */
  readonly manual?: boolean;
  /** True iff the MD pulled this from a web-research tool call. */
  readonly llmResearch?: boolean;
  /** ISO-8601 timestamp — REQUIRED. */
  readonly timestamp: string;
}

/**
 * A provenance source MUST carry a timestamp AND at least one origin
 * signal. Empty envelopes are rejected at insert time.
 */
export class InvalidProvenanceError extends Error {
  constructor(reason: string) {
    super(`invalid provenance source: ${reason}`);
    this.name = 'InvalidProvenanceError';
  }
}

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Throws `InvalidProvenanceError` if the envelope is malformed.
 * Returns the envelope unchanged when valid.
 */
export function validateProvenance(source: ProvenanceSource): ProvenanceSource {
  if (!source) {
    throw new InvalidProvenanceError('source is required');
  }
  if (typeof source.timestamp !== 'string' || !ISO_8601.test(source.timestamp)) {
    throw new InvalidProvenanceError(
      `timestamp must be ISO-8601; got: ${String(source.timestamp)}`,
    );
  }
  const hasOrigin =
    typeof source.fileHash === 'string' ||
    typeof source.conversationId === 'string' ||
    typeof source.manual === 'boolean' ||
    typeof source.llmResearch === 'boolean' ||
    typeof source.llmInferredSchemaVersion === 'number';
  if (!hasOrigin) {
    throw new InvalidProvenanceError(
      'at least one origin signal required (fileHash | conversationId | manual | llmResearch | llmInferredSchemaVersion)',
    );
  }
  // Cross-field sanity: manual === true cannot co-exist with conversationId
  // on a NEW envelope. (We CAN have an applyProvenance call that adds
  // llmResearch onto an existing manual attribute — that goes through a
  // separate code path.)
  if (source.manual === true && typeof source.conversationId === 'string') {
    throw new InvalidProvenanceError(
      'manual envelope cannot also carry conversationId; use applyProvenance to attach later research',
    );
  }
  return source;
}

/**
 * Derive a human-readable label for ledger / audit views.
 */
export function summariseProvenance(source: ProvenanceSource): string {
  if (source.manual) return 'manual';
  if (source.llmResearch) return 'llm-research';
  if (typeof source.fileHash === 'string') {
    return `file:${source.fileHash.slice(0, 8)}${
      typeof source.rowIdx === 'number' ? `#${source.rowIdx}` : ''
    }`;
  }
  if (typeof source.conversationId === 'string') {
    return `chat:${source.conversationId.slice(0, 8)}`;
  }
  return 'unknown';
}
