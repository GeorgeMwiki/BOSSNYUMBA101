/**
 * Ledger Service
 * Manages the immutable double-entry ledger
 */
import { v4 as uuidv4 } from 'uuid';
import {
  Money,
  LedgerEntry,
  LedgerEntryId,
  AccountId,
  TenantId,
  Account,
  AccountAggregate,
  CreateJournalEntryRequest,
  JournalEntryLine,
  validateJournalBalance,
  createJournalId,
  CurrencyCode,
  PaymentIntentId
} from '@bossnyumba/domain-models';
import { createId } from '../domain-extensions';
import { ILedgerRepository, AccountBalance } from '../repositories/ledger.repository';
import { IAccountRepository } from '../repositories/account.repository';
import { IEventPublisher, createEvent } from '../events/event-publisher';
import type { PaymentDomainEvent } from '../events/payment-events';
import {
  LedgerEntriesCreatedEvent,
  AccountBalanceUpdatedEvent
} from '../events/payment-events';
import { ILogger } from './payment-orchestration.service';
import {
  inMemoryTransactionRunner,
  type RepoTx,
  type TransactionRunner,
} from '../repositories/transaction';

export interface LedgerServiceDeps {
  ledgerRepository: ILedgerRepository;
  accountRepository: IAccountRepository;
  eventPublisher: IEventPublisher;
  logger: ILogger;
  /**
   * Runs the persist step (entry insert + account balance updates)
   * inside ONE transaction (M2). Production passes the shared Drizzle
   * client; tests/dev may omit it and get the single-threaded in-memory
   * runner. The in-memory runner provides no rollback — correctness for
   * the InMemory adapters comes from staging all writes until after the
   * read/compute phase.
   */
  transactionRunner?: TransactionRunner;
}

/**
 * One account's net effect within a single journal: the balance delta
 * (sum of this journal's lines on the account) plus the per-line entries
 * to write. The actual starting balance + sequence numbers are read
 * UNDER THE ROW LOCK inside the transaction, not here.
 */
interface StagedAccount {
  accountId: AccountId;
  /** Net minor-unit delta to apply to the account balance. */
  deltaMinorUnits: number;
  /** Lines for this account, in journal order. */
  lines: JournalEntryLine[];
}

/**
 * Result of posting a journal entry
 */
export interface JournalPostResult {
  journalId: string;
  entries: LedgerEntry[];
  updatedAccounts: Account[];
  /**
   * True when this result was served from a prior post via the
   * idempotency key (durability defect #2) rather than freshly written.
   * No second post occurred; balances were not touched again.
   */
  idempotentReplay?: boolean;
}

/**
 * Optional controls for a journal post.
 */
export interface PostJournalOptions {
  /**
   * Idempotency key (durability defect #2). When supplied, the post is
   * recorded under a UNIQUE (tenant_id, idempotency_key) guarantee; a
   * retry with the same key returns the ORIGINAL journal result instead
   * of double-posting.
   */
  readonly idempotencyKey?: string;
}

/**
 * H3 — idempotency replay defense (defense-in-depth). Thrown LOUD when a
 * post arrives under an idempotency key that already maps to a journal
 * whose leg amounts/accounts/directions DIFFER from this request's
 * recomputed legs. Serving the stale journal silently would let a caller
 * reuse a key for a different transaction and get back the wrong money;
 * we refuse instead. (The gateway also pins the key to the request body;
 * this is the engine backstop in case that ever regresses.)
 */
export class IdempotencyMismatchError extends Error {
  readonly code = 'LEDGER_IDEMPOTENCY_MISMATCH';
  constructor(
    public readonly idempotencyKey: string,
    public readonly journalId: string,
    public readonly tenantId: TenantId,
  ) {
    super(
      `LEDGER_IDEMPOTENCY_MISMATCH: idempotency key '${idempotencyKey}' was already used for journal ` +
        `${journalId} (tenant ${tenantId}) with different legs. Refusing to serve a stale journal for a ` +
        `mismatched request.`,
    );
    this.name = 'IdempotencyMismatchError';
  }
}

