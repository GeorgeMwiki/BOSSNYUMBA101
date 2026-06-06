/**
 * M5 (CRITICAL) — payments must reach the ledger on the automated path.
 *
 * Before this fix, `handlePaymentSuccess` only marked the intent
 * SUCCEEDED and emitted PAYMENT_SUCCEEDED; the sole api-gateway
 * subscriber just sent an SMS. Collected rent was NEVER booked.
 *
 * These tests pin the new contract:
 *
 *   1. A succeeded webhook posts a balanced double-entry journal:
 *      DEBIT platform holding (cash received) / CREDIT customer
 *      liability (reduce what they owe), tagged with the paymentIntentId.
 *   2. The posting is idempotent on paymentIntentId — a redelivered
 *      webhook (Safaricom/Stripe retry) produces the journal exactly
 *      once, no double-credit.
 *   3. Reconciliation can still see the entries (they are real ledger
 *      rows tagged with the paymentIntentId).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  Money,
  PaymentIntentAggregate,
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

const TENANT = 'tnt_m5' as TenantId;
const CUSTOMER = 'cust_m5' as CustomerId;
const CUR = 'TZS';
const PROVIDER = 'mpesa';
const EXTERNAL_ID = 'ws_CO_checkout_123';

const silentLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function buildIntent(amountMinor: number): PaymentIntent {
  const now = new Date();
  const amount = Money.fromMinorUnits(amountMinor, CUR);
  return {
    id: 'pi_m5_1' as PaymentIntentId,
    tenantId: TENANT,
    customerId: CUSTOMER,
    type: 'RENT_PAYMENT',
    status: 'PROCESSING',
    amount,
    platformFee: Money.zero(CUR),
    netAmount: amount,
    description: 'June rent',
    idempotencyKey: 'idem_m5_1',
    externalId: EXTERNAL_ID,
    providerName: PROVIDER,
    createdAt: now,
    createdBy: 'system',
    updatedAt: now,
    updatedBy: 'system',
  } as PaymentIntent;
}

describe('handlePaymentSuccess books the ledger (M5)', () => {
  let accountRepo: InMemoryAccountRepository;
  let ledgerRepo: InMemoryLedgerRepository;
  let intentRepo: InMemoryPaymentIntentRepository;
  let ledgerService: LedgerService;
  let orchestration: PaymentOrchestrationService;
  let holdingId: AccountId;
  let liabilityId: AccountId;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    ledgerRepo = new InMemoryLedgerRepository();
    intentRepo = new InMemoryPaymentIntentRepository();

    holdingId = 'acc_holding_m5' as AccountId;
    liabilityId = 'acc_liability_m5' as AccountId;
    await accountRepo.create(createPlatformHoldingAccount(holdingId, TENANT, CUR as never, 'system'));
    await accountRepo.create(
      createCustomerLiabilityAccount(liabilityId, TENANT, CUSTOMER, CUR as never, 'system'),
    );

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

  it('posts a balanced journal (debit holding / credit liability) tagged with the paymentIntentId', async () => {
    const intent = buildIntent(100_000); // TZS 1,000.00
    await intentRepo.create(intent);

    await orchestration.handleWebhook(PROVIDER, EXTERNAL_ID, 'SUCCEEDED', TENANT, 'RCPT123');

    // Intent marked succeeded.
    const updated = await intentRepo.findById(intent.id, TENANT);
    expect(updated?.status).toBe('SUCCEEDED');

    // Journal entries exist for this paymentIntent.
    const entries = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    expect(entries.total).toBeGreaterThanOrEqual(2);

    // Balanced: total debits === total credits.
    let debits = 0;
    let credits = 0;
    for (const e of entries.entries) {
      if (e.direction === 'DEBIT') debits += e.amount.amountMinorUnits;
      else credits += e.amount.amountMinorUnits;
    }
    expect(debits).toBe(credits);

    // Holding account debited by the gross amount → +100_000.
    const holding = await accountRepo.findById(holdingId, TENANT);
    expect(holding?.balanceMinorUnits).toBe(100_000);

    // Customer liability credited → reduces what they owe → -100_000.
    const liability = await accountRepo.findById(liabilityId, TENANT);
    expect(liability?.balanceMinorUnits).toBe(-100_000);
  });

  it('is idempotent on paymentIntentId — redelivery posts the journal exactly once', async () => {
    const intent = buildIntent(50_000);
    await intentRepo.create(intent);

    // First delivery.
    await orchestration.handleWebhook(PROVIDER, EXTERNAL_ID, 'SUCCEEDED', TENANT, 'RCPT1');
    const afterFirst = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    const journalsAfterFirst = new Set(afterFirst.entries.map((e) => e.journalId)).size;

    // Redelivery (Safaricom/Stripe retry). Must NOT double-post.
    await orchestration.handleWebhook(PROVIDER, EXTERNAL_ID, 'SUCCEEDED', TENANT, 'RCPT1');
    const afterSecond = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    const journalsAfterSecond = new Set(afterSecond.entries.map((e) => e.journalId)).size;

    expect(journalsAfterSecond).toBe(journalsAfterFirst);
    expect(afterSecond.total).toBe(afterFirst.total);

    // Balance not double-credited.
    const holding = await accountRepo.findById(holdingId, TENANT);
    expect(holding?.balanceMinorUnits).toBe(50_000);
  });

  it('still emits PAYMENT_SUCCEEDED so the SMS subscriber keeps working', async () => {
    const publisher = new InMemoryEventPublisher();
    const orch = new PaymentOrchestrationService({
      paymentIntentRepository: intentRepo,
      eventPublisher: publisher,
      ledgerService,
      accountRepository: accountRepo,
      logger: silentLogger,
    });
    const intent = buildIntent(10_000);
    await intentRepo.create(intent);

    await orch.handleWebhook(PROVIDER, EXTERNAL_ID, 'SUCCEEDED', TENANT, 'RCPT9');

    const succeeded = publisher
      .getOutbox()
      .filter((e) => e.eventType === 'PAYMENT_SUCCEEDED');
    expect(succeeded).toHaveLength(1);
  });
});

/**
 * MUST-FIX 1 (CRITICAL) — self-heal the mark→book crash window.
 *
 * The webhook routes `claim()` the idempotency key BEFORE calling
 * handleWebhook, and handlePaymentSuccess does markSucceeded+persist THEN
 * bookPaymentToLedger. If the process crashes between persist and book,
 * the key stays claimed; the provider retry hits `claim()===false`, acks,
 * and NEVER books → cash collected, no journal. `ensurePaymentBooked` is
 * the duplicate-path self-heal the routes call when `claim()===false`:
 * look up the intent by externalId; if SUCCEEDED and no ledger entries
 * exist, book it (idempotently).
 */
