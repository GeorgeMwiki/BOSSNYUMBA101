/**
 * Attestor orchestrator regression.
 *
 * Locks the contract:
 *   - signs + publishes a checkpoint per chain; signature verifies
 *   - skip-unchanged when the chain root did not advance
 *   - prevRoot chains across runs once the chain grows
 *   - non-contiguous leaves fail that chain (do NOT sign a bad root)
 *   - a sink outage isolates to one chain (batch is not poisoned)
 *   - requires at least one sink
 *   - publishes to multiple sinks
 *   - dry-run computes a root but does not sign/publish
 */
import { describe, it, expect } from 'vitest';
import { runAttestation, type AttestorDeps } from './attestor.js';
import { serializeCheckpoint } from './checkpoint.js';
import { createEd25519Signer, verifyEd25519 } from './ed25519-signer.js';
import {
  createInMemorySink,
  createInMemoryCheckpointStore,
} from './in-memory-store.js';
import type { Clock, ChainSourcePort } from './ports.js';
import type { ChainSegment } from './types.js';

function sourceOf(segments: ReadonlyArray<ChainSegment>): ChainSourcePort {
  return { listSegments: async () => segments };
}

function leaves(n: number, startIndex = 0): ChainSegment['leaves'] {
  return Array.from({ length: n }, (_, i) => ({
    index: startIndex + i,
    rowHash: `hash-${startIndex + i}`,
  }));
}

const fixedClock: Clock = { now: () => new Date('2026-06-03T00:00:00.000Z') };