/**
 * H3 — canonical leg signature for idempotency-replay comparison. We
 * compare the IMMUTABLE financial substance of each leg: account,
 * direction, type, amount (minor units), and currency. The signature is
 * a SORTED list (not keyed by account) so it is order-independent AND
 * correct when two legs touch the SAME account (the same-account fold
 * case) — a map keyed by account would collapse those and miss a
 * mismatch.
 *
 * `balanceAfter` / sequenceNumber / ids are deliberately excluded: they
 * are derived per-post state, not part of the caller's request intent.
 */
function legSignature(
  legs: ReadonlyArray<{
    readonly accountId: string;
    readonly direction: string;
    readonly type: string;
    readonly amountMinorUnits: number;
    readonly currency: string;
  }>,
): string {
  return legs
    .map(
      (l) =>
        `${l.accountId}|${l.direction}|${l.type}|${l.amountMinorUnits}|${l.currency}`,
    )
    .sort()
    .join(';;');
}

/**
 * Ledger Service
 * Provides atomic, double-entry bookkeeping operations
 */
export class LedgerService {
  private ledgerRepository: ILedgerRepository;
  private accountRepository: IAccountRepository;
  private eventPublisher: IEventPublisher;
  private logger: ILogger;
  private transactionRunner: TransactionRunner;

  constructor(deps: LedgerServiceDeps) {
    this.ledgerRepository = deps.ledgerRepository;
    this.accountRepository = deps.accountRepository;
    this.eventPublisher = deps.eventPublisher;
    this.logger = deps.logger;
    this.transactionRunner = deps.transactionRunner ?? inMemoryTransactionRunner;
  }

