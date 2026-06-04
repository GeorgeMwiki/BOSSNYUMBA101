/**
 * Ledger attestor orchestrator — pure composition over ports.
 *
 * One tick:
 *   1. `source.listSegments()` — pull every chain segment to attest
 *      (read-only, wrapped in `safeFetch` so a source outage degrades
 *      to an empty tick instead of crashing).
 *   2. For each segment, compute the Merkle root over its leaves
 *      (append order). Verify leaf indices are contiguous + ascending
 *      so a dropped/duplicated row is caught before we sign a root.
 *   3. If a prior checkpoint exists with the SAME root, skip (the chain
 *      did not advance) — idempotent, cheap re-runs.
 *   4. Sign the canonical checkpoint via the injected `SignerPort`.
 *   5. Publish to EVERY `ExternalSinkPort` (object-lock WORM store /
 *      transparency log). A sink throwing fails THAT chain only.
 *   6. Append the signed checkpoint + receipts to the optional store.
 *
 * Fail-isolation: a single bad chain (verify failure, signer error,
 * sink outage) is caught + logged and recorded as a failed outcome; it
 * never poisons the other chains in the batch. The run result carries
 * per-chain outcomes so the caller (cron) can alert on `failed > 0`.
 *
 * @module @bossnyumba/ledger-attestor/attestor
 */

import { serializeCheckpoint } from './checkpoint.js';
import { computeMerkleRoot } from './merkle.js';
import {
  emitAudit,
  noopLogger,
  safeFetch,
  systemClock,
  type AttestorLogger,
  type AuditSinkPort,
  type ChainSourcePort,
  type CheckpointStorePort,
  type Clock,
  type ExternalSinkPort,
  type SignerPort,
} from './ports.js';
import type {
  AttestationRunResult,
  ChainAttestationOutcome,
  ChainSegment,
  CheckpointPayload,
  ExternalSinkReceipt,
  SignedCheckpoint,
} from './types.js';

export interface AttestorDeps {
  readonly source: ChainSourcePort;
  readonly signer: SignerPort;
  /** One or more external WORM sinks. At least one is required. */
  readonly sinks: ReadonlyArray<ExternalSinkPort>;
  /** Optional local checkpoint history (enables prevRoot + skip-unchanged). */
  readonly store?: CheckpointStorePort;
  readonly logger?: AttestorLogger;
  /** Optional fire-and-forget audit sink (never awaited on the hot path). */
  readonly audit?: AuditSinkPort;
  /** Injectable clock for deterministic tests. Defaults to wall-clock. */
  readonly clock?: Clock;
  /** When true, compute + verify roots but skip signing/publishing. */
  readonly dryRun?: boolean;
}

/**
 * Verify the segment's leaves are a contiguous ascending run. A gap or
 * duplicate index means the source query is wrong (or rows were
 * tampered) — we must NOT sign a root over a malformed segment.
 */
function assertContiguous(segment: ChainSegment): void {
  for (let i = 0; i < segment.leaves.length; i += 1) {
    const current = segment.leaves[i];
    const first = segment.leaves[0];
    const prev = segment.leaves[i - 1];
    if (current === undefined || first === undefined) continue;
    const expected = i === 0 ? first.index : (prev?.index ?? first.index) + 1;
    if (current.index !== expected) {
      throw new Error(
        `non_contiguous_leaves chain=${segment.chainId} at_position=${i} ` +
          `expected_index=${expected} got=${current.index}`,
      );
    }
  }
}

