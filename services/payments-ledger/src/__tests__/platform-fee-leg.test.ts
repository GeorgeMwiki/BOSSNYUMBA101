/**
 * Finding 4 (MED) — the platform-fee split MUST be booked on payment success.
 *
 * Before this fix, `bookPaymentToLedger` posted only DR holding (gross) / CR
 * customer-liability (gross). No PLATFORM_FEE leg was ever written, even though
 * the fee was computed + frozen on the intent at create time and
 * DisbursementService sums PLATFORM_FEE entries (which were therefore always
 * zero). These tests pin the new contract:
 *
 *   1. When the intent carries a non-zero platformFee, the success journal
 *      includes the balanced PLATFORM_FEE pair: CR holding / DEBIT
 *      platform-revenue, in the fee amount. The journal as a whole stays
 *      balanced (gross debit/credit + the equal-and-opposite fee pair).
 *   2. The platform-revenue account is debited by exactly the fee.
 *   3. A zero/absent fee falls back to the plain 2-leg receipt (no degenerate
 *      zero-amount fee legs).
 *   4. The booking remains idempotent on paymentIntentId (no double fee).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  Money,
  createCustomerLiabilityAccount,
  createPlatformHoldingAccount,
  createPlatformRevenueAccount,
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

const TENANT = 'tnt_fee' as TenantId;
const CUSTOMER = 'cust_fee' as CustomerId;
const CUR = 'TZS';
const PROVIDER = 'stripe';
const EXTERNAL_ID = 'pi_fee_ext_1';

const silentLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function buildIntent(grossMinor: number, feeMinor: number): PaymentIntent {
  const now = new Date();
  const amount = Money.fromMinorUnits(grossMinor, CUR);
  const fee = Money.fromMinorUnits(feeMinor, CUR);
  return {
    id: 'pi_fee_1' as PaymentIntentId,
    tenantId: TENANT,
    customerId: CUSTOMER,
    type: 'RENT_PAYMENT',
    status: 'PROCESSING',
    amount,
    platformFee: fee,
    netAmount: amount.subtract(fee),
    description: 'June rent',
    idempotencyKey: 'idem_fee_1',
    externalId: EXTERNAL_ID,
    providerName: PROVIDER,
    createdAt: now,
    createdBy: 'system',
    updatedAt: now,
    updatedBy: 'system',
  } as PaymentIntent;
}

describe('bookPaymentToLedger books the platform-fee split (Finding 4)', () => {
  let accountRepo: InMemoryAccountRepository;
  let ledgerRepo: InMemoryLedgerRepository;
  let intentRepo: InMemoryPaymentIntentRepository;
  let ledgerService: LedgerService;
  let orchestration: PaymentOrchestrationService;
  let holdingId: AccountId;
  let liabilityId: AccountId;
  let revenueId: AccountId;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    ledgerRepo = new InMemoryLedgerRepository();
    intentRepo = new InMemoryPaymentIntentRepository();

    holdingId = 'acc_holding_fee' as AccountId;
    liabilityId = 'acc_liability_fee' as AccountId;
    revenueId = 'acc_revenue_fee' as AccountId;
    await accountRepo.create(createPlatformHoldingAccount(holdingId, TENANT, CUR as never, 'system'));
    await accountRepo.create(
      createCustomerLiabilityAccount(liabilityId, TENANT, CUSTOMER, CUR as never, 'system'),
    );
    await accountRepo.create(createPlatformRevenueAccount(revenueId, TENANT, CUR as never, 'system'));

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

  it('writes a PLATFORM_FEE pair (CR holding / DEBIT revenue) and stays balanced', async () => {
    // Gross 100_000, fee 5_000 (5%).
    const intent = buildIntent(100_000, 5_000);
    await intentRepo.create(intent);

    await orchestration.handleWebhook(PROVIDER, EXTERNAL_ID, 'SUCCEEDED', TENANT, 'RCPT_FEE');

    const entries = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });

    // There is at least one PLATFORM_FEE leg (the bug: there were zero).
    const feeLegs = entries.entries.filter((e) => e.type === 'PLATFORM_FEE');
    expect(feeLegs.length).toBe(2);

    const revenueDebit = feeLegs.find(
      (e) => e.direction === 'DEBIT' && e.accountId === revenueId,
    );
    const holdingFeeCredit = feeLegs.find(
      (e) => e.direction === 'CREDIT' && e.accountId === holdingId,
    );
    expect(revenueDebit?.amount.amountMinorUnits).toBe(5_000);
    expect(holdingFeeCredit?.amount.amountMinorUnits).toBe(5_000);

    // Whole journal balanced.
    let debits = 0;
    let credits = 0;
    for (const e of entries.entries) {
      if (e.direction === 'DEBIT') debits += e.amount.amountMinorUnits;
      else credits += e.amount.amountMinorUnits;
    }
    expect(debits).toBe(credits);

    // Platform-revenue account earned exactly the fee.
    const revenue = await accountRepo.findById(revenueId, TENANT);
    expect(revenue?.balanceMinorUnits).toBe(5_000);
  });

  it('falls back to the plain 2-leg receipt when the fee is zero (no degenerate legs)', async () => {
    const intent = buildIntent(80_000, 0);
    await intentRepo.create(intent);

    await orchestration.handleWebhook(PROVIDER, EXTERNAL_ID, 'SUCCEEDED', TENANT, 'RCPT_ZERO');

    const entries = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    expect(entries.entries.filter((e) => e.type === 'PLATFORM_FEE').length).toBe(0);
    // Exactly the 2 gross legs.
    expect(entries.total).toBe(2);

    // Revenue untouched.
    const revenue = await accountRepo.findById(revenueId, TENANT);
    expect(revenue?.balanceMinorUnits).toBe(0);
  });

  it('is idempotent — a redelivery does not double the fee', async () => {
    const intent = buildIntent(100_000, 5_000);
    await intentRepo.create(intent);

    await orchestration.handleWebhook(PROVIDER, EXTERNAL_ID, 'SUCCEEDED', TENANT, 'RCPT1');
    await orchestration.handleWebhook(PROVIDER, EXTERNAL_ID, 'SUCCEEDED', TENANT, 'RCPT1');

    const revenue = await accountRepo.findById(revenueId, TENANT);
    expect(revenue?.balanceMinorUnits).toBe(5_000); // not 10_000
  });
});
