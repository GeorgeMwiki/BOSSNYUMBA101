/**
 * Ledger attestor — shared domain types + boundary schemas.
 *
 * The attestor is pure orchestration: it pulls a chain segment, folds
 * it into a Merkle root, signs the root, and publishes the signed
 * checkpoint externally. Every domain type here is `readonly`. The zod
 * schemas validate at the package boundary (the {@link wireLedgerAttestor}
 * facade) so a malformed request is rejected before any port is touched.
 *
 * Every side effect lives behind an injected port — see `ports.ts`. The
 * orchestrator is therefore unit-testable with the in-memory reference
 * adapters (no object store, no KMS, no Postgres, no network).
 *
 * @module @bossnyumba/ledger-attestor/types
 */

import { z } from 'zod';

/**
 * One leaf the Merkle tree commits to. `index` is the chain position
 * (ascending append order); `rowHash` is the per-row hash already
 * computed by the upstream chain (`rowHash` in
 * `@bossnyumba/audit-hash-chain`, or the payments-ledger `thisHash`).
 */
export interface ChainLeaf {
  readonly index: number;
  readonly rowHash: string;
}

/**
 * A bounded slice of a single logical chain to attest. `chainId`
 * scopes the checkpoint (e.g. `ai_audit_chain`, or
 * `rent_ledger:{tenant}:{account}`) so independent streams attest
 * independently. `tenant` here is the property-renter / tenancy
 * org-scope — the multi-tenant boundary the ledger is partitioned by.
 */
export interface ChainSegment {
  readonly chainId: string;
  readonly leaves: ReadonlyArray<ChainLeaf>;
}

/** The bytes that get signed, plus enough metadata to reproduce them. */
export interface CheckpointPayload {
  readonly chainId: string;
  /** Merkle root (hex) over `leaves[0..leafCount-1]`. */
  readonly merkleRoot: string;
  /** Number of leaves committed (the chain length at attestation time). */
  readonly leafCount: number;
  /** Highest leaf index committed (leafCount - 1, or -1 when empty). */
  readonly headIndex: number;
  /** Prior checkpoint's merkleRoot for this chain, or null on first run. */
  readonly prevRoot: string | null;
  /** ISO 8601 attestation wall-clock. */
  readonly attestedAtIso: string;
}

/** A signature over the canonical form of a {@link CheckpointPayload}. */
export interface Signature {
  /** Signature algorithm, e.g. `ed25519`, `aws-kms:ECDSA_SHA_256`. */
  readonly algorithm: string;
  /** Opaque key identifier (KMS key ARN, key fingerprint, kid). */
  readonly keyId: string;
  /** Signature bytes, base64. */
  readonly signatureB64: string;
}

/** A fully-attested, signed checkpoint ready to publish. */
export interface SignedCheckpoint {
  readonly payload: CheckpointPayload;
  readonly signature: Signature;
}

/** An opaque receipt an external sink returns once a checkpoint lands. */
export interface ExternalSinkReceipt {
  readonly sink: string;
  /** Opaque locator the sink returns (versionId, log index, URL). */
  readonly locator: string;
}

/** Per-chain outcome of one attestation tick. */
export interface ChainAttestationOutcome {
  readonly chainId: string;
  readonly ok: boolean;
  readonly leafCount: number;
  readonly merkleRoot: string;
  readonly receipts: ReadonlyArray<ExternalSinkReceipt>;
  readonly skippedUnchanged: boolean;
  readonly error?: string;
}

/** Aggregate result of one attestation run across all chains. */
export interface AttestationRunResult {
  readonly attestedAtIso: string;
  readonly scanned: number;
  readonly attested: number;
  readonly skippedUnchanged: number;
  readonly failed: number;
  readonly outcomes: ReadonlyArray<ChainAttestationOutcome>;
}

// ---------------------------------------------------------------------------
// Boundary schemas (zod). Validated once, at the facade edge, in `wire.ts`.
// ---------------------------------------------------------------------------

/**
 * Numeric-input schema — a single chain leaf. `index` is a non-negative
 * integer (append order); `rowHash` is a non-empty hex-ish string. The
 * facade uses this to reject a malformed leaf before it can poison a
 * Merkle root.
 */
export const chainLeafSchema = z.object({
  index: z.number().int().nonnegative(),
  rowHash: z.string().min(1),
});

/**
 * Request schema for {@link LedgerAttestor.handle}. A run takes no
 * external input beyond an optional `dryRun` flag (compute + verify the
 * roots but skip signing/publishing), so the boundary guard simply
 * rejects anything that is not a well-formed request object.
 */
export const attestationRequestSchema = z
  .object({
    /** When true, compute roots only — do not sign or publish. */
    dryRun: z.boolean().optional(),
  })
  .strict();

/** Parsed, validated attestation request. */
export type AttestationRequest = z.infer<typeof attestationRequestSchema>;
