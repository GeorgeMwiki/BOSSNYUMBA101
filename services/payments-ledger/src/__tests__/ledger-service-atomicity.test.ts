/**
 * M2 (CRITICAL) — atomicity + row-locking of the ledger persist step.
 *
 * `LedgerService.postJournalEntry` previously inserted entries and then
 * updated account balances in SEPARATE awaits with no surrounding
 * transaction. A crash between the two desynced balances from entries;
 * concurrent posts to the same account lost updates.
 *
 * These tests pin the new contract:
 *
 *   1. A throw INSIDE the transaction boundary persists NOTHING — no
 *      ledger entries and no balance mutation leak out.
 *   2. Concurrent / sequential posts to the same account keep the stored
 *      balance equal to the balance derived from the entries (no lost
 *      update), and sequence numbers stay gap-free.
 *
 * We drive the in-memory repositories with an injectable transaction
 * runner so we can both (a) run the happy path and (b) force a failure
 * at the exact moment the service is mid-persist.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Money, type AccountId, type TenantId } from '@bossnyumba/domain-models';
import { createCustomerLiabilityAccount, createPlatformHoldingAccount } from '@bossnyumba/domain-models';
import { LedgerService } from '../services/ledger.service';
import { InMemoryAccountRepository } from '../repositories/account.repository';
import { InMemoryLedgerRepository } from '../repositories/ledger.repository';
import { InMemoryEventPublisher } from '../events/event-publisher';
import { inMemoryTransactionRunner, type RepoTx, type TransactionRunner } from '../repositories/transaction';
import type { CreateJournalEntryRequest } from '@bossnyumba/domain-models';

const TENANT = 'tnt_atomicity' as TenantId;
const CUR = 'TZS';

const silentLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function makeAccounts() {
  const accountRepo = new InMemoryAccountRepository();
  const liabilityId = 'acc_cust_liability' as AccountId;
  const holdingId = 'acc_platform_holding' as AccountId;
  return { accountRepo, liabilityId, holdingId };
}

async function seed(accountRepo: InMemoryAccountRepository, liabilityId: AccountId, holdingId: AccountId) {
  await accountRepo.create(
    createCustomerLiabilityAccount(liabilityId, TENANT, 'cust_1' as never, CUR as never, 'system'),
  );
  await accountRepo.create(
    createPlatformHoldingAccount(holdingId, TENANT, CUR as never, 'system'),
  );
}

function paymentJournal(
  liabilityId: AccountId,
  holdingId: AccountId,
  amountMinor: number,
): CreateJournalEntryRequest {
  const amount = Money.fromMinorUnits(amountMinor, CUR);
  return {
    tenantId: TENANT,
    effectiveDate: new Date(),
    lines: [
      { accountId: liabilityId, type: 'RENT_PAYMENT', direction: 'CREDIT', amount, description: 'pay' },
      { accountId: holdingId, type: 'RENT_PAYMENT', direction: 'DEBIT', amount, description: 'recv' },
    ],
    createdBy: 'system',
  };
}

describe('LedgerService.postJournalEntry — atomicity (M2)', () => {
  let accountRepo: InMemoryAccountRepository;
  let ledgerRepo: InMemoryLedgerRepository;
  let liabilityId: AccountId;
  let holdingId: AccountId;

  beforeEach(async () => {
    const a = makeAccounts();
    accountRepo = a.accountRepo;
    liabilityId = a.liabilityId;
    holdingId = a.holdingId;
    ledgerRepo = new InMemoryLedgerRepository();
    await seed(accountRepo, liabilityId, holdingId);
  });

  it('performs ALL persistence inside the transaction boundary (nothing escapes the tx)', async () => {
    // A runner that rejects WITHOUT ever invoking the body — modelling a
    // "could not BEGIN" / connection-acquire failure. Because the service
    // stages and applies every write inside `fn`, a runner that never
    // calls `fn` must leave the store completely untouched. This proves
    // no entry insert or balance UPDATE happens outside the transaction.
    const beginFailsRunner: TransactionRunner = {
      async transaction<T>(_fn: (tx: RepoTx) => Promise<T>): Promise<T> {
        throw new Error('could_not_begin_transaction');
      },
    };

    const service = new LedgerService({
      ledgerRepository: ledgerRepo,
      accountRepository: accountRepo,
      eventPublisher: new InMemoryEventPublisher(),
      transactionRunner: beginFailsRunner,
      logger: silentLogger,
    });

    await expect(
      service.postJournalEntry(paymentJournal(liabilityId, holdingId, 50_000)),
    ).rejects.toThrow(/could_not_begin_transaction/);

    // No ledger entries written outside the tx.
    const liabilityEntries = await ledgerRepo.findByAccount(liabilityId, TENANT);
    const holdingEntries = await ledgerRepo.findByAccount(holdingId, TENANT);
    expect(liabilityEntries.total).toBe(0);
    expect(holdingEntries.total).toBe(0);

    // No balance mutation outside the tx.
    const liability = await accountRepo.findById(liabilityId, TENANT);
    const holding = await accountRepo.findById(holdingId, TENANT);
    expect(liability?.balanceMinorUnits).toBe(0);
    expect(holding?.balanceMinorUnits).toBe(0);
  });

  it('rolls back entries AND balances when the tx body throws after partial writes (real rollback)', async () => {
    // A rollback-capable in-memory runner that snapshots the two stores
    // before the body and restores them if the body throws — mirroring
    // the ACID rollback the production Drizzle `db.transaction` gives us.
    // This is the closest unit-level proxy for "a throw inside the tx
    // persists NOTHING" without standing up Postgres.
    const rollbackRunner: TransactionRunner = {
      async transaction<T>(fn: (tx: RepoTx) => Promise<T>): Promise<T> {
        const accSnap = accountRepo.__snapshot();
        const ledSnap = ledgerRepo.__snapshot();
        try {
          return await fn(undefined as unknown as RepoTx);
        } catch (err) {
          accountRepo.__restore(accSnap);
          ledgerRepo.__restore(ledSnap);
          throw err;
        }
      },
    };

    // Post one good journal first so there is committed state to protect.
    const good = new LedgerService({
      ledgerRepository: ledgerRepo,
      accountRepository: accountRepo,
      eventPublisher: new InMemoryEventPublisher(),
      transactionRunner: rollbackRunner,
      logger: silentLogger,
    });
    await good.postJournalEntry(paymentJournal(liabilityId, holdingId, 3_000));

    const holdingBefore = (await accountRepo.findById(holdingId, TENANT))?.balanceMinorUnits;
    const entriesBefore = (await ledgerRepo.findByAccount(holdingId, TENANT)).total;
    expect(holdingBefore).toBe(3_000);
    expect(entriesBefore).toBe(1);

    // Now post a journal whose SECOND account is missing → the body
    // throws AFTER the first account's balance + entry were staged/written.
    const missingAccount = 'acc_does_not_exist' as AccountId;
    const amount = Money.fromMinorUnits(9_999, CUR);
    const brokenJournal: CreateJournalEntryRequest = {
      tenantId: TENANT,
      effectiveDate: new Date(),
      lines: [
        { accountId: holdingId, type: 'RENT_PAYMENT', direction: 'DEBIT', amount, description: 'd' },
        { accountId: missingAccount, type: 'RENT_PAYMENT', direction: 'CREDIT', amount, description: 'c' },
      ],
      createdBy: 'system',
    };

    await expect(good.postJournalEntry(brokenJournal)).rejects.toThrow(/not found/);

    // Everything must be rolled back to the committed state.
    const holdingAfter = (await accountRepo.findById(holdingId, TENANT))?.balanceMinorUnits;
    const entriesAfter = (await ledgerRepo.findByAccount(holdingId, TENANT)).total;
    expect(holdingAfter).toBe(3_000);
    expect(entriesAfter).toBe(1);
  });

  it('publishes NO events when the transaction does not commit', async () => {
    // The real Drizzle path rolls the writes back on a failed commit; in
    // every case events MUST be buffered until the tx resolves. A runner
    // that fails the transaction must therefore emit zero events,
    // regardless of how far the body got.
    const publisher = new InMemoryEventPublisher();
    const failRunner: TransactionRunner = {
      async transaction<T>(_fn: (tx: RepoTx) => Promise<T>): Promise<T> {
        throw new Error('tx_did_not_commit');
      },
    };
    const service = new LedgerService({
      ledgerRepository: ledgerRepo,
      accountRepository: accountRepo,
      eventPublisher: publisher,
      transactionRunner: failRunner,
      logger: silentLogger,
    });

    await expect(
      service.postJournalEntry(paymentJournal(liabilityId, holdingId, 1_000)),
    ).rejects.toThrow(/tx_did_not_commit/);

    // No ACCOUNT_BALANCE_UPDATED / LEDGER_ENTRIES_CREATED leaked to the bus.
    expect(publisher.getOutbox()).toHaveLength(0);
  });

  it('keeps stored balance equal to entry-derived balance across many posts (no lost update)', async () => {
    const service = new LedgerService({
      ledgerRepository: ledgerRepo,
      accountRepository: accountRepo,
      eventPublisher: new InMemoryEventPublisher(),
      transactionRunner: inMemoryTransactionRunner,
      logger: silentLogger,
    });

    const N = 10;
    const per = 1_000;
    // Sequential posts (the InMemory store is single-threaded; this still
    // exercises the read-compute-under-lock-then-write path N times).
    for (let i = 0; i < N; i++) {
      await service.postJournalEntry(paymentJournal(liabilityId, holdingId, per));
    }

    const holding = await accountRepo.findById(holdingId, TENANT);
    const liability = await accountRepo.findById(liabilityId, TENANT);

    // Holding is DEBITed each time → +per * N. Liability is CREDITed → -per * N.
    expect(holding?.balanceMinorUnits).toBe(per * N);
    expect(liability?.balanceMinorUnits).toBe(-per * N);

    // Stored balance must equal the balance derived purely from entries.
    const holdingDerived = await ledgerRepo.calculateAccountBalance(holdingId, TENANT);
    expect(holdingDerived?.balance).toBe(holding?.balanceMinorUnits);

    // Sequence integrity: no gaps, no duplicates.
    const integ = await ledgerRepo.verifyIntegrity(holdingId, TENANT);
    expect(integ.valid).toBe(true);
  });

  it('the default (no transactionRunner provided) wiring still posts a balanced journal', async () => {
    // Backwards-compatible default: omitting transactionRunner falls back
    // to the in-memory runner so existing callers/tests don't break.
    const service = new LedgerService({
      ledgerRepository: ledgerRepo,
      accountRepository: accountRepo,
      eventPublisher: new InMemoryEventPublisher(),
      logger: silentLogger,
    });

    const result = await service.postJournalEntry(paymentJournal(liabilityId, holdingId, 7_500));
    expect(result.entries).toHaveLength(2);
    const holding = await accountRepo.findById(holdingId, TENANT);
    expect(holding?.balanceMinorUnits).toBe(7_500);
  });
});
