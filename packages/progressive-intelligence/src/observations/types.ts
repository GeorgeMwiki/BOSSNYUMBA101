/**
 * PI-A · observations — every new attribute observation the platform makes.
 *
 * An ObservationEvent is the universal envelope every signal-of-change passes
 * through before it can become an actual entity write. It records:
 *
 *  • the entity (kind + id) the observation is about
 *  • the attribute being observed and the proposed new value
 *  • the source (chat text, attached file, ingest pipeline, connector,
 *    sub-agent research, manual edit), with its own confidence reading
 *  • EvidenceRef[] — at least one provable pointer to the substrate that
 *    produced the observation (file + row, message + turn, connector response
 *    + path), so the owner can always trace back and the platform can
 *    re-verify
 *
 * Downstream, the confidence module decides whether to auto-apply, suggest
 * inline, or queue to evidence-pending. The history module records every
 * applied change. Soft-delete + change-tracking + evidence-pending close the
 * loop so the owner is always in control.
 */

/**
 * The kind of source that produced this observation. The base-rate weight in
 * the confidence model is derived from this discriminator.
 */
export type ObservationSourceKind =
  | 'chat-text'
  | 'chat-attachment'
  | 'ingest-file'
  | 'connector-api'
  | 'subagent-research'
  | 'manual-edit';

/**
 * The kind of substrate an EvidenceRef points to. Each variant pairs with a
 * canonical identifier convention that the renderer can resolve.
 */
export type EvidenceKind =
  | 'chat-message'
  | 'file-row'
  | 'connector-response'
  | 'subagent-citation'
  | 'manual-edit-actor';

/**
 * A single, dereferenceable pointer to the substrate that produced this
 * observation. Every observation MUST carry at least one evidence ref — the
 * empty set is rejected at construction time so the platform never invents
 * facts without provenance.
 *
 * `hash` is a stable identifier of the evidence content (lower-case hex
 * sha256, computed by the caller — usually identical to the parent file
 * hash or the message hash). The change-tracking module uses this hash for
 * idempotency so the same evidence cannot be double-counted toward
 * cross-source corroboration.
 */
export interface EvidenceRef {
  readonly kind: EvidenceKind;
  /** Canonical id of the substrate row (e.g. file_id, message_id, connector_run_id, subagent_run_id, user_id). */
  readonly identifier: string;
  /** Optional human-readable excerpt for chat display. */
  readonly excerpt?: string;
  /** Lower-case hex sha256 over the evidence content. */
  readonly hash: string;
}

/**
 * The source descriptor on an ObservationEvent. `confidence` is the
 * source-emitted "verbalized" confidence in [0, 1], consumed by M-E. The
 * confidence module fuses this with other factors to produce the final tier.
 */
export interface ObservationSource {
  readonly kind: ObservationSourceKind;
  /** Stable reference within the source kind (e.g. message_id for chat-text). */
  readonly ref: string;
  /** Source-emitted confidence in [0, 1]. */
  readonly confidence: number;
  /** ISO-8601 timestamp at the moment of observation. */
  readonly observedAt: string;
}

/**
 * The complete observation envelope. Frozen on construction; mutation is a
 * type error (immutability per house style).
 */
export interface ObservationEvent {
  readonly tenantId: string;
  readonly entityId: string;
  /** Logical entity kind (employee, lead, property, lease, etc.). */
  readonly entityKind: string;
  readonly attributeKey: string;
  readonly observedValue: unknown;
  readonly source: ObservationSource;
  readonly evidence: ReadonlyArray<EvidenceRef>;
}
