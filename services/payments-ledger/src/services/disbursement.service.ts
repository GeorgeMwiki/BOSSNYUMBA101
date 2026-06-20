/**
 * Disbursement Service
 * Handles owner disbursements/payouts
 */
import { v4 as uuidv4 } from 'uuid';
import {
  Money,
  TenantId,
  OwnerId,
  AccountId,
  PropertyId,
  CurrencyCode,
  JournalTemplates
} from '@bossnyumba/domain-models';
import { createId } from '../domain-extensions';
import { calculatePlatformFeeMinor } from '../lib/platform-fee';
import { IPaymentProvider, TransferResult } from '../providers/payment-provider.interface';
import { IAccountRepository } from '../repositories/account.repository';
import { IDisbursementRepository, Disbursement, DisbursementStatus } from '../repositories/disbursement.repository';
import { IEventPublisher, createEvent } from '../events/event-publisher';
import {
  DisbursementInitiatedEvent,
  DisbursementCompletedEvent,
  DisbursementFailedEvent
} from '../events/payment-events';
import { LedgerService } from './ledger.service';
import { ILogger } from './payment-orchestration.service';

/**
 * Disbursement request
 */
export interface DisbursementRequest {
  tenantId: TenantId;
  ownerId: OwnerId;
  amount?: Money;  // If not specified, disburse full available balance
  destination: string;  // Bank account or connected account ID
  description?: string;
  idempotencyKey?: string;
}

/**
 * Disbursement result.
 *
 * `NEEDS_REVERSAL` is a DISTINCT result status. A clean `FAILED` connotes
 * "no money moved, retry-safe"; `NEEDS_REVERSAL` means the ledger debit was
 * posted but the outbound transfer failed AFTER it — money WAS moved and the
 * outcome is in-flight-needs-attention, not a clean retryable failure. Masking
 * it as FAILED would let callers (and the disbursement job's
 * `status !== 'FAILED'` accounting) treat a debited-but-undelivered payout as a
 * clean retry. Mirror of Borjie disbursement.service.ts:50-58.
 */
export interface DisbursementResult {
  disbursementId: string;
  ownerId: OwnerId;
  amount: Money;
  status: 'PENDING' | 'IN_TRANSIT' | 'PAID' | 'FAILED' | 'CANCELLED' | 'NEEDS_REVERSAL';
  transferId: string;
  estimatedArrival?: Date;
  failureReason?: string;
}

/**
 * Classify a {@link DisbursementResult} status as a CLEAN success (the payout
 * is en route or delivered) vs an outcome that needs attention.
 *
 * `NEEDS_REVERSAL` (money debited, transfer failed after the ledger post) and
 * `FAILED` / `CANCELLED` are NOT clean successes; batch accounting must count
 * them as failed/attention so a debited-but-undelivered payout is never tallied
 * as succeeded. Mirror of Borjie disbursement.service.ts:88-94.
 */
export function isCleanDisbursementSuccess(
  status: DisbursementResult['status'],
): boolean {
  return (
    status === 'PAID' || status === 'IN_TRANSIT' || status === 'PENDING'
  );
}

/**
 * Currencies whose payouts settle over a mobile-money rail (M-Pesa B2C) rather
 * than a card/bank rail. Kept narrow and explicit — never hard-coded into a
 * business calculation, only used to pick the correct transfer rail.
 *
 * INVARIANT: a currency belongs here ONLY when a registered provider actually
 * serves it. The Daraja M-Pesa provider serves KES (Safaricom Kenya). TZS is
 * deliberately ABSENT: no TZS mobile-money provider (Vodacom M-Pesa TZ / Tigo
 * Pesa / Airtel Money) is registered yet. Listing TZS here previously made a
 * TZS phone-number payout WANT the mobile-money rail, find no provider, then
 * silently fall through to the card/bank default (Stripe) and land
 * NEEDS_REVERSAL after the ledger debit. With TZS removed, a TZS phone-number
 * payout no longer claims the mobile-money rail, and `getProvider` additionally
 * fails LOUD (before any ledger debit) if a TZS destination ever does request
 * the mobile-money rail. Re-add 'TZS' here the same PR that registers a TZS
 * mobile-money provider — not before. (East-Africa expansion adds UGX/etc. the
 * same way: provider first, then the currency.)
 */
const MOBILE_MONEY_CURRENCIES: ReadonlySet<CurrencyCode> = new Set<CurrencyCode>([
  'KES',
]);

export function isMobileMoneyCurrency(currency: CurrencyCode): boolean {
  return MOBILE_MONEY_CURRENCIES.has(currency);
}

/**
 * Heuristic: does a disbursement destination look like a mobile-money phone
 * number (vs a bank / Stripe connected-account id like `acct_…`)? Used only to
 * route the payout to the M-Pesa rail. Accepts an optional leading `+`, optional
 * spaces/dashes, and 9–15 digits (E.164-ish). A destination starting with a
 * letter (`acct_…`, `ba_…`) is never a phone number.
 */
