/**
 * In-memory external sink + checkpoint store — tests/dev reference adapter.
 *
 * Map-backed implementations of {@link ExternalSinkPort} and
 * {@link CheckpointStorePort}. NOT for production: a process restart
 * loses every checkpoint, which defeats the tamper-evidence guarantee.
 * Production wires an object-lock sink (see `s3-object-lock-sink.ts`)
 * and a durable checkpoint store. These exist so the orchestrator is
 * exercisable end-to-end in a unit test with no external infra.
 *
 * @module @bossnyumba/ledger-attestor/in-memory-store
 */

import type {
  CheckpointStorePort,
  ExternalSinkPort,
} from './ports.js';
import type {
  ExternalSinkReceipt,
  SignedCheckpoint,
} from './types.js';

export interface InMemorySink extends ExternalSinkPort {
  /** Every checkpoint published, in order (test assertions). */
  readonly published: () => ReadonlyArray<SignedCheckpoint>;
}

export interface InMemorySinkOptions {
  /** Simulate a sink outage for one chain to exercise fail-isolation. */
  readonly failOnChainId?: string;
}

/**
 * Build an in-memory sink. `failOnChainId` lets a test simulate a sink
 * outage to exercise the orchestrator's per-chain fail-isolation.
 */
export function createInMemorySink(
  name = 'in-memory',
  opts: InMemorySinkOptions = {},
): InMemorySink {
  const published: SignedCheckpoint[] = [];
  let seq = 0;
  return {
    name,
    published: () => published.slice(),
    async publish(checkpoint: SignedCheckpoint): Promise<ExternalSinkReceipt> {
      if (
        opts.failOnChainId !== undefined &&
        checkpoint.payload.chainId === opts.failOnChainId
      ) {
        throw new Error(
          `simulated_sink_failure chain=${checkpoint.payload.chainId}`,
        );
      }
      published.push(checkpoint);
      seq += 1;
      return Object.freeze({ sink: name, locator: `mem://${name}/${seq}` });
    },
  };
}

interface CheckpointRow {
  readonly checkpoint: SignedCheckpoint;
  readonly receipts: ReadonlyArray<ExternalSinkReceipt>;
}

/**
 * In-memory checkpoint history keyed by chainId (Map-backed).
 * Append-only; `latestFor` returns the most recently appended
 * checkpoint for the chain, or null.
 */
export function createInMemoryCheckpointStore(): CheckpointStorePort {
  const byChain = new Map<string, CheckpointRow[]>();
  return {
    async latestFor(chainId: string): Promise<SignedCheckpoint | null> {
      const rows = byChain.get(chainId);
      if (rows === undefined || rows.length === 0) return null;
      const last = rows[rows.length - 1];
      return last ? last.checkpoint : null;
    },
    async append(
      checkpoint: SignedCheckpoint,
      receipts: ReadonlyArray<ExternalSinkReceipt>,
    ): Promise<void> {
      const chainId = checkpoint.payload.chainId;
      const existing = byChain.get(chainId) ?? [];
      byChain.set(chainId, [...existing, { checkpoint, receipts }]);
    },
  };
}
