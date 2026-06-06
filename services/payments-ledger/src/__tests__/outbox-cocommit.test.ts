/**
 * MUST-FIX 3a (HIGH) — the transactional outbox must CO-COMMIT with the
 * ledger write.
 *
 * Before this fix, `LedgerService.postJournalEntry` published events in
 * Phase 3 AFTER the ledger `db.transaction` committed, and
 * `DurableEventPublisher.publish` wrote the `event_outbox` rows via the
 * top-level `db` (a SEPARATE transaction). A crash between the ledger
 * commit and the outbox write LOSES the event — the entries + balances
 * are durable but no PAYMENT/ledger event ever reaches the relay.
 *
 * The fix threads the ledger's transaction handle (`RepoTx`) into the
 * outbox write so `event_outbox` rows commit ATOMICALLY with the entries
 * and balance updates. In-process `notifyHandlers` stays post-commit so
 * live subscribers still fire.
 *
 * These tests pin:
 *   1. The outbox rows are written INSIDE the ledger transaction (the
 *      same `tx` handle the runner provided), not after commit.
 *   2. When the ledger transaction ROLLS BACK, zero outbox rows survive
 *      (no event leaks for an uncommitted ledger write).
 *   3. In-process subscribers are still notified after a successful post.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  Money,
  createCustomerLiabilityAccount,
  createPlatformHoldingAccount,
  type AccountId,
  type CreateJournalEntryRequest,
  type TenantId,
} from '@bossnyumba/domain-models';
import { LedgerService } from '../services/ledger.service';
import { InMemoryAccountRepository } from '../repositories/account.repository';
import { InMemoryLedgerRepository } from '../repositories/ledger.repository';
import {
  DurableEventPublisher,
  type IOutboxRepository,
  type OutboxEntry,
} from '../events/event-publisher';
import type { RepoTx, TransactionRunner } from '../repositories/transaction';
import type { PaymentSucceededEvent } from '../events/payment-events';

const TENANT = 'tnt_cocommit' as TenantId;
const CUR = 'TZS';

const silentLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/**
 * Outbox fake that distinguishes rows written INSIDE a tx (staged) from
 * rows committed. `addToOutbox(entries, tx)` stages against the tx; the
 * runner "commits" the staged rows when the body resolves, or drops them
 * on rollback — mirroring the real DB's transactional outbox.
 */
function makeTxAwareOutbox() {
  const committed: OutboxEntry[] = [];
  // tx handle -> staged rows for that tx.
  const staged = new Map<object, OutboxEntry[]>();
  let sawTxOnWrite = false;

  const repo: IOutboxRepository & {
    addToOutbox(entries: OutboxEntry[], tx?: RepoTx): Promise<void>;
  } = {
    async addToOutbox(entries: OutboxEntry[], tx?: RepoTx): Promise<void> {
      if (tx) {
        sawTxOnWrite = true;
        const bucket = staged.get(tx as object) ?? [];
        bucket.push(...entries);
        staged.set(tx as object, bucket);
      } else {
        // Non-tx write commits immediately (the pre-fix behaviour).
        committed.push(...entries);
      }
    },
    async getUnpublished(limit: number) {
      return committed.filter((r) => !r.publishedAt).slice(0, limit);
    },
    async markPublished(id: string) {
      const r = committed.find((x) => x.id === id);
      if (r) r.publishedAt = new Date();
    },
    async recordFailure(id: string, error: string) {
      const r = committed.find((x) => x.id === id);
      if (r) {
        r.retryCount += 1;
        r.lastError = error;
      }
    },
    async cleanup() {
      return 0;
    },
  };

  return {
    repo,
    committed,
    get sawTxOnWrite() {
      return sawTxOnWrite;
    },
    commitTx(tx: object) {
      const bucket = staged.get(tx);
      if (bucket) committed.push(...bucket);
      staged.delete(tx);
    },
    rollbackTx(tx: object) {
      staged.delete(tx);
    },
  };
}

/**
 * A runner that hands a stable sentinel `tx` to the body and, on success,
 * commits the outbox's staged rows for that tx; on failure, rolls them
 * back. This is the unit-level proxy for the real Drizzle transaction's
 * atomic commit/rollback over BOTH the ledger writes and the outbox rows.
 */
function makeCoCommitRunner(outbox: ReturnType<typeof makeTxAwareOutbox>): {
  runner: TransactionRunner;
  tx: object;
} {
  const tx = { __sentinel: 'tx' };
  return {
    tx,
    runner: {
      async transaction<T>(fn: (tx: RepoTx) => Promise<T>): Promise<T> {
        try {
          const result = await fn(tx as unknown as RepoTx);
          outbox.commitTx(tx);
          return result;
        } catch (err) {
          outbox.rollbackTx(tx);
          throw err;
        }
      },
    },
  };
}

