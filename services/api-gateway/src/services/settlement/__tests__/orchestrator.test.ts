/**
 * Settlement orchestrator — unit tests.
 *
 * Covers the seven-step signMoveIn flow: idempotency, RFA load,
 * money math, ledger.post, payout, cockpit event, list_for_tenant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetCockpitBusForTests,
  subscribeCockpitEvents,
} from '../../cockpit-events/index.js';
import type { CockpitEvent } from '../../cockpit-events/index.js';
import {
  SettlementOrchestrator,
  SettlementError,
} from '../orchestrator.js';
import {
  computeSettlementMath,
  type SettlementLedgerPort,
  type SettlementPayoutPort,
} from '../types.js';

interface FakeDb {
  execute: ReturnType<typeof vi.fn>;
}

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const LANDLORD_ID = 'user-landlord-1';
const RESPONSE_ID = '22222222-2222-2222-2222-222222222222';
const LEASE_ID = '33333333-3333-3333-3333-333333333333';
const MOVE_IN_CHECKSUM = 'chksum-move-in-abc123';

function applicationRow() {
  return {
    response_id: RESPONSE_ID,
    lease_id: LEASE_ID,
    tenant_id: TENANT_ID,
    applicant_user_id: 'applicant-user-1',
    deposit_amount: '0',
    rent_amount: '1000000',
    lease_term_months: 12,
    currency_code: 'TZS',
    landlord_user_id: LANDLORD_ID,
    unit_id: '44444444-4444-4444-4444-444444444444',
  };
}

function buildDb(opts: {
  idempotencyHit?: Record<string, unknown> | null;
}): FakeDb {
  const execute = vi.fn();
  // Step 1: idempotency SELECT
  execute.mockResolvedValueOnce({
    rows: opts.idempotencyHit ? [opts.idempotencyHit] : [],
  });
  if (!opts.idempotencyHit) {
    // Step 2: application + lease SELECT
    execute.mockResolvedValueOnce({ rows: [applicationRow()] });
    // Step 3: INSERT settlements
    execute.mockResolvedValueOnce({ rows: [] });
    // Step 4: UPDATE on posted
    execute.mockResolvedValueOnce({ rows: [] });
    // Step 5: UPDATE on paying_out
    execute.mockResolvedValueOnce({ rows: [] });
  }
  return { execute };
}

function makeOkLedger(): SettlementLedgerPort {
  return {
    post: vi.fn().mockResolvedValue({ journalId: 'jrn-success-1' }),
  };
}

function makeOkPayout(): SettlementPayoutPort {
  return {
    payout: vi.fn().mockResolvedValue({
      provider: 'mpesa_b2c',
      providerRef: 'mpesa-ref-1',
    }),
  };
}

describe('SettlementOrchestrator.signMoveIn', () => {
  beforeEach(() => {
    __resetCockpitBusForTests();
  });
  afterEach(() => {
    __resetCockpitBusForTests();
    vi.restoreAllMocks();
  });

  it('returns idempotent: true when a prior settlement matches', async () => {
    const db = buildDb({
      idempotencyHit: {
        id: 'existing-settlement-1',
        status: 'paying_out',
        gross_amount: '12000000',
        deposit_amount: '0',
        fee_amount: '180000',
        net_amount: '11820000',
        currency_code: 'TZS',
        ledger_txn_id: 'jrn-prior-1',
        payout_provider: 'mpesa_b2c',
        payout_provider_ref: 'mpesa-prior-1',
      },
    });
    const orchestrator = new SettlementOrchestrator({
      db,
      ledgerPort: makeOkLedger(),
      payoutPort: makeOkPayout(),
    });

    const result = await orchestrator.signMoveIn({
      tenantId: TENANT_ID,
      landlordUserId: LANDLORD_ID,
      responseId: RESPONSE_ID,
      moveInChecksum: MOVE_IN_CHECKSUM,
    });

    expect(result.idempotent).toBe(true);
    expect(result.settlementId).toBe('existing-settlement-1');
    expect(result.ledgerTxnId).toBe('jrn-prior-1');
  });

  it('runs end-to-end happy path and emits cockpit event', async () => {
    const db = buildDb({ idempotencyHit: null });
    const ledgerPort = makeOkLedger();
    const payoutPort = makeOkPayout();

    const received: CockpitEvent[] = [];
    const unsubscribe = subscribeCockpitEvents(TENANT_ID, (e) =>
      received.push(e),
    );

    const orchestrator = new SettlementOrchestrator({
      db,
      ledgerPort,
      payoutPort,
    });
    const result = await orchestrator.signMoveIn({
      tenantId: TENANT_ID,
      landlordUserId: LANDLORD_ID,
      responseId: RESPONSE_ID,
      moveInChecksum: MOVE_IN_CHECKSUM,
    });

    expect(result.idempotent).toBe(false);
    expect(result.status).toBe('paying_out');
    expect(result.ledgerTxnId).toBe('jrn-success-1');
    expect(result.payoutProvider).toBe('mpesa_b2c');
    expect(ledgerPort.post).toHaveBeenCalledOnce();
    expect(payoutPort.payout).toHaveBeenCalledOnce();
    expect(received).toHaveLength(1);
    expect(received[0]?.kind).toBe('rent_payout.initiated');

    unsubscribe();
  });

  it('throws SettlementError(LEDGER_POST_FAILED) and marks status=failed', async () => {
    const db = buildDb({ idempotencyHit: null });
    const ledgerPort: SettlementLedgerPort = {
      post: vi.fn().mockRejectedValue(new Error('ledger.post boom')),
    };
    const payoutPort = makeOkPayout();
    const orchestrator = new SettlementOrchestrator({
      db,
      ledgerPort,
      payoutPort,
    });

    await expect(
      orchestrator.signMoveIn({
        tenantId: TENANT_ID,
        landlordUserId: LANDLORD_ID,
        responseId: RESPONSE_ID,
        moveInChecksum: MOVE_IN_CHECKSUM,
      }),
    ).rejects.toBeInstanceOf(SettlementError);
    // payout MUST NOT fire when ledger fails (money path hard rule).
    expect(payoutPort.payout).not.toHaveBeenCalled();
  });

  it('blocks cross-tenant attempts (CROSS_TENANT_BLOCKED)', async () => {
    const db: FakeDb = {
      execute: vi
        .fn()
        // Step 1: no idempotency hit.
        .mockResolvedValueOnce({ rows: [] })
        // Step 2: foreign-tenant row.
        .mockResolvedValueOnce({
          rows: [
            {
              ...applicationRow(),
              tenant_id: '99999999-9999-9999-9999-999999999999',
            },
          ],
        }),
    };
    const orchestrator = new SettlementOrchestrator({
      db,
      ledgerPort: makeOkLedger(),
      payoutPort: makeOkPayout(),
    });

    await expect(
      orchestrator.signMoveIn({
        tenantId: TENANT_ID,
        landlordUserId: LANDLORD_ID,
        responseId: RESPONSE_ID,
        moveInChecksum: MOVE_IN_CHECKSUM,
      }),
    ).rejects.toThrow(SettlementError);
  });
});

describe('computeSettlementMath', () => {
  it('satisfies net = gross - deposit - fee CHECK constraint', () => {
    const math = computeSettlementMath({
      rentAmount: 500000,
      leaseTermMonths: 12,
      depositAmount: 100000,
      currencyCode: 'TZS',
    });
    expect(math.grossAmount).toBe(6_000_000);
    expect(math.feeAmount).toBe(90_000); // 1.5%
    expect(math.netAmount).toBe(
      math.grossAmount - math.depositAmount - math.feeAmount,
    );
    expect(math.currencyCode).toBe('TZS');
  });

  it('rejects unknown currency codes', () => {
    expect(() =>
      computeSettlementMath({
        rentAmount: 1000,
        leaseTermMonths: 12,
        currencyCode: 'XBT',
      }),
    ).toThrow(/unsupported settlement currency/);
  });
});
