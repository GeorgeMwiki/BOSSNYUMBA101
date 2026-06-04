/**
 * Object-lock sink — key layout, retention mapping, fail-loud.
 */
import { describe, it, expect } from 'vitest';
import {
  createObjectLockSink,
  type ObjectPutPort,
  type ObjectPutRequest,
} from './s3-object-lock-sink';
import type { Clock } from './ports';
import type { SignedCheckpoint } from './types';

function fakePut(): { port: ObjectPutPort; calls: ObjectPutRequest[] } {
  const calls: ObjectPutRequest[] = [];
  return {
    calls,
    port: {
      async put(req) {
        calls.push(req);
        return { versionId: 'v-123' };
      },
    },
  };
}

const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });

const checkpoint: SignedCheckpoint = {
  payload: {
    chainId: 'rent_ledger:tenant-1:account-9',
    merkleRoot: 'abc123',
    leafCount: 10,
    headIndex: 9,
    prevRoot: null,
    attestedAtIso: '2026-06-03T01:00:00.000Z',
  },
  signature: { algorithm: 'ed25519', keyId: 'ed25519:deadbeef', signatureB64: 'sig' },
};

describe('createObjectLockSink', () => {
  it('writes a sortable object key under the prefix and returns an object locator', async () => {
    const { port, calls } = fakePut();
    const sink = createObjectLockSink(port, {
      bucket: 'bossnyumba-attest',
      prefix: 'ledger-attestations',
      retentionDays: 365,
      clock: fixedClock('2026-06-03T01:00:00.000Z'),
    });

    const receipt = await sink.publish(checkpoint);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.bucket).toBe('bossnyumba-attest');
    expect(calls[0]?.key).toBe(
      'ledger-attestations/rent_ledger:tenant-1:account-9/2026-06-03T01:00:00.000Z-abc123.json',
    );
    expect(calls[0]?.retentionMode).toBe('COMPLIANCE');
    expect(receipt.sink).toBe('object-lock');
    expect(receipt.locator).toContain('s3://bossnyumba-attest/');
    expect(receipt.locator).toContain('#v-123');
  });

  it('maps retentionDays to a retain-until ISO date', async () => {
    const { port, calls } = fakePut();
    const sink = createObjectLockSink(port, {
      bucket: 'b',
      prefix: 'p',
      retentionDays: 10,
      clock: fixedClock('2026-01-01T00:00:00.000Z'),
    });
    await sink.publish(checkpoint);
    expect(calls[0]?.retainUntilIso).toBe('2026-01-11T00:00:00.000Z');
  });

  it('propagates a backend failure (fail-loud)', async () => {
    const port: ObjectPutPort = {
      async put() {
        throw new Error('object store unavailable');
      },
    };
    const sink = createObjectLockSink(port, {
      bucket: 'b',
      prefix: 'p',
      retentionDays: 1,
    });
    await expect(sink.publish(checkpoint)).rejects.toThrow(
      'object store unavailable',
    );
  });

  it('serialises the full signed checkpoint into the object body', async () => {
    const { port, calls } = fakePut();
    const sink = createObjectLockSink(port, {
      bucket: 'b',
      prefix: 'p',
      retentionDays: 1,
    });
    await sink.publish(checkpoint);
    const body = JSON.parse(calls[0]?.body ?? '{}') as SignedCheckpoint;
    expect(body.payload.merkleRoot).toBe('abc123');
    expect(body.signature.keyId).toBe('ed25519:deadbeef');
  });

  it('honours a GOVERNANCE retention mode override', async () => {
    const { port, calls } = fakePut();
    const sink = createObjectLockSink(port, {
      bucket: 'b',
      prefix: 'p',
      retentionDays: 1,
      retentionMode: 'GOVERNANCE',
    });
    await sink.publish(checkpoint);
    expect(calls[0]?.retentionMode).toBe('GOVERNANCE');
  });
});