describe('runAttestation', () => {
  it('signs and publishes one checkpoint per chain, signature verifies', async () => {
    const { signer, publicKeyPem } = createEd25519Signer();
    const sink = createInMemorySink();
    const deps: AttestorDeps = {
      source: sourceOf([{ chainId: 'rent_ledger:t1:acc1', leaves: leaves(4) }]),
      signer,
      sinks: [sink],
      clock: fixedClock,
    };

    const result = await runAttestation(deps);

    expect(result.scanned).toBe(1);
    expect(result.attested).toBe(1);
    expect(result.failed).toBe(0);
    expect(sink.published()).toHaveLength(1);

    const published = sink.published()[0];
    expect(published?.payload.chainId).toBe('rent_ledger:t1:acc1');
    expect(published?.payload.leafCount).toBe(4);
    expect(published?.payload.headIndex).toBe(3);
    expect(published?.payload.prevRoot).toBeNull();
    // The signature over the canonical checkpoint must verify.
    expect(
      verifyEd25519(
        serializeCheckpoint(published!.payload),
        published!.signature,
        publicKeyPem,
      ),
    ).toBe(true);
  });

  it('skips a chain whose root did not advance since last checkpoint', async () => {
    const { signer } = createEd25519Signer();
    const sink = createInMemorySink();
    const store = createInMemoryCheckpointStore();
    const deps: AttestorDeps = {
      source: sourceOf([{ chainId: 'c1', leaves: leaves(3) }]),
      signer,
      sinks: [sink],
      store,
    };

    const first = await runAttestation(deps);
    expect(first.attested).toBe(1);
    expect(first.skippedUnchanged).toBe(0);

    const second = await runAttestation(deps);
    expect(second.attested).toBe(0);
    expect(second.skippedUnchanged).toBe(1);
    // No second publish — only the first checkpoint exists.
    expect(sink.published()).toHaveLength(1);
  });

  it('chains prevRoot once the chain grows', async () => {
    const { signer } = createEd25519Signer();
    const sink = createInMemorySink();
    const store = createInMemoryCheckpointStore();

    const run1 = await runAttestation({
      source: sourceOf([{ chainId: 'c1', leaves: leaves(2) }]),
      signer,
      sinks: [sink],
      store,
    });
    const root1 = run1.outcomes[0]?.merkleRoot;

    const run2 = await runAttestation({
      source: sourceOf([{ chainId: 'c1', leaves: leaves(5) }]),
      signer,
      sinks: [sink],
      store,
    });

    expect(run2.attested).toBe(1);
    const second = sink.published()[1];
    expect(second?.payload.prevRoot).toBe(root1);
    expect(second?.payload.leafCount).toBe(5);
  });

  it('fails a chain with non-contiguous leaves without signing', async () => {
    const { signer } = createEd25519Signer();
    const sink = createInMemorySink();
    const deps: AttestorDeps = {
      source: sourceOf([
        {
          chainId: 'gappy',
          leaves: [
            { index: 0, rowHash: 'h0' },
            { index: 2, rowHash: 'h2' }, // gap: missing index 1
          ],
        },
      ]),
      signer,
      sinks: [sink],
    };

    const result = await runAttestation(deps);
    expect(result.failed).toBe(1);
    expect(result.attested).toBe(0);
    expect(result.outcomes[0]?.error).toContain('non_contiguous_leaves');
    expect(sink.published()).toHaveLength(0);
  });

  it('isolates a sink outage to the failing chain', async () => {
    const { signer } = createEd25519Signer();
    // Sink fails only for chain "bad".
    const sink = createInMemorySink('flaky', { failOnChainId: 'bad' });
    const deps: AttestorDeps = {
      source: sourceOf([
        { chainId: 'good', leaves: leaves(2) },
        { chainId: 'bad', leaves: leaves(2) },
      ]),
      signer,
      sinks: [sink],
    };

    const result = await runAttestation(deps);
    expect(result.scanned).toBe(2);
    expect(result.attested).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.outcomes.find((o) => o.chainId === 'good')?.ok).toBe(true);
    expect(result.outcomes.find((o) => o.chainId === 'bad')?.ok).toBe(false);
  });

  it('throws when no sink is configured', async () => {
    const { signer } = createEd25519Signer();
    await expect(
      runAttestation({ source: sourceOf([]), signer, sinks: [] }),
    ).rejects.toThrow(/at least one ExternalSinkPort/);
  });

  it('publishes to every configured sink', async () => {
    const { signer } = createEd25519Signer();
    const objectLock = createInMemorySink('object-lock');
    const log = createInMemorySink('transparency-log');
    const result = await runAttestation({
      source: sourceOf([{ chainId: 'c1', leaves: leaves(1) }]),
      signer,
      sinks: [objectLock, log],
    });
    expect(result.outcomes[0]?.receipts).toHaveLength(2);
    expect(objectLock.published()).toHaveLength(1);
    expect(log.published()).toHaveLength(1);
  });

  it('handles an empty chain (genesis, no leaves) without error', async () => {
    const { signer } = createEd25519Signer();
    const sink = createInMemorySink();
    const result = await runAttestation({
      source: sourceOf([{ chainId: 'empty', leaves: [] }]),
      signer,
      sinks: [sink],
    });
    expect(result.failed).toBe(0);
    expect(result.outcomes[0]?.leafCount).toBe(0);
    expect(sink.published()[0]?.payload.headIndex).toBe(-1);
  });

  it('dry-run computes a root but does not sign or publish', async () => {
    const { signer } = createEd25519Signer();
    const sink = createInMemorySink();
    const result = await runAttestation({
      source: sourceOf([{ chainId: 'c1', leaves: leaves(3) }]),
      signer,
      sinks: [sink],
      dryRun: true,
    });
    expect(result.attested).toBe(1);
    expect(result.outcomes[0]?.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
    expect(result.outcomes[0]?.receipts).toHaveLength(0);
    // Nothing was published in dry-run.
    expect(sink.published()).toHaveLength(0);
  });

  it('degrades to an empty tick when the source throws (read-only fail-soft)', async () => {
    const { signer } = createEd25519Signer();
    const sink = createInMemorySink();
    const throwingSource: ChainSourcePort = {
      listSegments: async () => {
        throw new Error('source db unreachable');
      },
    };
    const result = await runAttestation({
      source: throwingSource,
      signer,
      sinks: [sink],
    });
    expect(result.scanned).toBe(0);
    expect(result.attested).toBe(0);
    expect(result.failed).toBe(0);
    expect(sink.published()).toHaveLength(0);
  });
});
