/**
 * Tests for the bank-EFT placeholder adapter.
 *
 * Phase D update: the adapter now FAILS LOUD instead of returning a
 * benign `'failed'` row. Valid inputs throw `EftNotConfiguredError`;
 * invalid inputs still return `'failed'` so callers can distinguish
 * "input was malformed" from "no bank rail bound".
 */
import { describe, it, expect } from 'vitest';

import { createEftStubAdapter, EftNotConfiguredError } from '../eft-stub-adapter';
import type { PayoutProviderInput } from '../../stub-payout-provider';

const INPUT: PayoutProviderInput = {
  tenantId: 'tenant-eft',
  ownerId: 'owner-eft',
  amountMinor: 12_000,
  currency: 'TZS',
  destination: 'NMB:0150123456789',
  idempotencyKey: 'eft-1',
};

describe('createEftStubAdapter', () => {
  it('throws EftNotConfiguredError for a valid input (loud-failure)', async () => {
    const adapter = createEftStubAdapter();
    await expect(adapter.send(INPUT)).rejects.toBeInstanceOf(EftNotConfiguredError);
  });

  it('rejects negative amounts BEFORE the loud refusal', async () => {
    const adapter = createEftStubAdapter();
    const result = await adapter.send({ ...INPUT, amountMinor: -1 });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('eft_invalid_amount');
  });

  it('rejects empty destination BEFORE the loud refusal', async () => {
    const adapter = createEftStubAdapter();
    const result = await adapter.send({ ...INPUT, destination: '   ' });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('eft_missing_destination');
  });

  it('surfaces tenantId in the error message so DLQ rows are traceable', async () => {
    const adapter = createEftStubAdapter();
    let caught: unknown = null;
    try {
      await adapter.send({ ...INPUT, tenantId: 'tenant-XYZ' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(EftNotConfiguredError);
    expect((caught as Error).message).toContain('tenant-XYZ');
  });
});
