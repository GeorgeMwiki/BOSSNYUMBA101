/**
 * Reconciliation Service
 * Handles bank and provider reconciliation
 */
import { v4 as uuidv4 } from 'uuid';
import {
  Money,
  PaymentIntent,
  PaymentIntentAggregate,
  PaymentIntentId,
  TenantId,
  AccountId,
  CurrencyCode
} from '@bossnyumba/domain-models';
import { ReconciliationStatus, ReconciliationId, createId } from '../domain-extensions';
import { IPaymentProvider } from '../providers/payment-provider.interface';
import { IPaymentIntentRepository } from '../repositories/payment-intent.repository';
import { ILedgerRepository } from '../repositories/ledger.repository';
import { IAccountRepository } from '../repositories/account.repository';
import { IEventPublisher, createEvent } from '../events/event-publisher';
import {
  ReconciliationCompletedEvent,
  ReconciliationExceptionEvent
} from '../events/payment-events';
import { ILogger } from './payment-orchestration.service';

/**
 * External bank transaction for reconciliation
 */
export interface BankTransaction {
  id: string;
  date: Date;
  amount: Money;
  description: string;
  reference?: string;
  type: 'CREDIT' | 'DEBIT';
}

/**
 * Reconciliation item
 */
export interface ReconciliationItem {
  id: string;
  status: ReconciliationStatus;
  paymentIntentId?: PaymentIntentId;
  bankTransactionId?: string;
  amount: Money;
  date: Date;
  matchType?: 'EXACT' | 'PARTIAL' | 'MANUAL';
  discrepancy?: Money;
  notes?: string;
}

/**
 * Reconciliation result
 */
export interface ReconciliationResult {
  reconciliationId: ReconciliationId;
  tenantId: TenantId;
  accountId: AccountId;
  periodStart: Date;
  periodEnd: Date;
  openingBalance: Money;
  closingBalance: Money;
  expectedBalance: Money;
  discrepancy: Money;
  matchedItems: ReconciliationItem[];
  unmatchedPayments: PaymentIntent[];
  unmatchedBankTransactions: BankTransaction[];
  exceptions: ReconciliationItem[];
  completedAt: Date;
}

export interface ReconciliationServiceDeps {
  paymentIntentRepository: IPaymentIntentRepository;
  ledgerRepository: ILedgerRepository;
  accountRepository: IAccountRepository;
  eventPublisher: IEventPublisher;
  logger: ILogger;
  /**
   * Book a now-SUCCEEDED payment into the ledger (BLOCKER #07).
   *
   * When provider reconciliation flips a stale PROCESSING intent to
   * SUCCEEDED, the cash was collected but no journal was ever posted on the
   * automated path (the success webhook never landed). This dep books the
   * gap. It MUST be idempotent — book only when the intent is SUCCEEDED with
   * zero existing ledger entries — so a re-run never double-books. The real
   * binding is `PaymentOrchestrationService.ensurePaymentBooked`.
   *
   * Optional: omitted in surface-only / pure status-sync contexts (and in
   * the scaling unit tests). When absent, reconciliation still flips the
   * status but does not book — the existing self-heal on the next webhook
   * duplicate covers it.
   */
  bookPayment?: (
    externalId: string,
    providerName: string,
    tenantId: TenantId,
  ) => Promise<void>;
}

/**
 * Reconciliation Service
 * Reconciles payments with bank transactions and provider records
 */
export class ReconciliationService {
  private providers: Map<string, IPaymentProvider> = new Map();
  private paymentIntentRepository: IPaymentIntentRepository;
  private ledgerRepository: ILedgerRepository;
  private accountRepository: IAccountRepository;
  private eventPublisher: IEventPublisher;
  private logger: ILogger;
  private bookPayment?: ReconciliationServiceDeps['bookPayment'];

