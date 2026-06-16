/**
 * Finding 2 (HIGH) — the full M-Pesa B2C payout path.
 *
 * Before this fix, the B2C result/timeout webhooks did nothing (a comment said
 * "in a full implementation…"), `mpesaProvider` was never registered with the
 * DisbursementService (so a mobile-money payout could only be attempted via
 * Stripe), and `getTransferStatus` threw a bare error. These tests pin:
 *
 *   1. A B2C result with ResultCode 0 marks the matching disbursement PAID.
 *   2. A failed B2C result transitions it to NEEDS_REVERSAL (NOT a clean FAILED)
 *      so the disbursement-reconciliation job (which filters NEEDS_REVERSAL)
 *      consumes it.
 *   3. A B2C QUEUE TIMEOUT flags NEEDS_REVERSAL (debited, undelivered, no result
 *      will arrive).
 *   4. Provider selection routes a mobile-money destination / KES currency
 *      to the M-Pesa rail and a connected-account destination to Stripe. (TZS
 *      is intentionally NOT mobile-money yet — no TZS provider registered.)
 *   5. `MpesaPaymentProvider.getTransferStatus` throws the typed callback-only
 *      signal the reconciliation sweep relies on.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  Money,
  type CurrencyCode,
  type OwnerId,
  type TenantId,
} from '@bossnyumba/domain-models';
import { DisbursementService } from '../services/disbursement.service';
import {
  isMobileMoneyCurrency,
  looksLikePhoneNumber,
} from '../services/disbursement.service';
import { LedgerService } from '../services/ledger.service';
import { InMemoryAccountRepository } from '../repositories/account.repository';
import { InMemoryLedgerRepository } from '../repositories/ledger.repository';
import {
  InMemoryDisbursementRepository,
  type Disbursement,
} from '../repositories/disbursement.repository';
import { InMemoryEventPublisher } from '../events/event-publisher';
import {
  MpesaPaymentProvider,
  MpesaCallbackOnlyStatusError,
} from '../providers/mpesa-provider';
import type {
  IPaymentProvider,
  TransferResult,
} from '../providers/payment-provider.interface';

const TENANT = 'tnt_b2c' as TenantId;
const OWNER = 'owner_b2c' as OwnerId;
const CUR = 'KES' as CurrencyCode;
const CONVERSATION_ID = 'AG_20260614_B2C_123';

const silentLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

function makeService(): {
  service: DisbursementService;
  disbursementRepo: InMemoryDisbursementRepository;
} {
  const accountRepository = new InMemoryAccountRepository();
  const disbursementRepo = new InMemoryDisbursementRepository();
  const ledgerService = new LedgerService({
    ledgerRepository: new InMemoryLedgerRepository(),
    accountRepository,
    eventPublisher: new InMemoryEventPublisher(),
    logger: silentLogger,
  });
  const service = new DisbursementService({
    accountRepository,
    disbursementRepository: disbursementRepo,
    ledgerService,
    eventPublisher: new InMemoryEventPublisher(),
    logger: silentLogger,
  });
  return { service, disbursementRepo };
}

/** Seed a PROCESSING M-Pesa disbursement keyed by ConversationID (transferId). */
async function seedProcessing(
  repo: InMemoryDisbursementRepository,
  conversationId = CONVERSATION_ID,
): Promise<Disbursement> {
  const now = new Date();
  const row: Disbursement = {
    id: `disb_${conversationId}`,
    tenantId: TENANT,
    ownerId: OWNER,
    amountMinorUnits: 500_000,
    currency: CUR,
    status: 'PROCESSING',
    destination: '254712345678',
    destinationType: 'MOBILE_MONEY',
    provider: 'mpesa',
    transferId: conversationId,
    idempotencyKey: `idem_${conversationId}`,
    initiatedAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
  };
  await repo.create(row);
  return row;
}

