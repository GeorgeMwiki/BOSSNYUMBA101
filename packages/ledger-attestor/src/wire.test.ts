/**
 * Wire facade regression — flag constant, default-OFF, bound facade,
 * happy path, and zod boundary rejection.
 */
import { describe, it, expect } from 'vitest';
import {
  wireLedgerAttestor,
  LEDGER_ATTESTOR_FLAG,
  type WireLedgerAttestorDeps,
} from './wire';
import { createEd25519Signer } from './ed25519-signer';
import { createInMemorySink } from './in-memory-store';
import type { ChainSourcePort } from './ports';
import type { ChainSegment } from './types';

function sourceOf(segments: ReadonlyArray<ChainSegment>): ChainSourcePort {
  return { listSegments: async () => segments };
}

function baseDeps(enabled: boolean): WireLedgerAttestorDeps {
  const { signer } = createEd25519Signer();
  return {
    enabled,
    signer,
    source: sourceOf([
      {
        chainId: 'rent_ledger:t1:acc1',
        leaves: [
          { index: 0, rowHash: 'h0' },
          { index: 1, rowHash: 'h1' },
        ],
      },
    ]),
    sinks: [createInMemorySink()],
    clock: { now: () => new Date('2026-06-03T00:00:00.000Z') },
  };
}

describe('wireLedgerAttestor', () => {
  it('(a) exposes the canonical BossNyumba feature-flag name', () => {
    expect(LEDGER_ATTESTOR_FLAG).toBe('BOSSNYUMBA_FEATURE_LEDGER_ATTESTOR');
  });

  it('(b) returns null when the flag is off (default-OFF)', () => {
    expect(wireLedgerAttestor(baseDeps(false))).toBeNull();
  });

  it('(c) returns a bound facade when enabled', () => {
    const attestor = wireLedgerAttestor(baseDeps(true));
    expect(attestor).not.toBeNull();
    expect(typeof attestor?.handle).toBe('function');
  });

  it('(d) facade handles a happy-path attestation tick', async () => {
    const deps = baseDeps(true);
    const attestor = wireLedgerAttestor(deps);
    const result = await attestor!.handle();
    expect(result.scanned).toBe(1);
    expect(result.attested).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.outcomes[0]?.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
  });

  it('(d2) facade forwards a valid dryRun flag through the boundary', async () => {
    const sink = createInMemorySink();
    const deps = { ...baseDeps(true), sinks: [sink] };
    const attestor = wireLedgerAttestor(deps);
    const result = await attestor!.handle({ dryRun: true });
    expect(result.attested).toBe(1);
    // Dry-run: root computed, nothing published.
    expect(sink.published()).toHaveLength(0);
  });

  it('(e) rejects a malformed input via the zod boundary (no raw throw escapes)', async () => {
    const attestor = wireLedgerAttestor(baseDeps(true));
    // Unknown key violates the .strict() request schema.
    const bad = { notARealField: 123 } as unknown as { dryRun?: boolean };
    await expect(attestor!.handle(bad)).rejects.toThrow(
      /invalid_attestation_request/,
    );
  });

  it('(e2) rejects a wrong-typed dryRun via the zod boundary', async () => {
    const attestor = wireLedgerAttestor(baseDeps(true));
    const bad = { dryRun: 'yes' } as unknown as { dryRun?: boolean };
    await expect(attestor!.handle(bad)).rejects.toThrow(
      /invalid_attestation_request/,
    );
  });
});
