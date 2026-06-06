/**
 * Payment Orchestration Service
 * Coordinates payment processing across multiple providers
 */
import { v4 as uuidv4 } from 'uuid';
import {
  Money,
  PaymentIntent,
  PaymentIntentAggregate,
  PaymentIntentId,
  PaymentIntentType,
  TenantId,
  CustomerId,
  LeaseId,
  CurrencyCode,
  LedgerEntry,
  CreateJournalEntryRequest
} from '@bossnyumba/domain-models';
import type { PaymentStatus } from '../types';
import { TenantAggregate, createId, calculatePlatformFee } from '../domain-extensions';
import {
  IPaymentProvider,
  CreatePaymentResult
} from '../providers/payment-provider.interface';
import { IPaymentIntentRepository } from '../repositories/payment-intent.repository';
import { IAccountRepository } from '../repositories/account.repository';
import { IEventPublisher, createEvent } from '../events/event-publisher';
import {
  PaymentIntentCreatedEvent,
  PaymentProcessingStartedEvent,
  PaymentSucceededEvent,
  PaymentFailedEvent,
  PaymentRefundedEvent
} from '../events/payment-events';

/**
 * Logger interface
 */
export interface ILogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Create payment request
 */
export interface CreatePaymentRequest {
  tenantId: TenantId;
  customerId: CustomerId;
  leaseId?: LeaseId;
  type: PaymentIntentType;
  amount: Money;
  description: string;
  paymentMethodId?: string;
  statementDescriptor?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

/**
 * Payment result
 */
export interface PaymentResult {
  paymentIntentId: PaymentIntentId;
  status: PaymentStatus;
  clientSecret?: string;
  redirectUrl?: string;
  instructions?: string;
  receiptUrl?: string;
}

/**
 * Refund request
 */
export interface RefundRequest {
  paymentIntentId: PaymentIntentId;
  tenantId: TenantId;
  amount?: Money;  // Partial refund if specified
  reason?: string;
  idempotencyKey?: string;
}

/**
 * Refund result
 */
export interface PaymentRefundResult {
  refundId: string;
  paymentIntentId: PaymentIntentId;
  amount: Money;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}

/**
 * Narrow ledger capability the orchestrator needs (M5). Declared here
 * (rather than importing the concrete `LedgerService`) to avoid an
 * import cycle — `ledger.service.ts` imports `ILogger` from this file —
 * and to keep the dependency inverted. `LedgerService` structurally
 * satisfies this interface.
 */
export interface ILedgerPoster {
  postJournalEntry(request: CreateJournalEntryRequest): Promise<unknown>;
  findEntriesByPaymentIntent(
    paymentIntentId: PaymentIntentId,
    tenantId: TenantId,
  ): Promise<LedgerEntry[]>;
}

export interface PaymentOrchestrationServiceDeps {
  paymentIntentRepository: IPaymentIntentRepository;
  eventPublisher: IEventPublisher;
  logger: ILogger;
  /**
   * Books the ledger when a payment succeeds (M5). Optional so existing
   * call sites / tests that don't exercise the success path keep
   * working; when omitted, a succeeded payment is marked + emits its
   * event but is NOT booked (logged loudly). Production wires this.
   */
  ledgerService?: ILedgerPoster;
  /**
   * Resolves the customer-liability and platform-holding accounts used
   * for the rent-payment journal (M5). Required alongside `ledgerService`.
   */
  accountRepository?: IAccountRepository;
}

/**
 * Payment Orchestration Service
 * Handles payment lifecycle with pluggable providers
 */
export class PaymentOrchestrationService {
  private providers: Map<string, IPaymentProvider> = new Map();
  private defaultProvider: string | null = null;
  private currencyProviders: Map<CurrencyCode, string> = new Map();

  private repository: IPaymentIntentRepository;
  private eventPublisher: IEventPublisher;
  private logger: ILogger;
  private ledgerService?: ILedgerPoster;
  private accountRepository?: IAccountRepository;

  constructor(deps: PaymentOrchestrationServiceDeps) {
    this.repository = deps.paymentIntentRepository;
    this.eventPublisher = deps.eventPublisher;
    this.logger = deps.logger;
    this.ledgerService = deps.ledgerService;
    this.accountRepository = deps.accountRepository;
  }