  /**
   * Post a journal entry (atomic double-entry operation).
   *
   * Durability guarantees:
   *   - ATOMICITY: balance writes AND entry inserts commit inside ONE
   *     transaction. There is no window where balances move without
   *     matching entries.
   *   - #2 IDEMPOTENCY: when `options.idempotencyKey` is supplied, a
   *     retried post returns the ORIGINAL journal (no second post). The
   *     dedupe row is written on the SAME tx as the entries + balances,
   *     so a replay can never be served before the journal it points at
   *     is durable.
   *   - BALANCE: rejected unless debits == credits (integer minor units).
   */
  async postJournalEntry(
    request: CreateJournalEntryRequest,
    options: PostJournalOptions = {},
  ): Promise<JournalPostResult> {
    // Validate that the journal is balanced
    if (!validateJournalBalance(request.lines)) {
      throw new Error('Journal entry is not balanced: debits must equal credits');
    }

    if (request.lines.length === 0) {
      throw new Error('Journal entry must have at least one line');
    }

    // Durability defect #2 — fast-path idempotency check. A prior post
    // under this key returns its journal without touching balances. The
    // in-tx re-check below closes the race between two concurrent first
    // posts of the same key.
    if (options.idempotencyKey !== undefined) {
      const existingJournalId =
        await this.ledgerRepository.findJournalIdByIdempotencyKey(
          request.tenantId,
          options.idempotencyKey,
        );
      if (existingJournalId !== null) {
        // H3 — pass the request so a mismatched replay throws LOUD.
        return this.loadExistingJournalResult(
          existingJournalId,
          request.tenantId,
          request,
          options.idempotencyKey,
        );
      }
    }

    const journalId = createJournalId();
    const now = new Date();

    // ── Phase 1: aggregate the journal per account ──────────────────
    // A journal may touch the same account on multiple lines (e.g. the
    // rentPayment template debits + credits the holding account). We
    // group lines by account and pre-sum the net balance delta so each
    // account is locked and updated exactly once inside the transaction.
    const staged = new Map<AccountId, StagedAccount>();
    for (const line of request.lines) {
      const signed =
        line.direction === 'DEBIT'
          ? line.amount.amountMinorUnits
          : -line.amount.amountMinorUnits;
      const existing = staged.get(line.accountId);
      if (existing) {
        existing.deltaMinorUnits += signed;
        existing.lines.push(line);
      } else {
        staged.set(line.accountId, {
          accountId: line.accountId,
          deltaMinorUnits: signed,
          lines: [line],
        });
      }
    }

    // Domain events for this post. The DURABLE outbox rows are written
    // INSIDE the tx (co-commit, MUST-FIX 3a) so a crash between the ledger
    // commit and the outbox write cannot lose them. In-process subscribers
    // are notified ONLY after the tx commits (Phase 3), so a rolled-back
    // post notifies nobody (M2).
    const pendingEvents: PaymentDomainEvent[] = [];

    // ── Phase 2: atomic, row-locked persist + co-committed outbox ────
    const { savedEntries, updatedAccounts } = await this.transactionRunner.transaction(
      async (tx: RepoTx) => {
        const entries: LedgerEntry[] = [];
        const updated: Account[] = [];

        for (const group of staged.values()) {
          // Lock the account row for the duration of the transaction so
          // concurrent posts to the same account serialise (no lost
          // read-modify-write).
          const account = await this.accountRepository.findByIdForUpdate(
            group.accountId,
            request.tenantId,
            tx,
          );
          if (!account) {
            throw new Error(`Account ${group.accountId} not found`);
          }

          const aggregate = new AccountAggregate(account);
          if (!aggregate.canTransact()) {
            throw new Error(`Account ${group.accountId} is not active`);
          }

          // Walk this account's lines in order, threading a running
          // balance that starts from the locked snapshot, so each
          // entry's balanceAfter is correct even for multi-line groups.
          let runningBalance = Money.fromMinorUnits(
            account.balanceMinorUnits,
            account.currency,
          );
          // Sequence numbers are read UNDER the lock; we increment
          // locally across this account's lines within the journal.
          let nextSeq = await this.ledgerRepository.getNextSequenceNumber(
            group.accountId,
            request.tenantId,
            tx,
          );

          let lastEntryId: LedgerEntryId | null = null;
          for (const line of group.lines) {
            // Currency check against the locked row.
            if (line.amount.currency !== account.currency) {
              throw new Error(
                `Currency mismatch: account ${group.accountId} is ${account.currency}, ` +
                `but entry is ${line.amount.currency}`,
              );
            }

            runningBalance =
              line.direction === 'DEBIT'
                ? runningBalance.add(line.amount)
                : runningBalance.subtract(line.amount);

            const entryId = createId<LedgerEntryId>(`le_${uuidv4()}`);
            lastEntryId = entryId;
            entries.push({
              id: entryId,
              tenantId: request.tenantId,
              accountId: line.accountId,
              journalId,
              type: line.type,
              direction: line.direction,
              amount: line.amount,
              balanceAfter: runningBalance,
              sequenceNumber: nextSeq,
              effectiveDate: request.effectiveDate,
              postedAt: now,
              paymentIntentId: request.paymentIntentId,
              leaseId: line.leaseId,
              propertyId: line.propertyId,
              unitId: line.unitId,
              description: line.description,
              metadata: line.metadata,
              createdAt: now,
              createdBy: request.createdBy,
              updatedAt: now,
              updatedBy: request.createdBy,
            });
            nextSeq += 1;
          }

          // Persist the account's new balance on the SAME tx. We write
          // the final running balance (after all of this account's
          // lines) and point lastEntryId at the last entry posted.
          const previousBalanceData = Money.fromMinorUnits(
            account.balanceMinorUnits,
            account.currency,
          ).toData();
          aggregate.updateBalance(runningBalance, lastEntryId!);
          // Reflect every line we posted in entryCount. `updateBalance`
          // bumps by one; set it UNCONDITIONALLY to the locked snapshot +
          // this group's line count so entry_count stays in step with the
          // ledger for single- AND multi-line groups (SHOULD-FIX — it also
          // doubles as the optimistic-lock version, so an off-by-one on the
          // single-line path would weaken that guard).
          const updatedAccount = aggregate.toData();
          updatedAccount.entryCount = account.entryCount + group.lines.length;
          await this.accountRepository.update(updatedAccount, tx);
          updated.push(updatedAccount);

          pendingEvents.push(
            createEvent<AccountBalanceUpdatedEvent>(
              'ACCOUNT_BALANCE_UPDATED',
              'Account',
              group.accountId,
              request.tenantId,
              {
                previousBalance: previousBalanceData,
                newBalance: runningBalance.toData(),
                lastEntryId: lastEntryId!,
              },
            ),
          );
        }

        // Insert ALL entries on the same tx — commits or rolls back
        // together with the balance updates above.
        const saved = await this.ledgerRepository.createEntries(entries, tx);

        // Durability defect #2 — persist the (tenant, key) -> journalId
        // dedupe row on the SAME tx as the entries + balances. A retried
        // post under this key then short-circuits to the original journal
        // (no second post). Co-committing it means a replay can never be
        // served before the journal it points at is durable, and a rolled
        // -back post leaves no orphaned dedupe row. The composite PK
        // (tenant_id, idempotency_key) rejects a racing concurrent insert;
        // that unique-violation rolls the WHOLE tx back, and the retry hits
        // the now-present row via the fast-path check above.
        if (options.idempotencyKey !== undefined) {
          await this.ledgerRepository.insertJournalIdempotency(
            request.tenantId,
            options.idempotencyKey,
            journalId,
            tx,
          );
        }

        // Build the journal-level event now that entries are persisted,
        // then co-commit EVERY event for this post to the durable outbox
        // ON THIS TX (MUST-FIX 3a). If the tx rolls back, these outbox
        // rows roll back with the entries + balances — no orphaned event,
        // no lost event. We do NOT notify in-process handlers here; that
        // happens post-commit in Phase 3.
        pendingEvents.push(
          createEvent<LedgerEntriesCreatedEvent>(
            'LEDGER_ENTRIES_CREATED',
            'Ledger',
            journalId,
            request.tenantId,
            {
              journalId,
              entries: saved.map(e => ({
                entryId: e.id,
                accountId: e.accountId,
                type: e.type,
                direction: e.direction,
                amount: e.amount.toData()
              })),
              paymentIntentId: request.paymentIntentId
            }
          )
        );

        if (this.eventPublisher.enqueueToOutbox) {
          await this.eventPublisher.enqueueToOutbox(pendingEvents, tx);
        }

        return { savedEntries: saved, updatedAccounts: updated };
      },
    );

    // ── Phase 3: deliver to in-process subscribers AFTER commit ──────
    // The durable outbox rows were already co-committed inside the tx
    // (MUST-FIX 3a). Here we only fan out to live in-process subscribers.
    // When the publisher does not implement the co-commit pair (e.g. a
    // minimal test fake), fall back to the legacy post-commit publish so
    // the durable write still happens.
    // TODO(outbox-relay): a cross-process relay must drain Postgres
    // `event_outbox` (status='pending') into the api-gateway event bus and
    // mark rows published. Co-commit guarantees the row is written
    // atomically with the ledger, but nothing yet ships it to other
    // processes. Out of scope for this fix; tracked as a follow-up.
    if (this.eventPublisher.enqueueToOutbox && this.eventPublisher.notifySubscribers) {
      await this.eventPublisher.notifySubscribers(pendingEvents);
    } else {
      for (const event of pendingEvents) {
        await this.eventPublisher.publish(event);
      }
    }

    this.logger.info('Journal entry posted', {
      journalId,
      tenantId: request.tenantId,
      entryCount: savedEntries.length
    });

    return {
      journalId,
      entries: savedEntries,
      updatedAccounts
    };
  }