  // Tolerance for matching amounts (in minor units)
  private readonly AMOUNT_TOLERANCE = 0;
  // Fuzzy match confidence thresholds (0-100)
  private readonly MATCH_THRESHOLD = 60;
  private readonly AMBIGUOUS_THRESHOLD = 40;

  // Scale guards for provider reconciliation. The set of PROCESSING
  // payments is unbounded (a provider outage can strand thousands), and
  // each one costs one external provider round-trip. We therefore (a) cap
  // how many we pull/process per invocation, and (b) fan out in small
  // bounded batches so we never open an unbounded number of concurrent
  // sockets against the provider (backpressure). The cron re-runs until
  // the backlog is drained, so capping does not drop work — it paces it.
  private readonly DEFAULT_RECONCILE_MAX = 500;
  private readonly DEFAULT_RECONCILE_CONCURRENCY = 5;

  constructor(deps: ReconciliationServiceDeps) {
    this.paymentIntentRepository = deps.paymentIntentRepository;
    this.ledgerRepository = deps.ledgerRepository;
    this.accountRepository = deps.accountRepository;
    this.eventPublisher = deps.eventPublisher;
    this.logger = deps.logger;
    this.bookPayment = deps.bookPayment;
  }

  /**
   * Register a payment provider for reconciliation
   */
  registerProvider(provider: IPaymentProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Reconcile payments with bank transactions
   */
  async reconcileBankTransactions(
    tenantId: TenantId,
    accountId: AccountId,
    bankTransactions: BankTransaction[],
    periodStart: Date,
    periodEnd: Date
  ): Promise<ReconciliationResult> {
    const reconciliationId = createId<ReconciliationId>(`rec_${uuidv4()}`);

    this.logger.info('Starting bank reconciliation', {
      reconciliationId,
      tenantId,
      accountId,
      transactionCount: bankTransactions.length,
      periodStart,
      periodEnd
    });

    // Get account and ledger entries
    const account = await this.accountRepository.findById(accountId, tenantId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // Get ledger entries for the period
    const ledgerEntries = await this.ledgerRepository.findForStatement(
      accountId,
      tenantId,
      periodStart,
      periodEnd
    );

    // Get payments for the period
    const paymentsResult = await this.paymentIntentRepository.find({
      tenantId,
      status: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'],
      fromDate: periodStart,
      toDate: periodEnd
    });
    const payments = paymentsResult.items;

    // Calculate opening balance (balance before period start)
    const openingBalanceResult = await this.ledgerRepository.calculateAccountBalance(
      accountId,
      tenantId,
      new Date(periodStart.getTime() - 1)
    );
    const openingBalance = openingBalanceResult
      ? Money.fromMinorUnits(openingBalanceResult.balance, account.currency)
      : Money.zero(account.currency);

    // Calculate expected closing balance from ledger
    const closingBalanceResult = await this.ledgerRepository.calculateAccountBalance(
      accountId,
      tenantId,
      periodEnd
    );
    const expectedBalance = closingBalanceResult
      ? Money.fromMinorUnits(closingBalanceResult.balance, account.currency)
      : openingBalance;

    // Calculate actual closing balance from bank transactions
    let closingBalance = openingBalance;
    for (const txn of bankTransactions) {
      if (txn.type === 'CREDIT') {
        closingBalance = closingBalance.add(txn.amount);
      } else {
        closingBalance = closingBalance.subtract(txn.amount);
      }
    }

    // Match payments to bank transactions
    const matchedItems: ReconciliationItem[] = [];
    const unmatchedPayments: PaymentIntent[] = [];
    const unmatchedBankTransactions: BankTransaction[] = [...bankTransactions];
    const exceptions: ReconciliationItem[] = [];

    for (const payment of payments) {
      // Find best matching bank transaction using fuzzy matching
      const { match: bankTxn, index: matchIndex, score, matchType: fuzzyMatchType } =
        this.findBestMatch(payment, unmatchedBankTransactions);

      if (bankTxn && matchIndex >= 0 && fuzzyMatchType) {
        unmatchedBankTransactions.splice(matchIndex, 1);
        const discrepancy = payment.amount.subtract(bankTxn.amount);

        // Flag ambiguous matches for manual review
        if (fuzzyMatchType === 'AMBIGUOUS') {
          const item: ReconciliationItem = {
            id: uuidv4(),
            status: 'EXCEPTION',
            paymentIntentId: payment.id,
            bankTransactionId: bankTxn.id,
            amount: payment.amount,
            date: payment.paidAt || payment.createdAt,
            matchType: 'MANUAL',
            discrepancy: discrepancy.isZero() ? undefined : discrepancy,
            notes: `Ambiguous match (confidence: ${score}%). Requires manual review.`
          };
          exceptions.push(item);
          await this.publishException(reconciliationId, tenantId, item, 'AMBIGUOUS_MATCH');
        } else {
          const status: ReconciliationStatus = discrepancy.isZero() ? 'MATCHED' : 'EXCEPTION';
          const item: ReconciliationItem = {
            id: uuidv4(),
            status,
            paymentIntentId: payment.id,
            bankTransactionId: bankTxn.id,
            amount: payment.amount,
            date: payment.paidAt || payment.createdAt,
            matchType: fuzzyMatchType === 'EXACT' ? 'EXACT' : 'PARTIAL',
            discrepancy: discrepancy.isZero() ? undefined : discrepancy
          };

          if (status === 'MATCHED') {
            matchedItems.push(item);
          } else {
            exceptions.push(item);
            await this.publishException(reconciliationId, tenantId, item, 'AMOUNT_MISMATCH');
          }
        }
      } else {
        unmatchedPayments.push(payment);
      }
    }

    // Mark remaining bank transactions as unmatched
    for (const txn of unmatchedBankTransactions) {
      const item: ReconciliationItem = {
        id: uuidv4(),
        status: 'UNMATCHED',
        bankTransactionId: txn.id,
        amount: txn.amount,
        date: txn.date,
        notes: 'No matching payment found'
      };
      exceptions.push(item);
      await this.publishException(
        reconciliationId,
        tenantId,
        item,
        'UNMATCHED_BANK_TRANSACTION'
      );
    }

    // Calculate discrepancy
    const discrepancy = closingBalance.subtract(expectedBalance);

    const result: ReconciliationResult = {
      reconciliationId,
      tenantId,
      accountId,
      periodStart,
      periodEnd,
      openingBalance,
      closingBalance,
      expectedBalance,
      discrepancy,
      matchedItems,
      unmatchedPayments,
      unmatchedBankTransactions,
      exceptions,
      completedAt: new Date()
    };

    // Publish completion event
    await this.eventPublisher.publish(
      createEvent<ReconciliationCompletedEvent>(
        'RECONCILIATION_COMPLETED',
        'Reconciliation',
        reconciliationId,
        tenantId,
        {
          reconciliationId,
          accountId,
          matchedCount: matchedItems.length,
          unmatchedCount: unmatchedPayments.length + unmatchedBankTransactions.length,
          exceptionCount: exceptions.length,
          reconciliationDate: new Date()
        }
      )
    );

    this.logger.info('Bank reconciliation completed', {
      reconciliationId,
      matched: matchedItems.length,
      unmatched: unmatchedPayments.length + unmatchedBankTransactions.length,
      exceptions: exceptions.length,
      discrepancy: discrepancy.toString()
    });

    return result;
  }

  /**
   * Reconcile payment statuses with provider.
   *
   * Scale-bounded: at most `maxToProcess` PROCESSING intents are pulled
   * and reconciled per invocation, and provider status calls fan out in
   * bounded batches of `concurrency` (backpressure) rather than an
   * unbounded serial — or unbounded parallel — sweep. When the backlog
   * exceeds the cap, `limited` is returned true so the caller (cron) knows
   * to schedule another pass; no work is silently dropped.
   */
  async reconcileWithProvider(
    tenantId: TenantId,
    providerName: string,
    olderThanMinutes: number = 30,
    options: { maxToProcess?: number; concurrency?: number } = {}
  ): Promise<{
    checked: number;
    updated: number;
    failed: number;
    limited: boolean;
    errors: Array<{ paymentId: string; error: string }>;
  }> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not registered`);
    }

    const maxToProcess = this.clampPositive(
      options.maxToProcess,
      this.DEFAULT_RECONCILE_MAX
    );
    const concurrency = this.clampPositive(
      options.concurrency,
      this.DEFAULT_RECONCILE_CONCURRENCY
    );

    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    // Fetch one extra row to detect (without a second query) whether more
    // work remains beyond the cap, so the cron can re-run promptly.
    const fetched = await this.paymentIntentRepository.findNeedingReconciliation(
      tenantId,
      cutoffTime,
      maxToProcess + 1
    );
    const limited = fetched.length > maxToProcess;
    const paymentsToCheck = limited ? fetched.slice(0, maxToProcess) : fetched;

    // Only the intents this provider actually owns cost a round-trip.
    const targets = paymentsToCheck.filter(
      (payment) => payment.providerName === providerName && !!payment.externalId
    );

    let updated = 0;
    let failed = 0;
    const errors: Array<{ paymentId: string; error: string }> = [];

    const reconcileOne = async (payment: PaymentIntent): Promise<void> => {
      try {
        const { status } = await provider.getPaymentIntentStatus(payment.externalId!);

        if (status !== payment.status) {
          const aggregate = new PaymentIntentAggregate(payment);

          switch (status) {
            case 'SUCCEEDED':
              aggregate.markSucceeded();
              break;
            case 'FAILED':
              aggregate.markFailed('Reconciliation: payment failed at provider');
              break;
            case 'CANCELLED':
              aggregate.cancel('Reconciliation: payment cancelled at provider');
              break;
          }

          await this.paymentIntentRepository.update(aggregate.toData());
          updated++;

          this.logger.info('Payment status reconciled', {
            paymentIntentId: payment.id,
            oldStatus: payment.status,
            newStatus: status
          });

          // BLOCKER #07: a stale PROCESSING intent that the provider confirms
          // SUCCEEDED had its cash collected but NEVER booked (the success
          // webhook was the only thing that posts the journal, and it never
          // landed). Book the gap now. `bookPayment` is idempotent — it books
          // only when the intent is SUCCEEDED with zero existing ledger
          // entries — so a re-run never double-books. Wrapped so one booking
          // failure surfaces (failed++ / error) but never crashes the batch:
          // the next sweep retries, and the status is already correct.
          if (status === 'SUCCEEDED' && this.bookPayment && payment.externalId) {
            try {
              await this.bookPayment(payment.externalId, providerName, tenantId);
            } catch (bookError) {
              failed++;
              const message =
                bookError instanceof Error ? bookError.message : 'Unknown error';
              errors.push({ paymentId: payment.id, error: `ledger booking failed: ${message}` });
              this.logger.error('Reconciliation booked status but ledger post failed', {
                paymentIntentId: payment.id,
                externalId: payment.externalId,
                providerName,
                tenantId,
                error: message
              });
            }
          }
        }
      } catch (error) {
        failed++;
        errors.push({
          paymentId: payment.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    // Bounded-concurrency fan-out: process in slices of `concurrency`,
    // awaiting each slice before opening the next (backpressure).
    for (let i = 0; i < targets.length; i += concurrency) {
      const slice = targets.slice(i, i + concurrency);
      await Promise.all(slice.map(reconcileOne));
    }

    const checked = targets.length;

    this.logger.info('Provider reconciliation completed', {
      tenantId,
      providerName,
      checked,
      updated,
      failed,
      limited
    });

    return { checked, updated, failed, limited, errors };
  }

  /**
   * Coerce a caller-supplied bound to a safe positive integer, falling
   * back to a default when undefined / non-finite / <= 0.
   */
  private clampPositive(value: number | undefined, fallback: number): number {
    if (value === undefined || !Number.isFinite(value) || value <= 0) {
      return fallback;
    }
    return Math.floor(value);
  }

  /**
   * Verify ledger balances
   */
  async verifyLedgerBalances(
    tenantId: TenantId
  ): Promise<{
    accountsChecked: number;
    valid: number;
    invalid: number;
    discrepancies: Array<{
      accountId: AccountId;
      storedBalance: Money;
      calculatedBalance: Money;
      discrepancy: Money;
    }>;
  }> {
    const accounts = await this.accountRepository.find({ tenantId });
    
    let valid = 0;
    let invalid = 0;
    const discrepancies: Array<{
      accountId: AccountId;
      storedBalance: Money;
      calculatedBalance: Money;
      discrepancy: Money;
    }> = [];

    for (const account of accounts) {
      const storedBalance = Money.fromMinorUnits(account.balanceMinorUnits, account.currency);
      const calculatedResult = await this.ledgerRepository.calculateAccountBalance(
        account.id,
        tenantId
      );

      const calculatedBalance = calculatedResult
        ? Money.fromMinorUnits(calculatedResult.balance, account.currency)
        : Money.zero(account.currency);

      if (storedBalance.equals(calculatedBalance)) {
        valid++;
      } else {
        invalid++;
        discrepancies.push({
          accountId: account.id,
          storedBalance,
          calculatedBalance,
          discrepancy: storedBalance.subtract(calculatedBalance)
        });

        this.logger.warn('Ledger balance discrepancy found', {
          accountId: account.id,
          storedBalance: storedBalance.toString(),
          calculatedBalance: calculatedBalance.toString()
        });
      }
    }

    return {
      accountsChecked: accounts.length,
      valid,
      invalid,
      discrepancies
    };
  }

  /**
   * Check if a payment matches a bank transaction (simple boolean check)
   */
  private matchesPayment(payment: PaymentIntent, txn: BankTransaction): boolean {
    // Match by amount (within tolerance)
    const amountDiff = Math.abs(
      payment.amount.amountMinorUnits - txn.amount.amountMinorUnits
    );
    if (amountDiff > this.AMOUNT_TOLERANCE) {
      return false;
    }

    // Match by date (same day)
    const paymentDate = payment.paidAt || payment.createdAt;
    if (
      paymentDate.toDateString() !== txn.date.toDateString() &&
      // Allow 1 day tolerance
      Math.abs(paymentDate.getTime() - txn.date.getTime()) > 24 * 60 * 60 * 1000
    ) {
      return false;
    }

    // Check reference if available
    if (txn.reference && payment.id) {
      if (txn.reference.includes(payment.id)) {
        return true;
      }
    }

    return true;
  }

  /**
   * Find the best matching bank transaction for a payment using fuzzy matching.
   * Scoring system:
   * - Reference match (exact): +40 points
   * - Reference partial match: +20-35 points
   * - Exact amount match: +30 points
   * - Amount within tolerance: +20 points
   * - Amount within 1%: +10 points
   * - Same day: +20 points
   * - Within 1 day: +10 points
   * - Within 2 days: +5 points
   * - Description word overlap: up to +10 points
   *
   * Thresholds:
   * - score >= MATCH_THRESHOLD (60): EXACT or PARTIAL match
   * - score >= AMBIGUOUS_THRESHOLD (40): AMBIGUOUS (flagged for manual review)
   * - score < AMBIGUOUS_THRESHOLD: no match
   */
  private findBestMatch(
    payment: PaymentIntent,
    bankTransactions: BankTransaction[]
  ): {
    match: BankTransaction | null;
    index: number;
    score: number;
    matchType: 'EXACT' | 'PARTIAL' | 'AMBIGUOUS' | null;
  } {
    let bestMatch: BankTransaction | null = null;
    let bestIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < bankTransactions.length; i++) {
      const txn = bankTransactions[i];
      let score = 0;

      // Currency must match - skip entirely if mismatch
      if (payment.amount.currency !== txn.amount.currency) {
        continue;
      }

      // ---- Reference matching (strongest signal) ----
      if (txn.reference) {
        if (txn.reference === payment.id || txn.reference.includes(payment.id)) {
          // Direct payment ID reference match
          score += 40;
        } else if (payment.externalId && txn.reference.includes(payment.externalId)) {
          // Provider external ID reference match
          score += 35;
        } else if (payment.idempotencyKey && txn.reference.includes(payment.idempotencyKey)) {
          // Idempotency key reference match
          score += 30;
        } else if (
          payment.description &&
          payment.description.length >= 5 &&
          txn.reference.toLowerCase().includes(payment.description.substring(0, 10).toLowerCase())
        ) {
          // Partial description in reference
          score += 10;
        }
      }

      // ---- Amount matching ----
      const amountDiff = Math.abs(
        payment.amount.amountMinorUnits - txn.amount.amountMinorUnits
      );
      if (amountDiff === 0) {
        score += 30;
      } else if (amountDiff <= this.AMOUNT_TOLERANCE) {
        score += 20;
      } else if (payment.amount.amountMinorUnits > 0) {
        const percentDiff = amountDiff / payment.amount.amountMinorUnits;
        if (percentDiff <= 0.01) {
          // Within 1%
          score += 10;
        } else if (percentDiff <= 0.05) {
          // Within 5% (could be fees)
          score += 5;
        }
      }

      // ---- Date/timing matching ----
      const paymentDate = payment.paidAt || payment.createdAt;
      const daysDiff = Math.abs(
        paymentDate.getTime() - txn.date.getTime()
      ) / (24 * 60 * 60 * 1000);

      if (daysDiff < 1) {
        score += 20;
      } else if (daysDiff < 2) {
        score += 10;
      } else if (daysDiff < 3) {
        score += 5;
      }

      // ---- Description / name fuzzy matching ----
      if (txn.description && payment.description) {
        const txnWords = txn.description.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const payWords = payment.description.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const overlap = txnWords.filter(w => payWords.includes(w)).length;
        if (overlap > 0) {
          score += Math.min(overlap * 5, 10);
        }
      }

      // Track best match
      if (score > bestScore) {
        bestScore = score;
        bestMatch = txn;
        bestIndex = i;
      }
    }

    // Determine match type based on score thresholds
    if (bestScore >= this.MATCH_THRESHOLD && bestMatch) {
      const isExactAmount = Math.abs(
        payment.amount.amountMinorUnits - bestMatch.amount.amountMinorUnits
      ) <= this.AMOUNT_TOLERANCE;
      return {
        match: bestMatch,
        index: bestIndex,
        score: bestScore,
        matchType: isExactAmount ? 'EXACT' : 'PARTIAL'
      };
    } else if (bestScore >= this.AMBIGUOUS_THRESHOLD && bestMatch) {
      return {
        match: bestMatch,
        index: bestIndex,
        score: bestScore,
        matchType: 'AMBIGUOUS'
      };
    }

    return { match: null, index: -1, score: bestScore, matchType: null };
  }

  /**
   * Publish reconciliation exception event
   */
  private async publishException(
    reconciliationId: ReconciliationId,
    tenantId: TenantId,
    item: ReconciliationItem,
    exceptionType: string
  ): Promise<void> {
    await this.eventPublisher.publish(
      createEvent<ReconciliationExceptionEvent>(
        'RECONCILIATION_EXCEPTION',
        'Reconciliation',
        reconciliationId,
        tenantId,
        {
          reconciliationId,
          paymentIntentId: item.paymentIntentId,
          externalId: item.bankTransactionId,
          exceptionType,
          description: item.notes || `${exceptionType}: Amount ${item.amount.toString()}`
        }
      )
    );
  }
}