export function looksLikePhoneNumber(destination: string): boolean {
  if (!destination) return false;
  const trimmed = destination.trim();
  // Anything that begins with a letter is an account/connected-account id.
  if (/^[A-Za-z]/.test(trimmed)) return false;
  const digits = trimmed.replace(/[^0-9]/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

/**
 * Owner disbursement info
 */
export interface OwnerDisbursementInfo {
  ownerId: OwnerId;
  availableBalance: Money;
  pendingDisbursements: Money;
  lastDisbursementDate?: Date;
  nextScheduledDate?: Date;
}

export interface DisbursementServiceDeps {
  accountRepository: IAccountRepository;
  ledgerService: LedgerService;
  eventPublisher: IEventPublisher;
  logger: ILogger;
  disbursementRepository?: IDisbursementRepository;
}

/**
 * Disbursement Service
 * Manages automated and manual disbursements to property owners
 */
export class DisbursementService {
  private providers: Map<string, IPaymentProvider> = new Map();
  private defaultProvider: string | null = null;
  
  private accountRepository: IAccountRepository;
  private disbursementRepository: IDisbursementRepository | null;
  private ledgerService: LedgerService;
  private eventPublisher: IEventPublisher;
  private logger: ILogger;

  constructor(deps: DisbursementServiceDeps) {
    this.accountRepository = deps.accountRepository;
    this.disbursementRepository = deps.disbursementRepository || null;
    this.ledgerService = deps.ledgerService;
    this.eventPublisher = deps.eventPublisher;
    this.logger = deps.logger;
  }

  /**
   * Register payment provider for disbursements
   */
  registerProvider(provider: IPaymentProvider, isDefault: boolean = false): void {
    this.providers.set(provider.name, provider);
    if (isDefault) {
      this.defaultProvider = provider.name;
    }
  }

  /**
   * Process a disbursement to an owner
   */
  async processDisbursement(request: DisbursementRequest): Promise<DisbursementResult> {
    // BLOCKER #13(a): the idempotency key MUST be caller-supplied. Minting
    // a random uuid here silently defeats replay protection — two
    // deliveries of the "same" disbursement would each get a fresh key and
    // both fire a transfer. Reject when absent so every caller (route,
    // scheduled job) commits to a deterministic key.
    if (!request.idempotencyKey) {
      throw new Error(
        'processDisbursement: idempotencyKey is required (a deterministic, caller-supplied key — never minted here)',
      );
    }
    const idempotencyKey = request.idempotencyKey;
    const disbursementId = uuidv4();

    this.logger.info('Processing disbursement', {
      disbursementId,
      tenantId: request.tenantId,
      ownerId: request.ownerId
    });

    // Get owner's accounts
    const operatingAccount = await this.accountRepository.findByOwnerAndType(
      request.tenantId,
      request.ownerId,
      'OWNER_OPERATING'
    );
    if (!operatingAccount) {
      throw new Error(`Owner operating account not found for owner ${request.ownerId}`);
    }

    const platformHoldingAccount = await this.accountRepository.findPlatformAccounts(
      request.tenantId,
      'PLATFORM_HOLDING'
    );
    if (!platformHoldingAccount) {
      throw new Error('Platform holding account not found');
    }

    // Determine disbursement amount
    const availableBalance = Money.fromMinorUnits(
      platformHoldingAccount.balanceMinorUnits,
      platformHoldingAccount.currency
    );

    const amount = request.amount || availableBalance;

    if (amount.isGreaterThan(availableBalance)) {
      throw new Error(
        `Insufficient balance for disbursement. ` +
        `Available: ${availableBalance.toString()}, Requested: ${amount.toString()}`
      );
    }

    if (amount.isZero() || amount.isNegative()) {
      throw new Error('Disbursement amount must be positive');
    }

    // Get payment provider — selected by destination + currency (M-Pesa for
    // mobile-money / KES / TZS payouts, Stripe otherwise), NOT a single default.
    const provider = this.getProvider(request.destination, amount.currency);
    const now = new Date();

    // Create disbursement record for persistence. We claim it as
    // PROCESSING up front (not PENDING) so the row's existence under the
    // unique (tenant_id, idempotency_key) index IS the claim.
    const disbursementRecord: Disbursement = {
      id: disbursementId,
      tenantId: request.tenantId,
      ownerId: request.ownerId,
      amountMinorUnits: amount.amountMinorUnits,
      currency: amount.currency,
      status: 'PROCESSING',
      destination: request.destination,
      destinationType: 'BANK_ACCOUNT',
      description: request.description,
      idempotencyKey,
      initiatedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system'
    };

    // BLOCKER #13(b): atomically claim BEFORE transferring. The first
    // writer wins; a concurrent replica / replay collides on the unique
    // index and we return the ORIGINAL row without firing a second
    // transfer. When no repository is wired (legacy in-memory paths) we
    // proceed un-guarded — production always wires the repository.
    if (this.disbursementRepository) {
      const { claimed, disbursement: claimedRow } =
        await this.disbursementRepository.claimForProcessing(disbursementRecord);
      if (!claimed) {
        this.logger.info('Disbursement already claimed — returning original', {
          disbursementId: claimedRow.id,
          idempotencyKey,
          ownerId: request.ownerId
        });
        return this.toResult(claimedRow);
      }
    }

    // Track whether the ledger debit committed so the catch can distinguish a
    // clean FAILED (no money moved) from NEEDS_REVERSAL (debited, transfer
    // failed after — handed to the reconciliation job, never reversed inline).
    let ledgerPosted = false;

    try {
      // BLOCKER #13(c): post the ledger debit BEFORE the provider transfer
      // so a successful transfer can never exist without a backing ledger
      // row. If the ledger post throws, no money has moved yet — the catch
      // marks the claim FAILED and nothing is disbursed.
      await this.ledgerService.postJournalEntry(
        JournalTemplates.ownerDisbursement(
          request.tenantId,
          platformHoldingAccount.id,
          operatingAccount.id,
          amount,
          'system'
        ),
        // Borjie-parity (disbursement.service.ts:259-267): the owner-disbursement
        // DEBIT is idempotent on a deterministic per-disbursement key — a claim
        // retry or a post-claim crash re-drive returns the ORIGINAL journal
        // instead of booking a second debit. Defense-in-depth atop the atomic
        // (tenant_id, idempotency_key) claim arbiter.
        { idempotencyKey: `disbursement:${disbursementId}` }
      );
      ledgerPosted = true;

      // Create transfer with provider (after the ledger is booked).
      const transferResult = await provider.createTransfer({
        amount,
        destination: request.destination,
        description: request.description || `Disbursement to owner ${request.ownerId}`,
        metadata: {
          tenantId: request.tenantId,
          ownerId: request.ownerId,
          disbursementId
        },
        idempotencyKey
      });

      // Update disbursement record with transfer details
      const updatedStatus: DisbursementStatus = transferResult.status === 'PAID'
        ? 'PAID'
        : transferResult.status === 'IN_TRANSIT'
          ? 'IN_TRANSIT'
          : 'PROCESSING';

      if (this.disbursementRepository) {
        await this.disbursementRepository.update({
          ...disbursementRecord,
          status: updatedStatus,
          provider: provider.name,
          transferId: transferResult.transferId,
          initiatedAt: now,
          completedAt: transferResult.status === 'PAID' ? new Date() : undefined,
          estimatedArrival: transferResult.arrivalDate,
          updatedAt: new Date(),
          updatedBy: 'system'
        });
      }

      // Publish event
      await this.eventPublisher.publish(
        createEvent<DisbursementInitiatedEvent>(
          'DISBURSEMENT_INITIATED',
          'Disbursement',
          disbursementId,
          request.tenantId,
          {
            ownerId: request.ownerId,
            amount: amount.toData(),
            destination: request.destination,
            transferId: transferResult.transferId
          }
        )
      );

      // If transfer is complete, publish completion event
      if (transferResult.status === 'PAID') {
        await this.eventPublisher.publish(
          createEvent<DisbursementCompletedEvent>(
            'DISBURSEMENT_COMPLETED',
            'Disbursement',
            disbursementId,
            request.tenantId,
            {
              ownerId: request.ownerId,
              amount: amount.toData(),
              completedAt: new Date()
            }
          )
        );
      }

      this.logger.info('Disbursement processed', {
        disbursementId,
        ownerId: request.ownerId,
        amount: amount.toString(),
        status: transferResult.status
      });

      return {
        disbursementId,
        ownerId: request.ownerId,
        amount,
        status: transferResult.status,
        transferId: transferResult.transferId,
        estimatedArrival: transferResult.arrivalDate
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Two distinct failure shapes, keyed on whether the ledger debit committed:
      //
      //   - ledger NOT posted (the post itself threw) → NO money moved. Clean
      //     FAILED, retry-safe.
      //   - ledger posted, then the transfer (or a later step) threw → the
      //     ledger already recorded the debit. We do NOT reverse inline and we
      //     NEVER blind-re-transfer: leave the disbursement RETRYABLE in a
      //     NEEDS_REVERSAL state. The disbursement reconciliation job is the
      //     consumer — it queries the provider's ACTUAL transfer status and only
      //     posts the compensating reversal if the transfer TRULY failed (and
      //     re-drives under the same idempotency key, or marks PAID, otherwise).
      //
      // Inline reversal got the lost-response case WRONG: a transfer that
      // actually SUCCEEDED but threw on the response would have been blindly
      // reversed, double-paying / mis-booking. Parking NEEDS_REVERSAL hands that
      // disambiguation to provider-status reconciliation. Mirror of Borjie
      // disbursement.service.ts:390-437.
      const failureStatus: DisbursementStatus = ledgerPosted
        ? 'NEEDS_REVERSAL'
        : 'FAILED';

      if (ledgerPosted) {
        this.logger.error(
          'Disbursement transfer FAILED after ledger post — leaving NEEDS_REVERSAL (no inline reversal, no blind re-transfer)',
          {
            disbursementId,
            ownerId: request.ownerId,
            amount: amount.toString(),
            error: errorMessage,
          }
        );
      } else {
        this.logger.error('Disbursement ledger post failed — NO transfer attempted', {
          disbursementId,
          ownerId: request.ownerId,
          error: errorMessage,
        });
      }

      // Update disbursement record with the resolved failure state.
      if (this.disbursementRepository) {
        await this.disbursementRepository.update({
          ...disbursementRecord,
          status: failureStatus,
          provider: ledgerPosted ? provider.name : disbursementRecord.provider,
          failedAt: new Date(),
          failureReason: errorMessage,
          updatedAt: new Date(),
          updatedBy: 'system'
        });
      }

      await this.eventPublisher.publish(
        createEvent<DisbursementFailedEvent>(
          'DISBURSEMENT_FAILED',
          'Disbursement',
          disbursementId,
          request.tenantId,
          {
            ownerId: request.ownerId,
            amount: amount.toData(),
            failureReason: errorMessage
          }
        )
      );

      // Surface NEEDS_REVERSAL (not FAILED) when money WAS debited so the
      // reconciliation sweep + the disbursement job's success/fail accounting
      // treat a debited-but-undelivered payout correctly.
      return {
        disbursementId,
        ownerId: request.ownerId,
        amount,
        status: failureStatus,
        transferId: '',
        failureReason: errorMessage
      };
    }
  }

  /**
   * Get disbursement info for an owner
   */
  async getOwnerDisbursementInfo(
    tenantId: TenantId,
    ownerId: OwnerId
  ): Promise<OwnerDisbursementInfo> {
    const operatingAccount = await this.accountRepository.findByOwnerAndType(
      tenantId,
      ownerId,
      'OWNER_OPERATING'
    );

    if (!operatingAccount) {
      throw new Error(`Owner operating account not found for owner ${ownerId}`);
    }

    const availableBalance = Money.fromMinorUnits(
      operatingAccount.balanceMinorUnits,
      operatingAccount.currency
    );

    return {
      ownerId,
      availableBalance,
      pendingDisbursements: Money.zero(operatingAccount.currency),
      lastDisbursementDate: operatingAccount.lastEntryAt
    };
  }

  /**
   * Get owners eligible for disbursement
   */
  async getEligibleOwners(
    tenantId: TenantId,
    minBalance: number = 1000  // Minimum balance in minor units
  ): Promise<Array<{ ownerId: OwnerId; balance: Money }>> {
    const accounts = await this.accountRepository.findWithPositiveBalance(
      tenantId,
      'OWNER_OPERATING',
      minBalance
    );

    return accounts
      .filter(a => a.ownerId)
      .map(a => ({
        ownerId: a.ownerId!,
        balance: Money.fromMinorUnits(a.balanceMinorUnits, a.currency)
      }));
  }

  /**
   * Process scheduled disbursements for all eligible owners
   */
  async processScheduledDisbursements(
    tenantId: TenantId,
    minBalance: number = 1000
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    results: DisbursementResult[];
  }> {
    const eligibleOwners = await this.getEligibleOwners(tenantId, minBalance);
    
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const results: DisbursementResult[] = [];

    for (const owner of eligibleOwners) {
      processed++;
      
      try {
        // Get owner's connected account (would come from owner profile in real impl)
        const destination = `acct_${owner.ownerId}`; // Placeholder

        // Deterministic, date-bucketed idempotency key (#13): a retried or
        // double-fired scheduled run for the same owner on the same UTC day
        // claims the same key, so the unique index collapses it to a single
        // payout instead of minting a fresh key per attempt.
        const dayBucket = new Date().toISOString().slice(0, 10);
        const result = await this.processDisbursement({
          tenantId,
          ownerId: owner.ownerId,
          destination,
          idempotencyKey: `sched:${tenantId}:${owner.ownerId}:${dayBucket}`
        });

        results.push(result);

        // NEEDS_REVERSAL is NOT a clean success (money debited but not
        // delivered); it counts toward `failed`/attention, never `succeeded`.
        if (isCleanDisbursementSuccess(result.status)) {
          succeeded++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        this.logger.error('Scheduled disbursement failed', {
          ownerId: owner.ownerId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    this.logger.info('Scheduled disbursements processed', {
      tenantId,
      processed,
      succeeded,
      failed
    });

    return { processed, succeeded, failed, results };
  }

  /**
   * Get a disbursement by ID
   */
  async getDisbursement(
    disbursementId: string,
    tenantId: TenantId
  ): Promise<Disbursement | null> {
    if (!this.disbursementRepository) {
      throw new Error('Disbursement repository not configured');
    }
    return this.disbursementRepository.findById(disbursementId, tenantId);
  }

  /**
   * List disbursements with optional filters
   */
  async listDisbursements(
    tenantId: TenantId,
    filters?: {
      ownerId?: OwnerId;
      status?: DisbursementStatus | DisbursementStatus[];
      fromDate?: Date;
      toDate?: Date;
    },
    page: number = 1,
    pageSize: number = 20
  ) {
    if (!this.disbursementRepository) {
      throw new Error('Disbursement repository not configured');
    }
    return this.disbursementRepository.find(
      {
        tenantId,
        ownerId: filters?.ownerId,
        status: filters?.status,
        fromDate: filters?.fromDate,
        toDate: filters?.toDate
      },
      page,
      pageSize
    );
  }

  /**
   * Get disbursements for a specific owner
   */
  async getOwnerDisbursements(
    tenantId: TenantId,
    ownerId: OwnerId,
    page: number = 1,
    pageSize: number = 20
  ) {
    if (!this.disbursementRepository) {
      throw new Error('Disbursement repository not configured');
    }
    return this.disbursementRepository.findByOwner(tenantId, ownerId, page, pageSize);
  }

  /**
   * Apply an M-Pesa B2C result callback to the disbursement it belongs to,
   * looked up by its M-Pesa `ConversationID` (stored as the row's `transferId`).
   *
   *   - SUCCESS (ResultCode 0): the payout was delivered → mark PAID and publish
   *     DISBURSEMENT_COMPLETED.
   *   - FAILURE: the transfer failed AFTER the ledger debit was already posted
   *     (the debit precedes the provider call) → transition to NEEDS_REVERSAL so
   *     the disbursement-reconciliation job consumes it (it filters
   *     status === 'NEEDS_REVERSAL') and posts the compensating reversal. NEVER
   *     mark a failed-after-debit payout as a clean FAILED — that would let the
   *     debited-but-undelivered money sit unreversed.
   *
   * Idempotent: a redelivered result for an already-terminal row (PAID / FAILED)
   * is a no-op. Returns the outcome for the caller/tests; never throws on a
   * missing row (logged + ignored so the callback still acks Safaricom).
   */
  async applyB2cResult(input: {
    conversationId: string;
    success: boolean;
    transactionId?: string;
    failureReason?: string;
  }): Promise<'paid' | 'needs-reversal' | 'ignored-unknown' | 'ignored-terminal'> {
    if (!this.disbursementRepository) {
      throw new Error('Disbursement repository not configured');
    }
    const row = await this.disbursementRepository.findByTransferId(
      'mpesa',
      input.conversationId,
    );
    if (!row) {
      this.logger.warn('M-PESA B2C result for unknown ConversationID — ignoring', {
        conversationId: input.conversationId,
      });
      return 'ignored-unknown';
    }

    // Already terminal → idempotent no-op (redelivered callback).
    if (row.status === 'PAID' || row.status === 'FAILED' || row.status === 'CANCELLED') {
      this.logger.info('M-PESA B2C result for already-terminal disbursement — no-op', {
        disbursementId: row.id,
        status: row.status,
      });
      return 'ignored-terminal';
    }

    if (input.success) {
      await this.disbursementRepository.update({
        ...row,
        status: 'PAID',
        completedAt: new Date(),
        failureReason: undefined,
        failedAt: undefined,
        updatedAt: new Date(),
        updatedBy: 'mpesa-b2c-result',
      });
      await this.eventPublisher.publish(
        createEvent<DisbursementCompletedEvent>(
          'DISBURSEMENT_COMPLETED',
          'Disbursement',
          row.id,
          row.tenantId,
          {
            ownerId: row.ownerId,
            amount: Money.fromMinorUnits(row.amountMinorUnits, row.currency).toData(),
            completedAt: new Date(),
          },
        ),
      );
      this.logger.info('M-PESA B2C payout delivered — disbursement marked PAID', {
        disbursementId: row.id,
        conversationId: input.conversationId,
      });
      return 'paid';
    }

    // FAILURE after the ledger debit → NEEDS_REVERSAL (consumed by the
    // reconciliation job), NOT clean FAILED.
    await this.disbursementRepository.update({
      ...row,
      status: 'NEEDS_REVERSAL',
      failedAt: new Date(),
      failureReason: input.failureReason ?? 'mpesa-b2c-failed',
      updatedAt: new Date(),
      updatedBy: 'mpesa-b2c-result',
    });
    this.logger.error(
      'M-PESA B2C payout FAILED after ledger debit — disbursement set NEEDS_REVERSAL',
      {
        disbursementId: row.id,
        conversationId: input.conversationId,
        failureReason: input.failureReason,
      },
    );
    return 'needs-reversal';
  }

  /**
   * Apply an M-Pesa B2C QUEUE TIMEOUT (the request sat in Safaricom's queue and
   * was never processed — no result callback will arrive). The ledger debit was
   * already posted, so flag the row NEEDS_REVERSAL for the reconciliation job;
   * never leave debited-but-undelivered money silent. Idempotent + tolerant of a
   * missing/terminal row, like {@link applyB2cResult}.
   */
  async applyB2cTimeout(input: {
    conversationId: string;
  }): Promise<'needs-reversal' | 'ignored-unknown' | 'ignored-terminal'> {
    if (!this.disbursementRepository) {
      throw new Error('Disbursement repository not configured');
    }
    const row = await this.disbursementRepository.findByTransferId(
      'mpesa',
      input.conversationId,
    );
    if (!row) {
      this.logger.warn('M-PESA B2C timeout for unknown ConversationID — ignoring', {
        conversationId: input.conversationId,
      });
      return 'ignored-unknown';
    }
    if (row.status === 'PAID' || row.status === 'FAILED' || row.status === 'CANCELLED') {
      return 'ignored-terminal';
    }
    await this.disbursementRepository.update({
      ...row,
      status: 'NEEDS_REVERSAL',
      failedAt: new Date(),
      failureReason: 'mpesa-b2c-queue-timeout',
      updatedAt: new Date(),
      updatedBy: 'mpesa-b2c-timeout',
    });
    this.logger.error(
      'M-PESA B2C queue timeout — disbursement set NEEDS_REVERSAL (debited, undelivered)',
      { disbursementId: row.id, conversationId: input.conversationId },
    );
    return 'needs-reversal';
  }

  /**
   * Select the disbursement provider for a payout by DESTINATION + CURRENCY.
   *
   * Previously this always returned the single `defaultProvider` (Stripe), so a
   * mobile-money payout to a Kenyan/Tanzanian phone number could only ever be
   * attempted via Stripe — wrong rail, guaranteed failure. Now the DESTINATION
   * SHAPE is authoritative (it determines the physical rail):
   *   - a phone-number destination (e.g. 2547…) → the M-Pesa B2C rail (when an
   *     mpesa provider is registered for that currency);
   *   - an account-id destination (`acct_…`, `ba_…`) → the default provider
   *     (Stripe), EVEN for a mobile-money currency like KES — money to a Stripe
   *     connected account can never go over M-Pesa.
   * Currency is only a secondary signal: an AMBIGUOUS destination (neither a
   * clear phone number nor an account id) on a mobile-money currency still
   * prefers the M-Pesa rail. A payout that WANTS the mobile-money rail but has
   * NO registered provider for the currency (e.g. TZS today — see
   * MOBILE_MONEY_CURRENCIES) throws LOUD here, BEFORE any ledger debit, rather
   * than silently mis-routing to the card/bank default and stranding the money
   * as NEEDS_REVERSAL. Only NON-mobile-money payouts fall back to the default
   * provider. Throws LOUD whenever nothing can serve the payout.
   */
  private getProvider(destination: string, currency: CurrencyCode): IPaymentProvider {
    const isPhone = looksLikePhoneNumber(destination);
    const isAccountId = /^[A-Za-z]/.test(destination.trim());
    // A phone destination demands mobile money; an ambiguous destination on a
    // mobile-money currency prefers it; an account-id destination NEVER does.
    const wantsMobileMoney =
      isPhone || (!isAccountId && isMobileMoneyCurrency(currency));

    if (wantsMobileMoney) {
      // Pick the first registered provider that declares the target currency
      // (the M-Pesa provider supports KES; TZS/East-Africa rails extend here).
      for (const provider of this.providers.values()) {
        if (provider.name === 'mpesa' && provider.supportedCurrencies.includes(currency)) {
          return provider;
        }
      }

      // No registered mobile-money provider serves this currency. We MUST NOT
      // silently fall through to the card/bank default — a phone-number /
      // mobile-money-currency payout cannot settle over Stripe, so routing it
      // there debits the ledger first and then strands the money as
      // NEEDS_REVERSAL. Fail LOUD here, BEFORE the claim + ledger debit (this
      // method runs ahead of both), so the payout is rejected cleanly with no
      // money moved. This is the defense-in-depth backstop to TZS having been
      // removed from MOBILE_MONEY_CURRENCIES: even if a currency is mislisted,
      // an unserved mobile-money rail can never dead-end.
      throw new Error(
        `No mobile-money provider registered for ${currency} disbursement to ` +
          `"${destination}". Register a ${currency} mobile-money provider ` +
          `(e.g. M-Pesa) before enabling this rail — refusing to route a ` +
          `mobile-money payout to a card/bank rail.`,
      );
    }

    if (!this.defaultProvider) {
      throw new Error(
        `No payment provider configured for disbursement to "${destination}" (${currency})`,
      );
    }
    const provider = this.providers.get(this.defaultProvider);
    if (!provider) {
      throw new Error(`Payment provider ${this.defaultProvider} not found`);
    }
    return provider;
  }

  /**
   * Map a persisted disbursement row to the external `DisbursementResult`
   * shape. Used by the replay path (#13) to return the ORIGINAL claim
   * verbatim. The result's status union has no 'PROCESSING'; an in-flight
   * claim surfaces as the closest external state, 'IN_TRANSIT'.
   *
   * `NEEDS_REVERSAL` surfaces AS `NEEDS_REVERSAL` (never masked as FAILED) so a
   * replay of a debited-but-undelivered payout reports in-flight-needs-attention.
   */
  private toResult(d: Disbursement): DisbursementResult {
    const status: DisbursementResult['status'] =
      d.status === 'PROCESSING' ? 'IN_TRANSIT' : d.status;
    return {
      disbursementId: d.id,
      ownerId: d.ownerId,
      amount: Money.fromMinorUnits(d.amountMinorUnits, d.currency),
      status,
      transferId: d.transferId ?? '',
      estimatedArrival: d.estimatedArrival,
      failureReason: d.failureReason
    };
  }

  // ==========================================================================
  // Disbursement Calculation Helpers
  // ==========================================================================

  /**
   * Calculate disbursement breakdown for an owner
   * Shows gross income, fees, deductions, and net payout
   */
  async calculateDisbursementBreakdown(
    tenantId: TenantId,
    ownerId: OwnerId,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<DisbursementBreakdown> {
    // Get owner's operating account
    const operatingAccount = await this.accountRepository.findByOwnerAndType(
      tenantId,
      ownerId,
      'OWNER_OPERATING'
    );

    if (!operatingAccount) {
      throw new Error(`Owner operating account not found for owner ${ownerId}`);
    }

    const currency = operatingAccount.currency;
    const availableBalance = Money.fromMinorUnits(
      operatingAccount.balanceMinorUnits,
      currency
    );

    // Default period to current month if not specified. Use UTC — local
    // date construction shifts the period boundary for non-UTC servers
    // and silently pulls/pushes entries across the month line.
    const now = new Date();
    const fromDate =
      periodStart ||
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const toDate =
      periodEnd ||
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    // Get ledger entries for the period to calculate breakdown
    const statement = await this.ledgerService.getStatement(
      operatingAccount.id,
      tenantId,
      fromDate,
      toDate
    );

    // Calculate breakdown from entries
    let grossRentMinor = 0;
    let platformFeesMinor = 0;
    let processingFeesMinor = 0;
    let maintenanceMinor = 0;
    let otherDeductionsMinor = 0;
    const items: DisbursementBreakdownItem[] = [];

    for (const entry of statement.entries) {
      if (entry.direction === 'DEBIT') {
        // Income items
        if (entry.type === 'RENT_PAYMENT') {
          grossRentMinor += entry.amount.amountMinorUnits;
          items.push({
            type: 'RENT_INCOME',
            description: entry.description || 'Rent Payment',
            amount: entry.amount,
            propertyId: entry.propertyId,
            unitId: entry.unitId,
          });
        } else if (entry.type === 'DEPOSIT_PAYMENT') {
          items.push({
            type: 'DEPOSIT_INCOME',
            description: entry.description || 'Deposit Payment',
            amount: entry.amount,
            propertyId: entry.propertyId,
            unitId: entry.unitId,
          });
        }
      } else {
        // Deduction items
        if (entry.type === 'PLATFORM_FEE') {
          platformFeesMinor += entry.amount.amountMinorUnits;
          items.push({
            type: 'PLATFORM_FEE',
            description: entry.description || 'Platform Fee',
            amount: Money.fromMinorUnits(-entry.amount.amountMinorUnits, currency),
            propertyId: entry.propertyId,
          });
        } else if ((entry.type as string) === 'PAYMENT_PROCESSING_FEE') {
          processingFeesMinor += entry.amount.amountMinorUnits;
          items.push({
            type: 'PROCESSING_FEE',
            description: entry.description || 'Processing Fee',
            amount: Money.fromMinorUnits(-entry.amount.amountMinorUnits, currency),
            propertyId: entry.propertyId,
          });
        } else if ((entry.type as string) === 'MAINTENANCE_CHARGE') {
          maintenanceMinor += entry.amount.amountMinorUnits;
          items.push({
            type: 'MAINTENANCE',
            description: entry.description || 'Maintenance Charge',
            amount: Money.fromMinorUnits(-entry.amount.amountMinorUnits, currency),
            propertyId: entry.propertyId,
            unitId: entry.unitId,
          });
        } else if (entry.type === 'OWNER_DISBURSEMENT') {
          // Skip - this is a previous disbursement
        } else {
          otherDeductionsMinor += entry.amount.amountMinorUnits;
          items.push({
            type: 'OTHER_DEDUCTION',
            description: entry.description || entry.type,
            amount: Money.fromMinorUnits(-entry.amount.amountMinorUnits, currency),
            propertyId: entry.propertyId,
          });
        }
      }
    }

    // Calculate holdback (reserve for future expenses, typically 10-20%)
    const holdbackPercent = 0; // Can be configured per owner
    const holdbackMinor = Math.round(grossRentMinor * holdbackPercent / 100);

    const netAmountMinor = grossRentMinor - platformFeesMinor - processingFeesMinor -
      maintenanceMinor - otherDeductionsMinor - holdbackMinor;

    return {
      grossAmount: Money.fromMinorUnits(grossRentMinor, currency),
      platformFee: Money.fromMinorUnits(platformFeesMinor, currency),
      processingFee: Money.fromMinorUnits(processingFeesMinor, currency),
      holdbackAmount: Money.fromMinorUnits(holdbackMinor, currency),
      netAmount: Money.fromMinorUnits(Math.max(0, netAmountMinor), currency),
      items,
    };
  }

  /**
   * Calculate net amount after fees.
   *
   * SINGLE FEE FORMULA: there is exactly ONE platform-fee engine in this
   * service —`calculatePlatformFeeMinor(amountMinor, bps)` from
   * `lib/platform-fee`. The previously-divergent `DisbursementService.
   * calculatePlatformFee` (percent × amount / 100, ROUNDED) was deleted: it
   * disagreed with the canonical engine (basis points, FLOORED) and would book
   * a fee a cent off from what the payment path charged. Fees are quoted in
   * BASIS POINTS (1 bps = 0.01%); a caller still holding a percent multiplies by
   * 100 before calling (e.g. 5% → 500 bps).
   */
  calculateNetAmount(
    grossAmount: Money,
    platformFeeBps: number,
    processingFeeBps: number = 0
  ): {
    gross: Money;
    platformFee: Money;
    processingFee: Money;
    net: Money;
  } {
    const platformFee = Money.fromMinorUnits(
      calculatePlatformFeeMinor(grossAmount.amountMinorUnits, platformFeeBps),
      grossAmount.currency,
    );
    const processingFee = Money.fromMinorUnits(
      calculatePlatformFeeMinor(grossAmount.amountMinorUnits, processingFeeBps),
      grossAmount.currency,
    );
    const netMinor = grossAmount.amountMinorUnits - platformFee.amountMinorUnits - processingFee.amountMinorUnits;

    return {
      gross: grossAmount,
      platformFee,
      processingFee,
      net: Money.fromMinorUnits(Math.max(0, netMinor), grossAmount.currency),
    };
  }

  /**
   * Preview a disbursement without processing it
   */
  async previewDisbursement(
    tenantId: TenantId,
    ownerId: OwnerId,
    amount?: Money
  ): Promise<{
    ownerId: OwnerId;
    availableBalance: Money;
    requestedAmount: Money;
    breakdown: DisbursementBreakdown;
    estimatedArrival: Date;
    warnings: string[];
  }> {
    const breakdown = await this.calculateDisbursementBreakdown(tenantId, ownerId);
    const warnings: string[] = [];

    // Get available balance
    const operatingAccount = await this.accountRepository.findByOwnerAndType(
      tenantId,
      ownerId,
      'OWNER_OPERATING'
    );

    if (!operatingAccount) {
      throw new Error(`Owner operating account not found for owner ${ownerId}`);
    }

    const availableBalance = Money.fromMinorUnits(
      operatingAccount.balanceMinorUnits,
      operatingAccount.currency
    );

    const requestedAmount = amount || availableBalance;

    // Validation warnings
    if (requestedAmount.isGreaterThan(availableBalance)) {
      warnings.push(`Requested amount exceeds available balance of ${availableBalance.toString()}`);
    }

    if (requestedAmount.amountMinorUnits < 1000) {
      warnings.push('Minimum disbursement amount is typically 10.00');
    }

    // Estimate arrival (typically 2-3 business days)
    const estimatedArrival = this.calculateEstimatedArrival();

    return {
      ownerId,
      availableBalance,
      requestedAmount,
      breakdown,
      estimatedArrival,
      warnings,
    };
  }

  /**
   * Get disbursement summary for all owners in a tenant
   */
  async getDisbursementSummary(
    tenantId: TenantId,
    minBalance: number = 1000,
    /**
     * Currency to report when no eligible owners exist. Caller supplies
     * this from tenant region-config; required so an empty-portfolio
     * summary never reports KES for a non-Kenya tenant.
     */
    fallbackCurrency?: string
  ): Promise<{
    totalEligibleOwners: number;
    totalDisbursableAmount: Money;
    owners: Array<{
      ownerId: OwnerId;
      availableBalance: Money;
      lastDisbursementDate?: Date;
    }>;
  }> {
    const eligibleOwners = await this.getEligibleOwners(tenantId, minBalance);

    if (eligibleOwners.length === 0) {
      if (!fallbackCurrency) {
        throw new Error(
          'disbursement: fallbackCurrency is required when there are no eligible owners.'
        );
      }
      return {
        totalEligibleOwners: 0,
        // Money.zero's parameter is typed to the platform's CurrencyCode
        // union; fallbackCurrency has already been validated as a non-
        // empty ISO-4217 code upstream (via region-config), so we cast
        // to satisfy the generated union type.
        totalDisbursableAmount: Money.zero(fallbackCurrency as never),
        owners: [],
      };
    }

    let totalMinor = 0;
    const currency = eligibleOwners[0].balance.currency;

    for (const owner of eligibleOwners) {
      totalMinor += owner.balance.amountMinorUnits;
    }

    return {
      totalEligibleOwners: eligibleOwners.length,
      totalDisbursableAmount: Money.fromMinorUnits(totalMinor, currency),
      owners: eligibleOwners.map(o => ({
        ownerId: o.ownerId,
        availableBalance: o.balance,
      })),
    };
  }

  /**
   * Calculate estimated arrival date for disbursement
   */
  private calculateEstimatedArrival(businessDays: number = 3): Date {
    const arrival = new Date();
    let daysAdded = 0;

    while (daysAdded < businessDays) {
      arrival.setDate(arrival.getDate() + 1);
      const dayOfWeek = arrival.getDay();
      // Skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysAdded++;
      }
    }

    return arrival;
  }
}

/**
 * Disbursement breakdown for calculations
 */
export interface DisbursementBreakdown {
  grossAmount: Money;
  platformFee: Money;
  processingFee: Money;
  holdbackAmount: Money;
  netAmount: Money;
  items: DisbursementBreakdownItem[];
}

export interface DisbursementBreakdownItem {
  type: string;
  description: string;
  amount: Money;
  propertyId?: PropertyId;
  unitId?: string;
}
