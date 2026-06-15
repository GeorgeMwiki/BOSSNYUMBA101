/**
 * M13 — a matched C2B intent whose currency differs from the platform-holding
 * account's currency must NOT poison-pill the provider into infinite retry.
 *
 * Before this fix, the matched-intent path booked `gross` (intent currency) onto
 * an arbitrary holding account (possibly a DIFFERENT currency), so
 * `LedgerService.postJournalEntry` threw "Currency mismatch". On the
 * at-least-once M-Pesa C2B webhook path the route releases the idempotency claim
 * on ANY thrown error, so Daraja re-delivered → re-threw → re-released → RETRIED
 * FOREVER. These tests pin the new contract:
 *
 *   1. (a) If a holding account EXISTS in the payment's currency, the matched
 *          intent is routed there and books cleanly (no throw, money on books).
 *   2. (b) If NO holding exists in the payment's currency, the booking raises a
 *          TERMINAL CurrencyMismatchBookingError (terminal === true) — NOT a
 *          bare Error. Webhook routes treat `terminal === true` as
 *          ack-and-flag-for-reconciliation (keep the claim → retries stop),
 *          never release-and-retry. The SUCCEEDED intent still persists with its
 *          amount + external id (money visible, never silently dropped).
 *   3. The unallocated path (no intent) is unaffected — still books a balanced
 *          unallocated receipt in the holding's own currency.
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
import {
  PaymentOrchestrationService,
  CurrencyMismatchBookingError,
  isTerminalBookingError,
} from '../services/payment-orchestration.service';
import { LedgerService } from '../services/ledger.service';
import { InMemoryAccountRepository } from '../repositories/account.repository';
import { InMemoryLedgerRepository } from '../repositories/ledger.repository';
import { InMemoryPaymentIntentRepository } from '../repositories/payment-intent.repository';
import { InMemoryEventPublisher } from '../events/event-publisher';

const TENANT = 'tnt_fx' as TenantId;
const CUSTOMER = 'cust_fx' as CustomerId;
const TRANS_ID = 'RKT_FX_001';
const MSISDN = '254799999999';

const silentLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

interface Harness {
  readonly accountRepo: InMemoryAccountRepository;
  readonly ledgerRepo: InMemoryLedgerRepository;
  readonly intentRepo: InMemoryPaymentIntentRepository;
  readonly orchestration: PaymentOrchestrationService;
}

function makeHarness(): Harness {
  const accountRepo = new InMemoryAccountRepository();
  const ledgerRepo = new InMemoryLedgerRepository();
  const intentRepo = new InMemoryPaymentIntentRepository();
  const ledgerService = new LedgerService({
    ledgerRepository: ledgerRepo,
    accountRepository: accountRepo,
    eventPublisher: new InMemoryEventPublisher(),
    logger: silentLogger,
  });
  const orchestration = new PaymentOrchestrationService({
    paymentIntentRepository: intentRepo,
    eventPublisher: new InMemoryEventPublisher(),
    ledgerService,
    accountRepository: accountRepo,
    logger: silentLogger,
  });
  return { accountRepo, ledgerRepo, intentRepo, orchestration };
}

/** Seed a matched C2B intent in `intentCurrency` (already PROCESSING). */
async function seedMatchedIntent(
  h: Harness,
  intentCurrency: string,
  liabilityCurrency: string,
): Promise<PaymentIntent> {
  const liabilityId = `acc_liab_${intentCurrency}` as AccountId;
  await h.accountRepo.create(
    createCustomerLiabilityAccount(liabilityId, TENANT, CUSTOMER, liabilityCurrency as never, 'system'),
  );
  const now = new Date();
  const amount = Money.fromMinorUnits(150_000, intentCurrency);
  const intent = {
    id: 'pi_fx_1' as PaymentIntentId,
    tenantId: TENANT,
    customerId: CUSTOMER,
    type: 'RENT_PAYMENT',
    status: 'PROCESSING',
    amount,
    platformFee: Money.zero(intentCurrency),
    netAmount: amount,
    description: 'rent via paybill (FX)',
    idempotencyKey: 'idem_fx_1',
    externalId: TRANS_ID,
    providerName: 'mpesa_c2b',
    createdAt: now,
    createdBy: 'system',
    updatedAt: now,
    updatedBy: 'system',
  } as PaymentIntent;
  await h.intentRepo.create(intent);
  return intent;
}