  /**
   * Reconstruct a `JournalPostResult` for a previously-posted journal —
   * used to serve an idempotent replay (durability defect #2) without
   * re-posting. Returns the persisted entries and the CURRENT account
   * snapshots for the touched accounts.
   *
   * H3 — when `replayedRequest` is supplied, the persisted journal's legs
   * are compared to that request's recomputed legs BEFORE serving; a
   * divergence throws `IdempotencyMismatchError` (LOUD) instead of
   * returning a stale journal for a mismatched request. The
   * `idempotencyKey` is threaded only for the error message.
   */
  private async loadExistingJournalResult(
    journalId: string,
    tenantId: TenantId,
    replayedRequest?: CreateJournalEntryRequest,
    idempotencyKey?: string,
  ): Promise<JournalPostResult> {
    const entries = await this.ledgerRepository.findByJournalId(
      journalId,
      tenantId,
    );

    // H3 — defense-in-depth replay check. Reuse of one idempotency key
    // for a DIFFERENT transaction must fail loud, not silently return the
    // first journal. Compare order-independent leg signatures.
    if (replayedRequest !== undefined) {
      const existingSig = legSignature(
        entries.map((e) => ({
          accountId: String(e.accountId),
          direction: e.direction,
          type: e.type,
          amountMinorUnits: e.amount.amountMinorUnits,
          currency: e.amount.currency,
        })),
      );
      const incomingSig = legSignature(
        replayedRequest.lines.map((l) => ({
          accountId: String(l.accountId),
          direction: l.direction,
          type: l.type,
          amountMinorUnits: l.amount.amountMinorUnits,
          currency: l.amount.currency,
        })),
      );
      if (existingSig !== incomingSig) {
        this.logger.error(
          'ledger: idempotency-key REPLAY MISMATCH — refusing to serve stale journal',
          {
            tenantId,
            journalId,
            idempotencyKey,
          },
        );
        throw new IdempotencyMismatchError(
          idempotencyKey ?? '(unknown)',
          journalId,
          tenantId,
        );
      }
    }

    const accountIds = Array.from(new Set(entries.map((e) => e.accountId)));
    const updatedAccounts: Account[] = [];
    for (const accountId of accountIds) {
      const account = await this.accountRepository.findById(accountId, tenantId);
      if (account) {
        updatedAccounts.push(account);
      }
    }
    this.logger.info('Journal entry idempotent replay (no re-post)', {
      journalId,
      tenantId,
      entryCount: entries.length,
    });
    return {
      journalId,
      entries,
      updatedAccounts,
      idempotentReplay: true,
    };
  }