  /**
   * Register a payment provider
   */
  registerProvider(
    provider: IPaymentProvider,
    options?: { isDefault?: boolean; currencies?: CurrencyCode[] }
  ): void {
    this.providers.set(provider.name, provider);
    
    if (options?.isDefault) {
      this.defaultProvider = provider.name;
    }

    // Map currencies to this provider
    const currencies = options?.currencies || provider.supportedCurrencies;
    for (const currency of currencies) {
      if (!this.currencyProviders.has(currency)) {
        this.currencyProviders.set(currency, provider.name);
      }
    }

    this.logger.info(`Registered payment provider: ${provider.name}`, {
      currencies: currencies,
      isDefault: options?.isDefault
    });
  }

  /**
   * Get provider for a currency
   */
  private getProvider(currency: CurrencyCode): IPaymentProvider {
    const providerName = this.currencyProviders.get(currency) || this.defaultProvider;
    if (!providerName) {
      throw new Error(`No payment provider configured for currency ${currency}`);
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Payment provider ${providerName} not found`);
    }

    return provider;
  }

  /**
   * Create a payment intent
   */
  async createPayment(
    request: CreatePaymentRequest,
    tenant: TenantAggregate
  ): Promise<PaymentResult> {
    const idempotencyKey = request.idempotencyKey || uuidv4();

    // Check for existing payment with same idempotency key
    const existing = await this.repository.findByIdempotencyKey(
      idempotencyKey,
      request.tenantId
    );
    if (existing) {
      this.logger.info('Returning existing payment for idempotency key', {
        paymentIntentId: existing.id,
        idempotencyKey
      });
      return {
        paymentIntentId: existing.id,
        status: existing.status
      };
    }

    // Calculate platform fee
    const platformFeePercent = tenant.getPlatformFeePercent();
    const platformFee = calculatePlatformFee(request.amount, platformFeePercent);
    const netAmount = request.amount.subtract(platformFee);

    // Create payment intent
    const paymentIntentId = createId<PaymentIntentId>(`pi_${uuidv4()}`);
    const now = new Date();

    const paymentIntent: PaymentIntent = {
      id: paymentIntentId,
      tenantId: request.tenantId,
      customerId: request.customerId,
      leaseId: request.leaseId,
      type: request.type,
      status: 'PENDING',
      amount: request.amount,
      platformFee,
      netAmount,
      description: request.description,
      idempotencyKey,
      statementDescriptor: request.statementDescriptor,
      metadata: request.metadata,
      createdAt: now,
      createdBy: 'system',
      updatedAt: now,
      updatedBy: 'system'
    };

    // Save to repository
    await this.repository.create(paymentIntent);

    // Publish event
    await this.eventPublisher.publish(
      createEvent<PaymentIntentCreatedEvent>(
        'PAYMENT_INTENT_CREATED',
        'PaymentIntent',
        paymentIntentId,
        request.tenantId,
        {
          customerId: request.customerId,
          leaseId: request.leaseId,
          amount: request.amount.toData(),
          type: request.type,
          description: request.description
        }
      )
    );

    this.logger.info('Payment intent created', {
      paymentIntentId,
      tenantId: request.tenantId,
      amount: request.amount.toString()
    });

    // If payment method provided, process immediately
    if (request.paymentMethodId) {
      return this.processPayment(
        paymentIntentId,
        request.tenantId,
        request.paymentMethodId,
        tenant
      );
    }

    return {
      paymentIntentId,
      status: 'PENDING'
    };
  }

  /**
   * Process a payment with a payment method
   */
  async processPayment(
    paymentIntentId: PaymentIntentId,
    tenantId: TenantId,
    paymentMethodId: string,
    tenant: TenantAggregate
  ): Promise<PaymentResult> {
    const paymentIntent = await this.repository.findById(paymentIntentId, tenantId);
    if (!paymentIntent) {
      throw new Error(`Payment intent ${paymentIntentId} not found`);
    }

    const aggregate = new PaymentIntentAggregate(paymentIntent);
    const provider = this.getProvider(paymentIntent.amount.currency);

    try {
      // Create payment with provider
      const result = await provider.createPaymentIntent({
        amount: paymentIntent.amount,
        customerId: paymentMethodId, // Would need mapping in real impl
        paymentMethodId,
        description: paymentIntent.description,
        statementDescriptor: paymentIntent.statementDescriptor,
        metadata: {
          tenantId: paymentIntent.tenantId,
          paymentIntentId: paymentIntent.id,
          ...paymentIntent.metadata as Record<string, string>
        },
        idempotencyKey: paymentIntent.idempotencyKey,
        applicationFeeAmount: paymentIntent.platformFee,
        transferDestination: tenant.paymentSettings.stripeAccountId
      });

      // Update payment intent with provider details
      aggregate.markProcessing(result.externalId, provider.name);
      await this.repository.update(aggregate.toData());

      // Publish event
      await this.eventPublisher.publish(
        createEvent<PaymentProcessingStartedEvent>(
          'PAYMENT_PROCESSING_STARTED',
          'PaymentIntent',
          paymentIntentId,
          tenantId,
          {
            externalId: result.externalId,
            providerName: provider.name
          }
        )
      );

      // If requires action, return client secret
      if (result.status === 'REQUIRES_ACTION') {
        aggregate.markRequiresAction('Customer action required');
        await this.repository.update(aggregate.toData());
        
        return {
          paymentIntentId,
          status: 'REQUIRES_ACTION',
          clientSecret: result.clientSecret,
          redirectUrl: result.redirectUrl,
          instructions: result.instructions
        };
      }

      // If succeeded immediately
      if (result.status === 'SUCCEEDED') {
        return this.handlePaymentSuccess(aggregate, tenantId);
      }

      return {
        paymentIntentId,
        status: result.status,
        clientSecret: result.clientSecret
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      aggregate.markFailed(errorMessage);
      await this.repository.update(aggregate.toData());

      await this.eventPublisher.publish(
        createEvent<PaymentFailedEvent>(
          'PAYMENT_FAILED',
          'PaymentIntent',
          paymentIntentId,
          tenantId,
          {
            customerId: paymentIntent.customerId,
            failureReason: errorMessage
          }
        )
      );

      this.logger.error('Payment processing failed', {
        paymentIntentId,
        error: errorMessage
      });

      throw error;
    }
  }

  /**
   * Handle payment success (called by webhook handler).
   *
   * Webhook delivery is at-least-once (Safaricom/Stripe retry until they
   * see a 200), so this method MUST be idempotent (M5):
   *
   *   - If the intent is already SUCCEEDED (a redelivery), we do NOT
   *     re-mark it (the aggregate would throw) and we do NOT re-emit
   *     PAYMENT_SUCCEEDED — but we still attempt the ledger booking,
   *     which is itself idempotent on paymentIntentId, to self-heal the
   *     case where a prior attempt marked the intent but crashed before
   *     booking.
   *   - Otherwise we mark succeeded, persist, book the ledger, and emit.
   */
  async handlePaymentSuccess(
    aggregate: PaymentIntentAggregate,
    tenantId: TenantId,
    receiptUrl?: string
  ): Promise<PaymentResult> {
    const alreadySucceeded = aggregate.status === 'SUCCEEDED';

    if (!alreadySucceeded) {
      aggregate.markSucceeded(receiptUrl);
      await this.repository.update(aggregate.toData());
    }
    const paymentIntent = aggregate.toData();

    // Book the payment into the immutable ledger. Idempotent on
    // paymentIntentId, so a redelivered webhook never double-credits.
    await this.bookPaymentToLedger(paymentIntent, tenantId);

    if (!alreadySucceeded) {
      await this.eventPublisher.publish(
        createEvent<PaymentSucceededEvent>(
          'PAYMENT_SUCCEEDED',
          'PaymentIntent',
          paymentIntent.id,
          tenantId,
          {
            customerId: paymentIntent.customerId,
            leaseId: paymentIntent.leaseId,
            amount: paymentIntent.amount.toData(),
            platformFee: paymentIntent.platformFee?.toData(),
            netAmount: paymentIntent.netAmount?.toData(),
            paidAt: paymentIntent.paidAt!,
            receiptUrl
          }
        )
      );
    }

    this.logger.info('Payment succeeded', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount.toString(),
      redelivery: alreadySucceeded
    });

    return {
      paymentIntentId: paymentIntent.id,
      status: 'SUCCEEDED',
      receiptUrl
    };
  }

  /**
   * Post the double-entry journal for a succeeded payment (M5).
   *
   * Books DEBIT platform-holding (cash/clearing received) / CREDIT
   * customer-liability (reduce what the customer owes), tagged with the
   * paymentIntentId so reconciliation and the idempotency check can find
   * it. The post itself is atomic + row-locked (M2).
   *
   * IDEMPOTENT on paymentIntentId: if any ledger entry already exists for
   * this payment we skip, so at-least-once webhook delivery cannot
   * double-credit.
   *
   * Fail-loud: if the ledger capability is not wired, or the required
   * accounts are missing, we throw so the webhook is retried and the
   * payment is NOT silently lost. (Callers that must always ack to the
   * provider — e.g. the C2B handler — already wrap this in a try/catch
   * that logs for manual reconciliation.)
   */
  private async bookPaymentToLedger(
    paymentIntent: PaymentIntent,
    tenantId: TenantId,
  ): Promise<void> {
    if (!this.ledgerService || !this.accountRepository) {
      this.logger.error(
        'Payment succeeded but ledger posting is not wired — payment NOT booked',
        { paymentIntentId: paymentIntent.id, tenantId },
      );
      throw new Error(
        'LedgerService/accountRepository not configured: cannot book payment to ledger',
      );
    }

    // Idempotency: skip if a journal already exists for this payment.
    const existing = await this.ledgerService.findEntriesByPaymentIntent(
      paymentIntent.id,
      tenantId,
    );
    if (existing.length > 0) {
      this.logger.info('Payment already booked to ledger — skipping (idempotent)', {
        paymentIntentId: paymentIntent.id,
        existingEntries: existing.length,
      });
      return;
    }

    // Resolve the two accounts for the rent-payment booking.
    const holding = await this.accountRepository.findPlatformAccounts(
      tenantId,
      'PLATFORM_HOLDING',
    );
    if (!holding) {
      throw new Error(`Platform holding account not found for tenant ${tenantId}`);
    }
    const liability = await this.accountRepository.findByCustomerAndType(
      tenantId,
      paymentIntent.customerId,
      'CUSTOMER_LIABILITY',
    );
    if (!liability) {
      throw new Error(
        `Customer liability account not found for customer ${paymentIntent.customerId}`,
      );
    }

    const gross = paymentIntent.amount;
    // Balanced 2-line journal: cash in (debit holding), receivable down
    // (credit customer liability). Both legs in the payment's currency —
    // LedgerService re-validates currency against the locked account row.
    const journal: CreateJournalEntryRequest = {
      tenantId,
      effectiveDate: paymentIntent.paidAt ?? new Date(),
      paymentIntentId: paymentIntent.id,
      lines: [
        {
          accountId: holding.id,
          type: 'RENT_PAYMENT',
          direction: 'DEBIT',
          amount: gross,
          description: 'Payment received into holding',
          leaseId: paymentIntent.leaseId,
        },
        {
          accountId: liability.id,
          type: 'RENT_PAYMENT',
          direction: 'CREDIT',
          amount: gross,
          description: 'Rent payment received',
          leaseId: paymentIntent.leaseId,
        },
      ],
      createdBy: 'system',
    };

    await this.ledgerService.postJournalEntry(journal);
    this.logger.info('Payment booked to ledger', {
      paymentIntentId: paymentIntent.id,
      amount: gross.toString(),
    });
  }

  /**
   * Self-heal the mark→book crash window (MUST-FIX 1).
   *
   * The webhook routes claim the idempotency key BEFORE this service
   * runs, and {@link handlePaymentSuccess} marks the intent SUCCEEDED +
   * persists BEFORE it books the ledger. If the process crashes between
   * the persist and the book, the key stays claimed: the provider's retry
   * sees `claim() === duplicate`, acks, and would NEVER book — cash
   * collected, no journal. (The self-heal inside `bookPaymentToLedger` is
   * unreachable behind the route-level claim.)
   *
   * The DUPLICATE branch of each webhook route calls this BEFORE acking
   * 200 so a crash-then-retry self-heals: look up the intent by its
   * provider external id; if it is SUCCEEDED and has NO ledger entries,
   * book it. Idempotent on `paymentIntentId` (via `bookPaymentToLedger`),
   * so a normal duplicate (already booked) books zero extra, and a
   * never-succeeded or unknown intent is a safe no-op.
   *
   * Fail-soft on lookup: a missing intent or non-success status returns
   * without throwing (the caller has already deduped and only wants to
   * heal a genuine gap). A booking failure DOES propagate so the caller
   * can log it for manual reconciliation.
   */
  async ensurePaymentBooked(
    externalId: string,
    providerName: string,
    tenantId: TenantId,
  ): Promise<void> {
    const paymentIntent = await this.repository.findByExternalId(
      externalId,
      providerName,
      tenantId,
    );
    if (!paymentIntent) {
      this.logger.warn('ensurePaymentBooked: no intent for external id — skipping', {
        externalId,
        providerName,
        tenantId,
      });
      return;
    }

    // Only a SUCCEEDED payment should ever be booked. A duplicate of a
    // pending/failed/cancelled callback must never create a journal.
    if (paymentIntent.status !== 'SUCCEEDED') {
      this.logger.info('ensurePaymentBooked: intent not SUCCEEDED — nothing to heal', {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      });
      return;
    }

    // bookPaymentToLedger is idempotent on paymentIntentId: it no-ops when
    // a journal already exists, and books the gap when none does.
    await this.bookPaymentToLedger(paymentIntent, tenantId);
  }

  /**
   * Handle webhook from payment provider.
   *
   * W4-A: `tenantId` is REQUIRED. The router (`server.ts`) resolves it from
   * the verified provider payload (Stripe `metadata.tenantId`, M-Pesa
   * shortcode map) BEFORE calling this method, so the tenant-scoped
   * `findByExternalId` can guarantee cross-tenant isolation per
   * migration 0169.
   */
  async handleWebhook(
    providerName: string,
    externalId: string,
    status: PaymentStatus,
    tenantId: TenantId,
    receiptUrl?: string,
    failureReason?: string
  ): Promise<void> {
    const paymentIntent = await this.repository.findByExternalId(
      externalId,
      providerName,
      tenantId
    );
    if (!paymentIntent) {
      this.logger.warn('Payment intent not found for webhook', {
        externalId,
        providerName,
        tenantId
      });
      return;
    }

    const aggregate = new PaymentIntentAggregate(paymentIntent);

    switch (status) {
      case 'SUCCEEDED':
        await this.handlePaymentSuccess(aggregate, paymentIntent.tenantId, receiptUrl);
        break;
      case 'FAILED':
        aggregate.markFailed(failureReason || 'Payment failed');
        await this.repository.update(aggregate.toData());
        await this.eventPublisher.publish(
          createEvent<PaymentFailedEvent>(
            'PAYMENT_FAILED',
            'PaymentIntent',
            paymentIntent.id,
            paymentIntent.tenantId,
            {
              customerId: paymentIntent.customerId,
              failureReason: failureReason || 'Payment failed'
            }
          )
        );
        break;
      case 'CANCELLED':
        aggregate.cancel(failureReason || 'Payment cancelled');
        await this.repository.update(aggregate.toData());
        break;
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(request: RefundRequest): Promise<PaymentRefundResult> {
    const paymentIntent = await this.repository.findById(
      request.paymentIntentId,
      request.tenantId
    );
    if (!paymentIntent) {
      throw new Error(`Payment intent ${request.paymentIntentId} not found`);
    }

    const aggregate = new PaymentIntentAggregate(paymentIntent);
    if (!aggregate.canRefund()) {
      throw new Error(`Payment ${request.paymentIntentId} cannot be refunded`);
    }

    const refundAmount = request.amount || aggregate.getRefundableAmount();
    if (refundAmount.isGreaterThan(aggregate.getRefundableAmount())) {
      throw new Error('Refund amount exceeds refundable amount');
    }

    const provider = this.getProvider(paymentIntent.amount.currency);
    const idempotencyKey = request.idempotencyKey || uuidv4();

    const result = await provider.refundPayment({
      paymentIntentExternalId: paymentIntent.externalId!,
      amount: request.amount,
      reason: request.reason,
      idempotencyKey
    });

    if (result.status === 'SUCCEEDED') {
      aggregate.recordRefund(refundAmount);
      await this.repository.update(aggregate.toData());

      await this.eventPublisher.publish(
        createEvent<PaymentRefundedEvent>(
          'PAYMENT_REFUNDED',
          'PaymentIntent',
          paymentIntent.id,
          request.tenantId,
          {
            customerId: paymentIntent.customerId,
            refundAmount: refundAmount.toData(),
            totalRefunded: (aggregate.toData().refundedAmount || refundAmount).toData(),
            isFullRefund: aggregate.toData().status === 'REFUNDED'
          }
        )
      );
    }

    return {
      refundId: result.refundId,
      paymentIntentId: request.paymentIntentId,
      amount: refundAmount,
      status: result.status
    };
  }

  /**
   * Get payment intent
   */
  async getPaymentIntent(
    paymentIntentId: PaymentIntentId,
    tenantId: TenantId
  ): Promise<PaymentIntent | null> {
    return this.repository.findById(paymentIntentId, tenantId);
  }

  /**
   * Get pending payments for customer
   */
  async getPendingPayments(
    tenantId: TenantId,
    customerId: CustomerId
  ): Promise<PaymentIntent[]> {
    return this.repository.findPendingByCustomer(tenantId, customerId);
  }
}