function seedAccounts() {
  const accountRepo = new InMemoryAccountRepository();
  const holdingId = 'acc_holding_cc' as AccountId;
  const liabilityId = 'acc_liability_cc' as AccountId;
  return { accountRepo, holdingId, liabilityId };
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

describe('LedgerService outbox co-commit (MUST-FIX 3a)', () => {
  let accountRepo: InMemoryAccountRepository;
  let ledgerRepo: InMemoryLedgerRepository;
  let holdingId: AccountId;
  let liabilityId: AccountId;

  beforeEach(async () => {
    const a = seedAccounts();
    accountRepo = a.accountRepo;
    holdingId = a.holdingId;
    liabilityId = a.liabilityId;
    ledgerRepo = new InMemoryLedgerRepository();
    await accountRepo.create(createPlatformHoldingAccount(holdingId, TENANT, CUR as never, 'system'));
    await accountRepo.create(
      createCustomerLiabilityAccount(liabilityId, TENANT, 'cust_cc' as never, CUR as never, 'system'),
    );
  });

  it('writes outbox rows INSIDE the ledger transaction (atomic with entries+balances)', async () => {
    const outbox = makeTxAwareOutbox();
    const publisher = new DurableEventPublisher(outbox.repo);
    const { runner } = makeCoCommitRunner(outbox);

    const service = new LedgerService({
      ledgerRepository: ledgerRepo,
      accountRepository: accountRepo,
      eventPublisher: publisher,
      transactionRunner: runner,
      logger: silentLogger,
    });

    await service.postJournalEntry(paymentJournal(liabilityId, holdingId, 12_000));

    // The outbox write must have been handed the tx handle (co-commit),
    // not the top-level db.
    expect(outbox.sawTxOnWrite).toBe(true);

    // After commit, the events are durable: balance-updated (x2 accounts)
    // + ledger-entries-created.
    const types = outbox.committed.map((r) => r.eventType).sort();
    expect(outbox.committed.length).toBeGreaterThanOrEqual(3);
    expect(types).toContain('LEDGER_ENTRIES_CREATED');
    expect(types).toContain('ACCOUNT_BALANCE_UPDATED');
  });

  it('rolls back co-committed outbox rows when the COMMIT itself fails (no orphaned event)', async () => {
    // Model the exact crash MUST-FIX 3a targets: the body runs to
    // completion (ledger entries + balances + outbox rows all STAGED on
    // the tx), then the COMMIT fails. Because the outbox rows are on the
    // same tx, they must roll back with the ledger write — zero committed.
    const outbox = makeTxAwareOutbox();
    const publisher = new DurableEventPublisher(outbox.repo);

    const tx = { __sentinel: 'tx-commit-fail' };
    const commitFailsRunner: TransactionRunner = {
      async transaction<T>(fn: (handle: RepoTx) => Promise<T>): Promise<T> {
        try {
          await fn(tx as unknown as RepoTx); // body succeeds → rows staged
          // Commit fails → roll back BOTH ledger and the staged outbox.
          outbox.rollbackTx(tx);
          throw new Error('commit_failed');
        } catch (err) {
          outbox.rollbackTx(tx);
          throw err;
        }
      },
    };

    const service = new LedgerService({
      ledgerRepository: ledgerRepo,
      accountRepository: accountRepo,
      eventPublisher: publisher,
      transactionRunner: commitFailsRunner,
      logger: silentLogger,
    });

    await expect(
      service.postJournalEntry(paymentJournal(liabilityId, holdingId, 9_000)),
    ).rejects.toThrow(/commit_failed/);

    // The outbox rows were STAGED inside the tx (proving co-commit), then
    // rolled back with the failed commit → none survive. No event leaks
    // for an uncommitted ledger write; equally none is lost for a
    // committed one (covered by the success test above).
    expect(outbox.sawTxOnWrite).toBe(true);
    expect(outbox.committed).toHaveLength(0);
  });

  it('no event leaks when the tx body throws before the outbox write', async () => {
    const outbox = makeTxAwareOutbox();
    const publisher = new DurableEventPublisher(outbox.repo);
    const { runner } = makeCoCommitRunner(outbox);

    const service = new LedgerService({
      ledgerRepository: ledgerRepo,
      accountRepository: accountRepo,
      eventPublisher: publisher,
      transactionRunner: runner,
      logger: silentLogger,
    });

    // SECOND account missing → body throws before reaching the enqueue.
    const missing = 'acc_missing_cc' as AccountId;
    const amount = Money.fromMinorUnits(9_000, CUR);
    const broken: CreateJournalEntryRequest = {
      tenantId: TENANT,
      effectiveDate: new Date(),
      lines: [
        { accountId: holdingId, type: 'RENT_PAYMENT', direction: 'DEBIT', amount, description: 'd' },
        { accountId: missing, type: 'RENT_PAYMENT', direction: 'CREDIT', amount, description: 'c' },
      ],
      createdBy: 'system',
    };

    await expect(service.postJournalEntry(broken)).rejects.toThrow(/not found/);
    expect(outbox.committed).toHaveLength(0);
  });

  it('still notifies in-process subscribers after a successful post', async () => {
    const outbox = makeTxAwareOutbox();
    const publisher = new DurableEventPublisher(outbox.repo);
    const { runner } = makeCoCommitRunner(outbox);

    const seen: string[] = [];
    publisher.subscribe<PaymentSucceededEvent>('LEDGER_ENTRIES_CREATED' as never, async (e) => {
      seen.push(e.eventType);
    });

    const service = new LedgerService({
      ledgerRepository: ledgerRepo,
      accountRepository: accountRepo,
      eventPublisher: publisher,
      transactionRunner: runner,
      logger: silentLogger,
    });

    await service.postJournalEntry(paymentJournal(liabilityId, holdingId, 5_000));

    // Live subscriber fired for the ledger-entries-created event.
    expect(seen).toContain('LEDGER_ENTRIES_CREATED');
  });
});