  /**
   * Get account balance
   */
  async getAccountBalance(
    accountId: AccountId,
    tenantId: TenantId
  ): Promise<Money | null> {
    const account = await this.accountRepository.findById(accountId, tenantId);
    if (!account) {
      return null;
    }
    return Money.fromMinorUnits(account.balanceMinorUnits, account.currency);
  }

  /**
   * Get account balance at a specific date (calculated from entries)
   */
  async getAccountBalanceAsOf(
    accountId: AccountId,
    tenantId: TenantId,
    asOfDate: Date
  ): Promise<AccountBalance | null> {
    return this.ledgerRepository.calculateAccountBalance(accountId, tenantId, asOfDate);
  }

  /**
   * Get ledger entries for an account
   */
  async getAccountEntries(
    accountId: AccountId,
    tenantId: TenantId,
    page?: number,
    pageSize?: number
  ) {
    return this.ledgerRepository.findByAccount(accountId, tenantId, page, pageSize);
  }

  /**
   * Get entries by journal ID
   */
  async getJournalEntries(journalId: string, tenantId: TenantId): Promise<LedgerEntry[]> {
    return this.ledgerRepository.findByJournalId(journalId, tenantId);
  }

  /**
   * Find ledger entries posted against a given payment intent.
   *
   * Used by the payment-success path (M5) as the idempotency check: a
   * journal is posted for a succeeded payment only if none already
   * exists for its paymentIntentId, so webhook redelivery cannot
   * double-credit.
   */
  async findEntriesByPaymentIntent(
    paymentIntentId: PaymentIntentId,
    tenantId: TenantId,
  ): Promise<LedgerEntry[]> {
    const result = await this.ledgerRepository.find({ tenantId, paymentIntentId });
    return result.entries;
  }

  /**
   * Verify ledger integrity for an account
   */
  async verifyAccountIntegrity(
    accountId: AccountId,
    tenantId: TenantId
  ): Promise<{ valid: boolean; calculatedBalance: Money | null; storedBalance: Money | null; discrepancy: Money | null }> {
    // Get stored balance
    const account = await this.accountRepository.findById(accountId, tenantId);
    if (!account) {
      return { valid: false, calculatedBalance: null, storedBalance: null, discrepancy: null };
    }
    const storedBalance = Money.fromMinorUnits(account.balanceMinorUnits, account.currency);

    // Calculate balance from entries
    const calculatedResult = await this.ledgerRepository.calculateAccountBalance(accountId, tenantId);
    if (!calculatedResult) {
      // No entries - balance should be zero
      const valid = storedBalance.isZero();
      return {
        valid,
        calculatedBalance: Money.zero(account.currency),
        storedBalance,
        discrepancy: valid ? null : storedBalance
      };
    }

    const calculatedBalance = Money.fromMinorUnits(calculatedResult.balance, account.currency);
    const valid = calculatedBalance.equals(storedBalance);

    return {
      valid,
      calculatedBalance,
      storedBalance,
      discrepancy: valid ? null : storedBalance.subtract(calculatedBalance)
    };
  }