describe('M13 — currency-mismatched matched-intent does not poison-pill (terminal, no infinite retry)', () => {
  let h: Harness;

  beforeEach(() => {
    h = makeHarness();
  });

  it('(a) routes the matched intent to a currency-matched holding when one exists', async () => {
    // Default holding is KES; a USD holding also exists. The intent is USD.
    await h.accountRepo.create(
      createPlatformHoldingAccount('acc_hold_kes' as AccountId, TENANT, 'KES' as never, 'system'),
    );
    const usdHoldingId = 'acc_hold_usd' as AccountId;
    await h.accountRepo.create(
      createPlatformHoldingAccount(usdHoldingId, TENANT, 'USD' as never, 'system'),
    );
    await seedMatchedIntent(h, 'USD', 'USD');

    // Must NOT throw — routes to the USD holding.
    const outcome = await h.orchestration.handleC2bConfirmation({
      transId: TRANS_ID,
      tenantId: TENANT,
      amountMajor: '1500.00',
      msisdn: MSISDN,
    });
    expect(outcome).toBe('matched');

    // Booked to the USD holding, balanced, gross on the books.
    const entries = await h.ledgerRepo.find({
      tenantId: TENANT,
      paymentIntentId: 'pi_fx_1' as PaymentIntentId,
    });
    expect(entries.total).toBeGreaterThanOrEqual(2);
    const usdHolding = await h.accountRepo.findById(usdHoldingId, TENANT);
    expect(usdHolding?.balanceMinorUnits).toBe(150_000);
    // The KES holding was untouched.
    const kesHolding = await h.accountRepo.findById('acc_hold_kes' as AccountId, TENANT);
    expect(kesHolding?.balanceMinorUnits).toBe(0);
  });

  it('(b) raises a TERMINAL CurrencyMismatchBookingError (not a bare retry error) when no holding matches', async () => {
    // Only a KES holding exists; the intent is USD → genuinely unbookable.
    await h.accountRepo.create(
      createPlatformHoldingAccount('acc_hold_kes' as AccountId, TENANT, 'KES' as never, 'system'),
    );
    const intent = await seedMatchedIntent(h, 'USD', 'USD');

    const err = await h.orchestration
      .handleC2bConfirmation({
        transId: TRANS_ID,
        tenantId: TENANT,
        amountMajor: '1500.00',
        msisdn: MSISDN,
      })
      .then(
        () => null,
        (e: unknown) => e,
      );

    // It DID reject — but with a TERMINAL error the webhook routes will NOT
    // retry (they keep the claim instead of releasing it).
    expect(err).toBeInstanceOf(CurrencyMismatchBookingError);
    expect(isTerminalBookingError(err)).toBe(true);
    expect((err as CurrencyMismatchBookingError).code).toBe(
      'PAYMENT_CURRENCY_MISMATCH_UNBOOKABLE',
    );

    // Money is NOT silently dropped: the intent was marked SUCCEEDED + persisted
    // (visible with its amount + external id for manual reconciliation), and the
    // KES holding was never wrongly credited.
    const persisted = await h.intentRepo.findById(intent.id, TENANT);
    expect(persisted?.status).toBe('SUCCEEDED');
    const kesHolding = await h.accountRepo.findById('acc_hold_kes' as AccountId, TENANT);
    expect(kesHolding?.balanceMinorUnits).toBe(0);
    // No ledger journal was booked (the mismatch is unbookable as a rent receipt).
    const entries = await h.ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    expect(entries.total).toBe(0);
  });

  it('a redelivered terminal-mismatch confirmation stays terminal (idempotent, never books, never throws a transient error)', async () => {
    await h.accountRepo.create(
      createPlatformHoldingAccount('acc_hold_kes' as AccountId, TENANT, 'KES' as never, 'system'),
    );
    const intent = await seedMatchedIntent(h, 'USD', 'USD');

    // First delivery → terminal.
    const first = await h.orchestration
      .handleC2bConfirmation({ transId: TRANS_ID, tenantId: TENANT, amountMajor: '1500.00', msisdn: MSISDN })
      .then(() => null, (e: unknown) => e);
    expect(isTerminalBookingError(first)).toBe(true);

    // A redelivery re-drives the same self-heal path (intent already SUCCEEDED) —
    // still terminal, still books nothing.
    const second = await h.orchestration
      .ensurePaymentBooked(TRANS_ID, 'mpesa_c2b', TENANT)
      .then(() => null, (e: unknown) => e);
    expect(isTerminalBookingError(second)).toBe(true);

    const entries = await h.ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    expect(entries.total).toBe(0);
  });
});
