/**
 * LIVE DETECTOR — two ledger correctness guards.
 *
 * 1. `LedgerService.voidEntry` must post a BALANCED reversing journal.
 *    The previous implementation posted a single-line reversal, which
 *    `validateJournalBalance` always rejects (debits != credits) — i.e.
 *    `voidEntry` was born-dead and threw "Journal entry is not balanced"
 *    for every non-zero entry. The fix reverses EVERY leg of the source
 *    journal (flip each direction), so the void journal balances and the
 *    touched accounts net back to their pre-journal balances.
 *
 * 2. `voidEntry` is idempotent: a retried void of the same source journal
 *    (at-least-once redelivery) returns the FIRST void journal instead of
 *    double-reversing and over-moving money (journal_idempotency, 0318).
 *
 * Currency is TZS (0-decimal launch currency) so the amounts double as a
 * regression on the minor==major assumption.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  Money,
  createCustomerLiabilityAccount,
  createPlatformHoldingAccount,
  type AccountId,
  type TenantId,
  type LedgerEntryId,
  type CreateJournalEntryRequest,
} from '@bossnyumba/domain-models';
import { LedgerService } from '../services/ledger.service';
import { InMemoryAccountRepository } from '../repositories/account.repository';
import { InMemoryLedgerRepository } from '../repositories/ledger.repository';
import { InMemoryEventPublisher } from '../events/event-publisher';
import { inMemoryTransactionRunner } from '../repositories/transaction';
import '../domain-extensions';

const TENANT = 'tnt_void' as TenantId;
const CUR = 'TZS';
const LIABILITY = 'acc_cust_liability' as AccountId;
const HOLDING = 'acc_platform_holding' as AccountId;

const silentLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function makeService(accountRepo: InMemoryAccountRepository, ledgerRepo: InMemoryLedgerRepository) {
  return new LedgerService({
    ledgerRepository: ledgerRepo,
    accountRepository: accountRepo,
    eventPublisher: new InMemoryEventPublisher(),
    transactionRunner: inMemoryTransactionRunner,
    logger: silentLogger,
  });
}

function paymentJournal(amountMinor: number): CreateJournalEntryRequest {
  const amount = Money.fromMinorUnits(amountMinor, CUR);
  return {
    tenantId: TENANT,
    effectiveDate: new Date(),
    lines: [
      { accountId: LIABILITY, type: 'RENT_PAYMENT', direction: 'CREDIT', amount, description: 'pay' },
      { accountId: HOLDING, type: 'RENT_PAYMENT', direction: 'DEBIT', amount, description: 'recv' },
    ],
    createdBy: 'system',
  };
}

describe('LedgerService.voidEntry — balanced reversal + idempotency', () => {
  let accountRepo: InMemoryAccountRepository;
  let ledgerRepo: InMemoryLedgerRepository;
  let service: LedgerService;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    ledgerRepo = new InMemoryLedgerRepository();
    await accountRepo.create(
      createCustomerLiabilityAccount(LIABILITY, TENANT, 'cust_1' as never, CUR as never, 'system'),
    );
    await accountRepo.create(
      createPlatformHoldingAccount(HOLDING, TENANT, CUR as never, 'system'),
    );
    service = makeService(accountRepo, ledgerRepo);
  });

  it('voids a posted entry by posting a BALANCED reversing journal (does NOT throw)', async () => {
    const posted = await service.postJournalEntry(paymentJournal(50_000));
    const entryToVoid = posted.entries[0];

    // The OLD single-line void threw "Journal entry is not balanced" here.
    const voidResult = await service.voidEntry(
      entryToVoid.id as LedgerEntryId,
      TENANT,
      'duplicate posting',
      'auditor',
    );

    // Void journal has the same number of legs as the source journal.
    expect(voidResult.entries.length).toBe(posted.entries.length);

    // Reversing legs sum to a balanced journal: total debits == total credits.
    const debits = voidResult.entries
      .filter((e) => e.direction === 'DEBIT')
      .reduce((s, e) => s + e.amount.amountMinorUnits, 0);
    const credits = voidResult.entries
      .filter((e) => e.direction === 'CREDIT')
      .reduce((s, e) => s + e.amount.amountMinorUnits, 0);
    expect(debits).toBe(credits);
  });

  it('nets the touched accounts back to zero after the void', async () => {
    const posted = await service.postJournalEntry(paymentJournal(50_000));
    await service.voidEntry(posted.entries[0].id as LedgerEntryId, TENANT, 'reverse', 'auditor');

    const liability = await accountRepo.findById(LIABILITY, TENANT);
    const holding = await accountRepo.findById(HOLDING, TENANT);
    // Post (+50000 / -50000) then full reversal returns both to 0.
    expect(liability?.balanceMinorUnits).toBe(0);
    expect(holding?.balanceMinorUnits).toBe(0);
  });

  it('is idempotent: a retried void of the same source journal does not double-reverse', async () => {
    const posted = await service.postJournalEntry(paymentJournal(50_000));
    const entryId = posted.entries[0].id as LedgerEntryId;

    const first = await service.voidEntry(entryId, TENANT, 'reverse', 'auditor');
    const replay = await service.voidEntry(entryId, TENANT, 'reverse', 'auditor');

    // Same journal served back, flagged as a replay — no second reversal.
    expect(replay.journalId).toBe(first.journalId);
    expect(replay.idempotentReplay).toBe(true);

    // Balances stayed at zero (a double-reversal would have over-moved).
    const liability = await accountRepo.findById(LIABILITY, TENANT);
    const holding = await accountRepo.findById(HOLDING, TENANT);
    expect(liability?.balanceMinorUnits).toBe(0);
    expect(holding?.balanceMinorUnits).toBe(0);
  });
});

describe('LedgerService.postJournalEntry — idempotency key replay (manual routes)', () => {
  let accountRepo: InMemoryAccountRepository;
  let ledgerRepo: InMemoryLedgerRepository;
  let service: LedgerService;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepository();
    ledgerRepo = new InMemoryLedgerRepository();
    await accountRepo.create(
      createCustomerLiabilityAccount(LIABILITY, TENANT, 'cust_1' as never, CUR as never, 'system'),
    );
    await accountRepo.create(
      createPlatformHoldingAccount(HOLDING, TENANT, CUR as never, 'system'),
    );
    service = makeService(accountRepo, ledgerRepo);
  });

  it('replaying the same idempotency key returns the first journal and does not re-post', async () => {
    const key = 'manual-journal-key-001';
    const first = await service.postJournalEntry(paymentJournal(30_000), { idempotencyKey: key });
    const replay = await service.postJournalEntry(paymentJournal(30_000), { idempotencyKey: key });

    expect(replay.journalId).toBe(first.journalId);
    expect(replay.idempotentReplay).toBe(true);

    // Only ONE journal worth of movement landed despite two POSTs: exactly
    // one ledger entry per touched account, not two.
    const liabilityEntries = await ledgerRepo.findByAccount(LIABILITY, TENANT);
    const holdingEntries = await ledgerRepo.findByAccount(HOLDING, TENANT);
    expect(liabilityEntries.total).toBe(1);
    expect(holdingEntries.total).toBe(1);
  });
});