  /**
   * Verify sequence integrity (no gaps or duplicates)
   */
  async verifySequenceIntegrity(
    accountId: AccountId,
    tenantId: TenantId
  ) {
    return this.ledgerRepository.verifyIntegrity(accountId, tenantId);
  }

  /**
   * Get entries for statement generation
   */
  async getEntriesForStatement(
    accountId: AccountId,
    tenantId: TenantId,
    fromDate: Date,
    toDate: Date
  ): Promise<LedgerEntry[]> {
    return this.ledgerRepository.findForStatement(accountId, tenantId, fromDate, toDate);
  }

  /**
   * Get totals by entry type for a period
   */
  async getTotalsByType(
    accountId: AccountId,
    tenantId: TenantId,
    fromDate: Date,
    toDate: Date
  ) {
    return this.ledgerRepository.getTotalsByType(accountId, tenantId, fromDate, toDate);
  }

  /**
   * Get account statement for a period
   * Returns a structured statement with opening/closing balances and all entries
   */
  async getStatement(
    accountId: AccountId,
    tenantId: TenantId,
    fromDate: Date,
    toDate: Date
  ): Promise<{
    accountId: AccountId;
    periodStart: Date;
    periodEnd: Date;
    openingBalance: Money;
    closingBalance: Money;
    totalDebits: Money;
    totalCredits: Money;
    entries: LedgerEntry[];
    currency: CurrencyCode;
  }> {
    // Get account for currency
    const account = await this.accountRepository.findById(accountId, tenantId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // Calculate opening balance (balance as of instant before period start).
    // Use UTC arithmetic — getDate/setHours depend on the server's local
    // timezone and silently shift the boundary when not at UTC. The
    // "1 ms before fromDate" instant is timezone-invariant.
    const openingBalanceDate = new Date(fromDate.getTime() - 1);

    const openingBalanceResult = await this.ledgerRepository.calculateAccountBalance(
      accountId,
      tenantId,
      openingBalanceDate
    );
    const openingBalance = openingBalanceResult
      ? Money.fromMinorUnits(openingBalanceResult.balance, account.currency)
      : Money.zero(account.currency);

    // Get entries for the period
    const entries = await this.ledgerRepository.findForStatement(
      accountId,
      tenantId,
      fromDate,
      toDate
    );

    // Calculate totals
    let totalDebitsMinor = 0;
    let totalCreditsMinor = 0;

    for (const entry of entries) {
      if (entry.direction === 'DEBIT') {
        totalDebitsMinor += entry.amount.amountMinorUnits;
      } else {
        totalCreditsMinor += entry.amount.amountMinorUnits;
      }
    }

    // Calculate closing balance
    const closingBalance = openingBalance
      .add(Money.fromMinorUnits(totalDebitsMinor, account.currency))
      .subtract(Money.fromMinorUnits(totalCreditsMinor, account.currency));

    return {
      accountId,
      periodStart: fromDate,
      periodEnd: toDate,
      openingBalance,
      closingBalance,
      totalDebits: Money.fromMinorUnits(totalDebitsMinor, account.currency),
      totalCredits: Money.fromMinorUnits(totalCreditsMinor, account.currency),
      entries,
      currency: account.currency,
    };
  }

  /**
   * Post a correction entry (immutable - reverses original and creates new entry)
   * This maintains the immutability principle by never modifying existing entries
   */
  async postCorrectionEntry(
    originalEntryId: LedgerEntryId,
    tenantId: TenantId,
    correctionReason: string,
    correctedAmount: Money,
    createdBy: string
  ): Promise<JournalPostResult> {
    // Get original entry
    const originalEntry = await this.ledgerRepository.findById(originalEntryId, tenantId);
    if (!originalEntry) {
      throw new Error(`Original entry ${originalEntryId} not found`);
    }

    // Validate currencies match
    if (correctedAmount.currency !== originalEntry.amount.currency) {
      throw new Error(
        `Currency mismatch: original is ${originalEntry.amount.currency}, correction is ${correctedAmount.currency}`
      );
    }

    const now = new Date();
    const journalId = createJournalId();

    // Create reversal entry (opposite direction of original)
    const reversalDirection = originalEntry.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';

    // Create correcting entry (same direction as original with corrected amount)
    const correctionEntries: CreateJournalEntryRequest = {
      tenantId,
      effectiveDate: now,
      lines: [
        // Reversal of original
        {
          accountId: originalEntry.accountId,
          // CORRECTION isn't in @bossnyumba/domain-models' narrower
          // LedgerEntryType union (only the canonical trial-balance
          // categories are there). The local LedgerEntryType (./types.ts)
          // extends it with CORRECTION for void/correction semantics —
          // cast through the narrower union to bridge until the domain
          // type is widened upstream.
          type: 'CORRECTION' as unknown as JournalEntryLine['type'],
          direction: reversalDirection,
          amount: originalEntry.amount,
          description: `Reversal: ${correctionReason}`,
          leaseId: originalEntry.leaseId,
          propertyId: originalEntry.propertyId,
          unitId: originalEntry.unitId,
          metadata: { originalEntryId, correctionType: 'REVERSAL' },
        },
        // New corrected entry
        {
          accountId: originalEntry.accountId,
          type: originalEntry.type,
          direction: originalEntry.direction,
          amount: correctedAmount,
          description: `Correction: ${correctionReason}`,
          leaseId: originalEntry.leaseId,
          propertyId: originalEntry.propertyId,
          unitId: originalEntry.unitId,
          metadata: { originalEntryId, correctionType: 'CORRECTED' },
        },
      ],
      paymentIntentId: originalEntry.paymentIntentId,
      createdBy,
    };

    this.logger.info('Posting correction entry', {
      originalEntryId,
      tenantId,
      originalAmount: originalEntry.amount.toString(),
      correctedAmount: correctedAmount.toString(),
      reason: correctionReason,
    });

    return this.postJournalEntry(correctionEntries);
  }

  /**
   * Void an entry by posting a full reversal
   * This maintains immutability - the original entry remains, a reversal is added
   */
  async voidEntry(
    entryId: LedgerEntryId,
    tenantId: TenantId,
    voidReason: string,
    createdBy: string
  ): Promise<JournalPostResult> {
    const entry = await this.ledgerRepository.findById(entryId, tenantId);
    if (!entry) {
      throw new Error(`Entry ${entryId} not found`);
    }

    const reversalDirection = entry.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';

    const voidRequest: CreateJournalEntryRequest = {
      tenantId,
      effectiveDate: new Date(),
      lines: [
        {
          accountId: entry.accountId,
          // CORRECTION isn't in @bossnyumba/domain-models' narrower
          // LedgerEntryType union (only the canonical trial-balance
          // categories are there). The local LedgerEntryType (./types.ts)
          // extends it with CORRECTION for void/correction semantics —
          // cast through the narrower union to bridge until the domain
          // type is widened upstream.
          type: 'CORRECTION' as unknown as JournalEntryLine['type'],
          direction: reversalDirection,
          amount: entry.amount,
          description: `Void: ${voidReason}`,
          leaseId: entry.leaseId,
          propertyId: entry.propertyId,
          unitId: entry.unitId,
          metadata: { voidedEntryId: entryId, voidReason },
        },
      ],
      createdBy,
    };

    this.logger.info('Voiding ledger entry', {
      entryId,
      tenantId,
      amount: entry.amount.toString(),
      reason: voidReason,
    });

    return this.postJournalEntry(voidRequest);
  }

  /**
   * Get running balance history for an account
   */
  async getBalanceHistory(
    accountId: AccountId,
    tenantId: TenantId,
    fromDate: Date,
    toDate: Date
  ): Promise<Array<{ date: Date; balance: Money; entryId: LedgerEntryId }>> {
    const entries = await this.ledgerRepository.findForStatement(
      accountId,
      tenantId,
      fromDate,
      toDate
    );

    return entries.map(entry => ({
      date: entry.effectiveDate,
      balance: entry.balanceAfter,
      entryId: entry.id,
    }));
  }
}
