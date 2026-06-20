/**
 * Finding 1 (HIGH) — the Stripe webhook MUST be idempotent on the Stripe
 * event id, exactly like the M-Pesa STK / C2B paths.
 *
 * Before this fix, /webhooks/stripe never called webhookIdempotencyStore.claim,
 * so a concurrent / redelivered `payment_intent.succeeded` could re-enter
 * bookPaymentToLedger and double-credit the ledger (findEntriesByPaymentIntent
 * was a non-atomic check-then-act over a NON-unique index, and the post carried
 * no idempotencyKey).
 *
 * This suite models the EXACT claim → process → self-heal sequence the
 * server.ts Stripe handler now runs, using the SAME primitives
 * (createInMemoryDurableIdempotencyStore, buildWebhookIdempotencyKey, the
 * orchestration, and the per-payment journal idempotency key). It fails if that
 * sequence regresses. Two layers of defence are asserted:
 *
 *   1. The claim store dedupes a redelivered event.id (second delivery acks
 *      without reprocessing).
 *   2. EVEN IF a delivery slips past the claim (the booking is re-driven
 *      directly), the per-payment journal idempotency key + the
 *      findEntriesByPaymentIntent guard book the journal exactly once — no
 *      double-credit.
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
import {
  createInMemoryDurableIdempotencyStore,
  buildWebhookIdempotencyKey,
  type DurableIdempotencyStore,
} from '../lib/idempotency-store';

const TENANT = 'tnt_stripe' as TenantId;
const CUSTOMER = 'cust_stripe' as CustomerId;
const CUR = 'USD';
const PROVIDER = 'stripe';
const EXTERNAL_ID = 'pi_stripe_ext_1';
const EVENT_ID = 'evt_stripe_1';

const silentLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

function buildIntent(grossMinor: number): PaymentIntent {
  const now = new Date();
  const amount = Money.fromMinorUnits(grossMinor, CUR);
  return {
    id: 'pi_stripe_1' as PaymentIntentId,
    tenantId: TENANT,
    customerId: CUSTOMER,
    type: 'RENT_PAYMENT',
    status: 'PROCESSING',
    amount,
    platformFee: Money.zero(CUR),
    netAmount: amount,
    description: 'rent',
    idempotencyKey: 'idem_stripe_1',
    externalId: EXTERNAL_ID,
    providerName: PROVIDER,
    createdAt: now,
    createdBy: 'system',
    updatedAt: now,
    updatedBy: 'system',
  } as PaymentIntent;
}

/**
 * Faithfully replays the server.ts /webhooks/stripe `payment_intent.succeeded`
 * sequence: claim(event.id) → on duplicate self-heal + ack; on first claim,
 * process (handleWebhook) and release on error.
 */
async function deliverStripeSuccess(
  store: DurableIdempotencyStore,
  orchestration: PaymentOrchestrationService,
): Promise<'processed' | 'duplicate'> {
  const idemKey = buildWebhookIdempotencyKey(TENANT, 'stripe', EVENT_ID);
  const token = await store.claim(idemKey);
  if (!token) {
    // Duplicate → self-heal (idempotent) then ack.
    await orchestration.ensurePaymentBooked(EXTERNAL_ID, PROVIDER, TENANT);
    return 'duplicate';
  }
  try {
    await orchestration.handleWebhook(PROVIDER, EXTERNAL_ID, 'SUCCEEDED', TENANT, 'https://r');
    return 'processed';
  } catch (err) {
    await store.release(idemKey, token);
    throw err;
  }
}

describe('Stripe webhook idempotency (Finding 1)', () => {
  let accountRepo: InMemoryAccountRepository;
  let ledgerRepo: InMemoryLedgerRepository;
  let intentRepo: InMemoryPaymentIntentRepository;
  let ledgerService: LedgerService;
  let orchestration: PaymentOrchestrationService;
  let store: DurableIdempotencyStore;
  let holdingId: AccountId;
  let liabilityId: AccountId;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    ledgerRepo = new InMemoryLedgerRepository();
    intentRepo = new InMemoryPaymentIntentRepository();
    store = createInMemoryDurableIdempotencyStore();

    holdingId = 'acc_holding_stripe' as AccountId;
    liabilityId = 'acc_liability_stripe' as AccountId;
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

  it('the claim store dedupes a redelivered event — books exactly once', async () => {
    const intent = buildIntent(120_000);
    await intentRepo.create(intent);

    const first = await deliverStripeSuccess(store, orchestration);
    const second = await deliverStripeSuccess(store, orchestration);

    expect(first).toBe('processed');
    expect(second).toBe('duplicate');

    // Holding credited exactly once (NOT 240_000).
    const holding = await accountRepo.findById(holdingId, TENANT);
    expect(holding?.balanceMinorUnits).toBe(120_000);

    const entries = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    expect(new Set(entries.entries.map((e) => e.journalId)).size).toBe(1);
  });

  it('does not double-credit even if a delivery slips past the claim (per-payment key)', async () => {
    const intent = buildIntent(90_000);
    await intentRepo.create(intent);

    // Two RAW bookings (no claim in between) model a claim-store outage / race
    // where both deliveries reach the orchestration. The per-payment journal
    // idempotency key + findEntriesByPaymentIntent must still book once.
    await orchestration.handleWebhook(PROVIDER, EXTERNAL_ID, 'SUCCEEDED', TENANT, 'https://r');
    await orchestration.handleWebhook(PROVIDER, EXTERNAL_ID, 'SUCCEEDED', TENANT, 'https://r');

    const holding = await accountRepo.findById(holdingId, TENANT);
    expect(holding?.balanceMinorUnits).toBe(90_000); // not 180_000

    const entries = await ledgerRepo.find({ tenantId: TENANT, paymentIntentId: intent.id });
    expect(new Set(entries.entries.map((e) => e.journalId)).size).toBe(1);
  });
});