describe('M-Pesa B2C result/timeout transitions (Finding 2)', () => {
  let service: DisbursementService;
  let repo: InMemoryDisbursementRepository;

  beforeEach(() => {
    const made = makeService();
    service = made.service;
    repo = made.disbursementRepo;
  });

  it('marks the disbursement PAID on a successful B2C result', async () => {
    await seedProcessing(repo);
    const outcome = await service.applyB2cResult({
      conversationId: CONVERSATION_ID,
      success: true,
      transactionId: 'TX123',
    });
    expect(outcome).toBe('paid');
    const row = await repo.findByTransferId('mpesa', CONVERSATION_ID);
    expect(row?.status).toBe('PAID');
    expect(row?.completedAt).toBeInstanceOf(Date);
  });

  it('transitions to NEEDS_REVERSAL on a FAILED B2C result (not clean FAILED)', async () => {
    await seedProcessing(repo);
    const outcome = await service.applyB2cResult({
      conversationId: CONVERSATION_ID,
      success: false,
      failureReason: 'insufficient float',
    });
    expect(outcome).toBe('needs-reversal');
    const row = await repo.findByTransferId('mpesa', CONVERSATION_ID);
    expect(row?.status).toBe('NEEDS_REVERSAL');
    expect(row?.failureReason).toContain('insufficient float');

    // The reconciliation job consumes NEEDS_REVERSAL via findPending.
    const pending = await repo.findPending(TENANT);
    expect(pending.some((d) => d.status === 'NEEDS_REVERSAL')).toBe(true);
  });

  it('flags NEEDS_REVERSAL on a B2C queue timeout', async () => {
    await seedProcessing(repo);
    const outcome = await service.applyB2cTimeout({ conversationId: CONVERSATION_ID });
    expect(outcome).toBe('needs-reversal');
    const row = await repo.findByTransferId('mpesa', CONVERSATION_ID);
    expect(row?.status).toBe('NEEDS_REVERSAL');
    expect(row?.failureReason).toContain('timeout');
  });

  it('is idempotent — a redelivered result on a terminal row is a no-op', async () => {
    await seedProcessing(repo);
    await service.applyB2cResult({ conversationId: CONVERSATION_ID, success: true });
    const second = await service.applyB2cResult({ conversationId: CONVERSATION_ID, success: false });
    expect(second).toBe('ignored-terminal');
    const row = await repo.findByTransferId('mpesa', CONVERSATION_ID);
    expect(row?.status).toBe('PAID'); // unchanged
  });

  it('ignores a result for an unknown ConversationID without throwing', async () => {
    const outcome = await service.applyB2cResult({ conversationId: 'unknown', success: true });
    expect(outcome).toBe('ignored-unknown');
  });
});