async function attestSegment(
  segment: ChainSegment,
  deps: AttestorDeps,
  attestedAtIso: string,
): Promise<ChainAttestationOutcome> {
  const logger = deps.logger ?? noopLogger;
  try {
    assertContiguous(segment);

    const merkleRoot = computeMerkleRoot(segment.leaves.map((l) => l.rowHash));
    const leafCount = segment.leaves.length;
    const lastLeaf = segment.leaves[leafCount - 1];
    const headIndex = leafCount > 0 && lastLeaf ? lastLeaf.index : -1;

    const prior = deps.store ? await deps.store.latestFor(segment.chainId) : null;
    const prevRoot = prior ? prior.payload.merkleRoot : null;

    // Skip-unchanged: the chain has not advanced since the last
    // checkpoint. Cheap, idempotent re-runs (cron can fire freely).
    if (prior !== null && prior.payload.merkleRoot === merkleRoot) {
      logger.info(
        { chainId: segment.chainId, merkleRoot, leafCount },
        'attestor: chain unchanged since last checkpoint, skipping',
      );
      return {
        chainId: segment.chainId,
        ok: true,
        leafCount,
        merkleRoot,
        receipts: [],
        skippedUnchanged: true,
      };
    }

    const payload: CheckpointPayload = {
      chainId: segment.chainId,
      merkleRoot,
      leafCount,
      headIndex,
      prevRoot,
      attestedAtIso,
    };

    // Dry run: prove the root computes + verifies, but do not sign or
    // publish. Useful for a pre-flight check from the composition root.
    if (deps.dryRun === true) {
      logger.info(
        { chainId: segment.chainId, merkleRoot, leafCount },
        'attestor: dry-run, root computed but not signed/published',
      );
      return {
        chainId: segment.chainId,
        ok: true,
        leafCount,
        merkleRoot,
        receipts: [],
        skippedUnchanged: false,
      };
    }

    const signature = await deps.signer.sign(serializeCheckpoint(payload));
    const signed: SignedCheckpoint = { payload, signature };

    const receipts: ExternalSinkReceipt[] = [];
    for (const sink of deps.sinks) {
      receipts.push(await sink.publish(signed));
    }

    if (deps.store) await deps.store.append(signed, receipts);

    logger.info(
      { chainId: segment.chainId, merkleRoot, leafCount, sinks: receipts.length },
      'attestor: checkpoint signed + published',
    );
    emitAudit(deps.audit, {
      kind: 'ledger_attestation.published',
      chainId: segment.chainId,
      merkleRoot,
      leafCount,
      sinks: receipts.length,
      attestedAtIso,
    });
    return {
      chainId: segment.chainId,
      ok: true,
      leafCount,
      merkleRoot,
      receipts,
      skippedUnchanged: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { chainId: segment.chainId, error: message },
      'attestor: chain attestation FAILED',
    );
    emitAudit(deps.audit, {
      kind: 'ledger_attestation.failed',
      chainId: segment.chainId,
      error: message,
      attestedAtIso,
    });
    return {
      chainId: segment.chainId,
      ok: false,
      leafCount: segment.leaves.length,
      merkleRoot: '',
      receipts: [],
      skippedUnchanged: false,
      error: message,
    };
  }
}

/**
 * Run one attestation tick across every chain the source advertises.
 * Never throws on a per-chain failure — those are isolated and surfaced
 * in the result so the caller can alert. At least one sink MUST be
 * configured (the single precondition that throws).
 */
export async function runAttestation(deps: AttestorDeps): Promise<AttestationRunResult> {
  if (deps.sinks.length === 0) {
    throw new Error('runAttestation requires at least one ExternalSinkPort');
  }
  const clock = deps.clock ?? systemClock;
  const attestedAtIso = clock.now().toISOString();

  // Read-only source fetch: a throw degrades to an empty tick (undefined)
  // rather than crashing the worker.
  const segments = (await safeFetch(() => deps.source.listSegments())) ?? [];

  const outcomes: ChainAttestationOutcome[] = [];
  for (const segment of segments) {
    outcomes.push(await attestSegment(segment, deps, attestedAtIso));
  }

  const attested = outcomes.filter((o) => o.ok && !o.skippedUnchanged).length;
  const skippedUnchanged = outcomes.filter((o) => o.skippedUnchanged).length;
  const failed = outcomes.filter((o) => !o.ok).length;

  return {
    attestedAtIso,
    scanned: segments.length,
    attested,
    skippedUnchanged,
    failed,
    outcomes,
  };
}
