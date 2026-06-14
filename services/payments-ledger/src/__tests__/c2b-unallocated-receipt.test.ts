/**
 * Finding 3 (HIGH) — an M-Pesa C2B confirmation with NO matching intent must
 * NOT be acked-and-dropped.
 *
 * Before this fix, `handleWebhook('mpesa_c2b', ...)` found no intent and
 * returned silently: the cash arrived but was recorded NOWHERE (the
 * "unallocated bucket" was only a comment). These tests pin the new contract:
 *
 *   1. No matching intent → `handleC2bConfirmation` books an explicit
 *      UNALLOCATED RECEIPT: a BALANCED journal DR platform-holding (cash
 *      arrived) / CR a per-tenant unallocated-suspense liability, stamped with
 *      the TransID / MSISDN so operators can attribute it. Returns 'unallocated'.
 *   2. The holding balance increases by the received amount (the money is on the
 *      books), and the suspense liability mirrors it.
 *   3. A matching C2B intent → the normal rent-payment path (returns 'matched').
 *   4. Idempotent on TransID — a redelivered unmatched confirmation books the
 *      unallocated receipt exactly once.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  Money,
  createCustomerLiabilityAccount,
  createPlatformHoldingAccount,
  type AccountId,
  type CustomerId,
  type PaymentIntent,
  type PaymentIntentId,
  type TenantId,
} from '@bossnyumba/domain-models';
import { PaymentOrchestrationService } from '../services/payment-orchestration.service';
import { LedgerService } from '../services/ledger.service';
import { InMemoryAccountRepository } from '../repositories/account.repository';
import { InMemoryLedgerRepository } from '../repositories/ledger.repository';
import { InMemoryPaymentIntentRepository } from '../repositories/payment-intent.repository';
import { InMemoryEventPublisher } from '../events/event-publisher';

const TENANT = 'tnt_c2b' as TenantId;
const CUSTOMER = 'cust_c2b' as CustomerId;
const CUR = 'KES';
const TRANS_ID = 'RKT12345AB';
const MSISDN = '254712345678';

const silentLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

describe('C2B confirmation never silently drops unmatched cash (Finding 3)', () => {
  let accountRepo: InMemoryAccountRepository;
  let ledgerRepo: InMemoryLedgerRepository;
  let intentRepo: InMemoryPaymentIntentRepository;
  let ledgerService: LedgerService;
  let orchestration: PaymentOrchestrationService;
  let holdingId: AccountId;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    ledgerRepo = new InMemoryLedgerRepository();
    intentRepo = new InMemoryPaymentIntentRepository();

    holdingId = 'acc_holding_c2b' as AccountId;
    await accountRepo.create(createPlatformHoldingAccount(holdingId, TENANT, CUR as never, 'system'));

    ledgerService = new LedgerService({
      ledgerRepository: ledgerRepo,
      accountRepository: accountRepo,
      eventPublisher: new InMemoryEventPublisher(),
      logger: silentLogger,
    });
    orchestration = new PaymentOrchestrationService({
      paymentIntentRepository: intentRepo,
      eventPublisher: new InMemoryEventPublisher(),
      ledgerService,
      accountRepository: accountRepo,
      logger: silentLogger,
    });
  });

  it('books a balanced unallocated-receipt journal when no intent matches', async () => {
    const outcome = await orchestration.handleC2bConfirmation({
      transId: TRANS_ID,
      tenantId: TENANT,
      amountMajor: '1500.00', // KES 1,500.00 → 150_000 minor
      msisdn: MSISDN,
    });
    expect(outcome).toBe('unallocated');

    // A journal exists, tagged by the deterministic unallocated id.
    const tag = `c2b-unalloc:${TRANS_ID}` as PaymentIntentId;
    const entries = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: tag });
    expect(entries.total).toBe(2);

    // Balanced.
    let debits = 0;
    let credits = 0;
    for (const e of entries.entries) {
      if (e.direction === 'DEBIT') debits += e.amount.amountMinorUnits;
      else credits += e.amount.amountMinorUnits;
    }
    expect(debits).toBe(credits);
    expect(debits).toBe(150_000);

    // Holding genuinely debited by the received cash (money is on the books).
    const holding = await accountRepo.findById(holdingId, TENANT);
    expect(holding?.balanceMinorUnits).toBe(150_000);

    // The cash leg carries the TransID + MSISDN so operators can attribute it.
    const holdingDebit = entries.entries.find(
      (e) => e.direction === 'DEBIT' && e.accountId === holdingId,
    );
    expect(holdingDebit?.description).toContain(TRANS_ID);
    expect(holdingDebit?.description).toContain(MSISDN);

    // The credit lands on a per-tenant unallocated-suspense liability account
    // (lazily provisioned). balanceMinorUnits is debit-positive (debits − credits):
    // the holding ASSET reads +150_000 (debited above), so the offsetting LIABILITY
    // credit reads −150_000 — the suspense owes 150_000 of unattributed cash. The
    // magnitudes mirror; the signs are opposite, as a balanced journal requires.
    const suspense = await accountRepo.findByCustomerAndType(
      TENANT,
      'cust_unallocated' as CustomerId,
      'CUSTOMER_LIABILITY',
    );
    expect(suspense).not.toBeNull();
    expect(suspense?.balanceMinorUnits).toBe(-150_000);
  });

  it('routes to the normal rent-payment path when a C2B intent matches', async () => {
    // Seed the matching customer-liability account + a C2B intent.
    const liabilityId = 'acc_liability_c2b' as AccountId;
    await accountRepo.create(
      createCustomerLiabilityAccount(liabilityId, TENANT, CUSTOMER, CUR as never, 'system'),
    );
    const now = new Date();
    const amount = Money.fromMinorUnits(150_000, CUR);
    const intent = {
      id: 'pi_c2b_1' as PaymentIntentId,
      tenantId: TENANT,
      customerId: CUSTOMER,
      type: 'RENT_PAYMENT',
      status: 'PROCESSING',
      amount,
      platformFee: Money.zero(CUR),
      netAmount: amount,
      description: 'rent via paybill',
      idempotencyKey: 'idem_c2b_1',
      externalId: TRANS_ID,
      providerName: 'mpesa_c2b',
      createdAt: now,
      createdBy: 'system',
      updatedAt: now,
      updatedBy: 'system',
    } as PaymentIntent;
    await intentRepo.create(intent);

    const outcome = await orchestration.handleC2bConfirmation({
      transId: TRANS_ID,
      tenantId: TENANT,
      amountMajor: '1500.00',
      msisdn: MSISDN,
    });
    expect(outcome).toBe('matched');

    // The intent's own journal was booked (not the unallocated one).
    const matched = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    expect(matched.total).toBeGreaterThanOrEqual(2);
    // No unallocated suspense account was created.
    const suspense = await accountRepo.findByCustomerAndType(
      TENANT,
      'cust_unallocated' as CustomerId,
      'CUSTOMER_LIABILITY',
    );
    expect(suspense).toBeNull();
  });

  it('is idempotent on TransID — a redelivered unmatched confirmation books once', async () => {
    await orchestration.handleC2bConfirmation({
      transId: TRANS_ID,
      tenantId: TENANT,
      amountMajor: '1500.00',
      msisdn: MSISDN,
    });
    await orchestration.handleC2bConfirmation({
      transId: TRANS_ID,
      tenantId: TENANT,
      amountMajor: '1500.00',
      msisdn: MSISDN,
    });

    // Holding credited exactly once.
    const holding = await accountRepo.findById(holdingId, TENANT);
    expect(holding?.balanceMinorUnits).toBe(150_000); // not 300_000

    const tag = `c2b-unalloc:${TRANS_ID}` as PaymentIntentId;
    const entries = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: tag });
    const journals = new Set(entries.entries.map((e) => e.journalId));
    expect(journals.size).toBe(1);
  });
});