describe('Disbursement provider selection routes by destination/currency (Finding 2)', () => {
  // Minimal provider stubs that record whether they were asked to transfer.
  class StubProvider implements Partial<IPaymentProvider> {
    transferred = false;
    constructor(
      readonly name: string,
      readonly supportedCurrencies: CurrencyCode[],
    ) {}
    async createTransfer(params: {
      amount: Money;
      destination: string;
      idempotencyKey: string;
    }): Promise<TransferResult> {
      this.transferred = true;
      return { transferId: `${this.name}_T1`, status: 'PENDING', amount: params.amount };
    }
  }

  async function harness() {
    const accountRepository = new InMemoryAccountRepository();
    const { createOwnerOperatingAccount, createPlatformHoldingAccount } = await import(
      '@bossnyumba/domain-models'
    );
    const OP = 'acc_op_route' as never;
    const HOLD = 'acc_hold_route' as never;
    await accountRepository.create(
      createOwnerOperatingAccount(OP, TENANT, OWNER, CUR, 'test'),
    );
    await accountRepository.create(
      createPlatformHoldingAccount(HOLD, TENANT, CUR, 'test'),
    );
    const ledgerService = new LedgerService({
      ledgerRepository: new InMemoryLedgerRepository(),
      accountRepository,
      eventPublisher: new InMemoryEventPublisher(),
      logger: silentLogger,
    });
    // Seed a positive holding balance through the REAL ledger path so the
    // disbursement's balance check passes (DR holding / CR owner-operating).
    await ledgerService.postJournalEntry({
      tenantId: TENANT,
      effectiveDate: new Date(),
      createdBy: 'seed',
      lines: [
        {
          accountId: HOLD,
          type: 'RENT_PAYMENT',
          direction: 'DEBIT',
          amount: Money.fromMinorUnits(1_000_000, CUR),
          description: 'seed holding',
        },
        {
          accountId: OP,
          type: 'RENT_PAYMENT',
          direction: 'CREDIT',
          amount: Money.fromMinorUnits(1_000_000, CUR),
          description: 'seed holding offset',
        },
      ],
    });
    const service = new DisbursementService({
      accountRepository,
      disbursementRepository: new InMemoryDisbursementRepository(),
      ledgerService,
      eventPublisher: new InMemoryEventPublisher(),
      logger: silentLogger,
    });
    return { service, ledgerService };
  }

  it('routes a mobile-money phone destination to the M-Pesa provider', async () => {
    const { service } = await harness();
    const stripe = new StubProvider('stripe', ['USD']);
    const mpesa = new StubProvider('mpesa', ['KES']);
    service.registerProvider(stripe as unknown as IPaymentProvider, true);
    service.registerProvider(mpesa as unknown as IPaymentProvider);

    const result = await service.processDisbursement({
      tenantId: TENANT,
      ownerId: OWNER,
      amount: Money.fromMinorUnits(100_000, CUR),
      destination: '254712345678', // phone number
      idempotencyKey: 'route-mpesa-1',
    });

    expect(mpesa.transferred).toBe(true);
    expect(stripe.transferred).toBe(false);
    expect(result.transferId).toBe('mpesa_T1');
  });

  it('routes a connected-account destination to the default (Stripe) provider', async () => {
    const { service } = await harness();
    const stripe = new StubProvider('stripe', ['KES', 'USD']);
    const mpesa = new StubProvider('mpesa', ['KES']);
    service.registerProvider(stripe as unknown as IPaymentProvider, true);
    service.registerProvider(mpesa as unknown as IPaymentProvider);

    const result = await service.processDisbursement({
      tenantId: TENANT,
      ownerId: OWNER,
      amount: Money.fromMinorUnits(100_000, CUR),
      destination: 'acct_connected_123', // Stripe connected account
      idempotencyKey: 'route-stripe-1',
    });

    expect(stripe.transferred).toBe(true);
    expect(mpesa.transferred).toBe(false);
    expect(result.transferId).toBe('stripe_T1');
  });
});

describe('M-Pesa provider getTransferStatus is callback-only (Finding 2)', () => {
  it('throws the typed callback-only signal the reconciliation sweep handles', async () => {
    const provider = new MpesaPaymentProvider({
      consumerKey: 'k',
      consumerSecret: 's',
      shortCode: '600000',
      passKey: 'p',
      environment: 'sandbox',
      callbackBaseUrl: 'https://example.test',
    });
    await expect(provider.getTransferStatus(CONVERSATION_ID)).rejects.toBeInstanceOf(
      MpesaCallbackOnlyStatusError,
    );
  });
});

describe('rail-selection helpers', () => {
  it('classifies mobile-money currencies', () => {
    expect(isMobileMoneyCurrency('KES')).toBe(true);
    // TZS is deliberately NOT mobile-money: no TZS mobile-money provider
    // (Vodacom M-Pesa TZ / Tigo Pesa / Airtel Money) is registered yet, so a
    // TZS payout must not claim the M-Pesa rail and silently strand money as
    // NEEDS_REVERSAL. Re-add TZS the same PR that registers a TZS provider —
    // see MOBILE_MONEY_CURRENCIES in disbursement.service.ts.
    expect(isMobileMoneyCurrency('TZS')).toBe(false);
    expect(isMobileMoneyCurrency('USD' as CurrencyCode)).toBe(false);
  });

  it('distinguishes phone numbers from connected-account ids', () => {
    expect(looksLikePhoneNumber('254712345678')).toBe(true);
    expect(looksLikePhoneNumber('+254 712 345 678')).toBe(true);
    expect(looksLikePhoneNumber('acct_123')).toBe(false);
    expect(looksLikePhoneNumber('ba_456')).toBe(false);
    expect(looksLikePhoneNumber('')).toBe(false);
  });
});
