/**
 * Citation — provenance attached to every value the MD emits inline
 * in chat. Structurally compatible with K-F's `agent-surface`
 * Citation. Mirrors the J1 ProvenanceSource flavour: every cell the
 * renderer shows MUST point back to (entityId, attributeKey,
 * attributeVersion) so the owner can ask "where did that come from?"
 * and the MD can produce the receipt.
 *
 * The renderer doesn't require citations on every cell — but tab
 * views built from J1 entity data SHOULD attach them so the
 * MD can answer follow-up questions like "show me the lease that
 * generated that arrears row".
 */

export type CitationConfidence = 'high' | 'medium' | 'low';

export interface Citation {
  /** Stable id — used as the React key and for de-dup. */
  readonly id: string;
  /** Human-readable label, e.g. "Lease #L-204 page 3". */
  readonly label: string;
  /** Optional URI to the source. */
  readonly sourceUri?: string;
  /** Optional pointer within the source (row id, page, paragraph). */
  readonly sourceLocator?: string;
  /** J1 entity id this citation came from. */
  readonly entityId?: string;
  /** The J1 attribute key + version, when relevant. */
  readonly attributeKey?: string;
  /** Monotonic per (entity_id, key); the version we read. */
  readonly attributeVersion?: number;
  /** How confident the MD is that this value is current + correct. */
  readonly confidence?: CitationConfidence;
}

/**
 * A row of cells with optional per-cell citations. The renderer
 * looks for `__citations` (record keyed by accessorKey) on each
 * row of a `data-table` part. We hide the citations behind a
 * "show provenance" disclosure in the standalone tab.
 */
export interface CitedRow {
  readonly __citations?: Readonly<Record<string, Citation>>;
  readonly [field: string]: unknown;
}