describe('ensurePaymentBooked self-heals the crash window (MUST-FIX 1)', () => {
  let accountRepo: InMemoryAccountRepository;
  let ledgerRepo: InMemoryLedgerRepository;
  let intentRepo: InMemoryPaymentIntentRepository;
  let ledgerService: LedgerService;
  let orchestration: PaymentOrchestrationService;
  let holdingId: AccountId;
  let liabilityId: AccountId;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    ledgerRepo = new InMemoryLedgerRepository();
    intentRepo = new InMemoryPaymentIntentRepository();

    holdingId = 'acc_holding_heal' as AccountId;
    liabilityId = 'acc_liability_heal' as AccountId;
    await accountRepo.create(createPlatformHoldingAccount(holdingId, TENANT, CUR as never, 'system'));
    await accountRepo.create(
      createCustomerLiabilityAccount(liabilityId, TENANT, CUSTOMER, CUR as never, 'system'),
    );

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

  it('books exactly once when the intent is SUCCEEDED but was never booked (crash-after-mark)', async () => {
    // Simulate the crash window: intent already SUCCEEDED, NO journal.
    const now = new Date();
    const amount = Money.fromMinorUnits(70_000, CUR);
    const intent = {
      ...buildIntent(70_000),
      status: 'SUCCEEDED',
      paidAt: now,
    } as PaymentIntent;
    await intentRepo.create(intent);

    // Pre-condition: no ledger entries for this payment.
    const before = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    expect(before.total).toBe(0);

    // The duplicate redelivery path calls ensurePaymentBooked.
    await orchestration.ensurePaymentBooked(EXTERNAL_ID, PROVIDER, TENANT);

    // Now booked exactly once: balanced journal, correct balances.
    const after = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    expect(after.total).toBeGreaterThanOrEqual(2);
    const journals = new Set(after.entries.map((e) => e.journalId));
    expect(journals.size).toBe(1);

    expect((await accountRepo.findById(holdingId, TENANT))?.balanceMinorUnits).toBe(70_000);
    expect((await accountRepo.findById(liabilityId, TENANT))?.balanceMinorUnits).toBe(-70_000);

    // amount sanity (no float drift).
    let debits = 0;
    for (const e of after.entries) if (e.direction === 'DEBIT') debits += e.amount.amountMinorUnits;
    expect(debits).toBe(amount.amountMinorUnits);
  });

  it('books ZERO extra when the payment was already booked (normal duplicate)', async () => {
    const intent = buildIntent(40_000);
    await intentRepo.create(intent);

    // Normal first delivery books the journal.
    await orchestration.handleWebhook(PROVIDER, EXTERNAL_ID, 'SUCCEEDED', TENANT, 'RCPT_OK');
    const afterFirst = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    const journalsAfterFirst = new Set(afterFirst.entries.map((e) => e.journalId)).size;
    expect(afterFirst.total).toBeGreaterThanOrEqual(2);

    // Duplicate redelivery → ensurePaymentBooked must be a no-op.
    await orchestration.ensurePaymentBooked(EXTERNAL_ID, PROVIDER, TENANT);

    const afterHeal = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    expect(afterHeal.total).toBe(afterFirst.total);
    expect(new Set(afterHeal.entries.map((e) => e.journalId)).size).toBe(journalsAfterFirst);

    // Balance not double-credited.
    expect((await accountRepo.findById(holdingId, TENANT))?.balanceMinorUnits).toBe(40_000);
  });

  it('does NOT book when the intent is not SUCCEEDED (e.g. still PROCESSING)', async () => {
    // A duplicate of a non-success callback must never create a journal.
    const intent = buildIntent(25_000); // status PROCESSING per buildIntent
    await intentRepo.create(intent);

    await orchestration.ensurePaymentBooked(EXTERNAL_ID, PROVIDER, TENANT);

    const entries = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    expect(entries.total).toBe(0);
    expect((await accountRepo.findById(holdingId, TENANT))?.balanceMinorUnits).toBe(0);
  });

  it('is a no-op (no throw) when no intent matches the externalId', async () => {
    await expect(
      orchestration.ensurePaymentBooked('unknown_external_id', PROVIDER, TENANT),
    ).resolves.toBeUndefined();
    // Nothing booked.
    const holding = await accountRepo.findById(holdingId, TENANT);
    expect(holding?.balanceMinorUnits).toBe(0);
  });
});
