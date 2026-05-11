/**
 * Tests for the bank-EFT placeholder adapter.
 */
import { describe, it, expect } from 'vitest';

import { createEftStubAdapter } from '../eft-stub-adapter';
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
  it('returns failed with eft_not_implemented for a valid input', async () => {
    const adapter = createEftStubAdapter();
    const result = await adapter.send(INPUT);
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('eft_not_implemented');
    expect(result.providerRef).toContain('tenant-eft');
    expect(result.providerRef).toContain('eft-1');
  });

  it('rejects unsupported currencies when the supported list is configured', async () => {
    const adapter = createEftStubAdapter({ supportedCurrencies: ['TZS'] });
    const result = await adapter.send({ ...INPUT, currency: 'USD' });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('eft_unsupported_currency_USD');
  });

  it('accepts currencies in the supported list', async () => {
    const adapter = createEftStubAdapter({ supportedCurrencies: ['TZS', 'KES'] });
    const result = await adapter.send({ ...INPUT, currency: 'TZS' });
    expect(result.failureReason).toBe('eft_not_implemented');
  });

  it('rejects negative amounts', async () => {
    const adapter = createEftStubAdapter();
    const result = await adapter.send({ ...INPUT, amountMinor: -1 });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('eft_invalid_amount');
  });

  it('rejects empty destination', async () => {
    const adapter = createEftStubAdapter();
    const result = await adapter.send({ ...INPUT, destination: '   ' });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('eft_missing_destination');
  });

  it('preserves tenant id in the provider ref so audit rows are traceable', async () => {
    const adapter = createEftStubAdapter();
    const result = await adapter.send({ ...INPUT, tenantId: 'tenant-XYZ' });
    expect(result.providerRef).toContain('tenant-XYZ');
  });
});
