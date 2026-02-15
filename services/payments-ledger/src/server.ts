/**
 * Payments & Ledger Service Server
 * HTTP server entry point
 */
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { z } from 'zod';

import {
  Money,
  TenantId,
  CustomerId,
  LeaseId,
  PaymentIntentId,
  AccountId,
  OwnerId,
  StatementId,
  PaymentStatus,
  asTenantId,
  asCustomerId,
  asLeaseId,
  asAccountId,
  asOwnerId,
  asStatementId,
  asPaymentIntentId,
  CurrencyCode,
  JournalTemplates
} from '@bossnyumba/domain-models';

// Import domain extensions to augment Money prototype and get TenantAggregate
import './domain-extensions';
import { TenantAggregate } from './domain-extensions';

import { StripePaymentProvider } from './providers/stripe-provider';
import { MpesaPaymentProvider } from './providers/mpesa-provider';
import { PaymentOrchestrationService, CreatePaymentRequest } from './services/payment-orchestration.service';
import { LedgerService } from './services/ledger.service';
import { ReconciliationService } from './services/reconciliation.service';
import { StatementGenerationService, GenerateStatementRequest } from './services/statement-generation.service';
import { DisbursementService, DisbursementRequest } from './services/disbursement.service';
import { InMemoryEventPublisher } from './events/event-publisher';
import { InMemoryPaymentIntentRepository } from './repositories/payment-intent.repository';
import { InMemoryAccountRepository } from './repositories/account.repository';
import { InMemoryLedgerRepository } from './repositories/ledger.repository';
import { InMemoryStatementRepository } from './repositories/statement.repository';
import { InMemoryDisbursementRepository } from './repositories/disbursement.repository';
import { ReconciliationJob } from './jobs/reconciliation.job';
import { StatementGenerationJob } from './jobs/statement-generation.job';
import { DisbursementJob } from './jobs/disbursement.job';

// =============================================================================
// Request Validation Schemas
// =============================================================================

const CreatePaymentSchema = z.object({
  tenantId: z.string(),
  customerId: z.string(),
  leaseId: z.string().optional(),
  type: z.enum(['RENT_PAYMENT', 'DEPOSIT_PAYMENT', 'LATE_FEE_PAYMENT', 'MAINTENANCE_PAYMENT', 'UTILITY_PAYMENT', 'CONTRIBUTION', 'OTHER']),
  amount: z.object({
    amount: z.number().int().positive(),
    currency: z.enum(['KES', 'USD', 'EUR', 'GBP', 'TZS', 'UGX'])
  }),
  description: z.string().max(500),
  paymentMethodId: z.string().optional(),
  statementDescriptor: z.string().max(22).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().optional()
});

const GenerateStatementSchema = z.object({
  tenantId: z.string(),
  type: z.enum(['OWNER_STATEMENT', 'CUSTOMER_STATEMENT', 'PROPERTY_STATEMENT', 'RECONCILIATION_REPORT']),
  periodType: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM']),
  periodStart: z.string().transform(s => new Date(s)),
  periodEnd: z.string().transform(s => new Date(s)),
  accountId: z.string(),
  ownerId: z.string().optional(),
  customerId: z.string().optional(),
  includeDetails: z.boolean().optional()
});

const CreateDisbursementSchema = z.object({
  tenantId: z.string(),
  ownerId: z.string(),
  amount: z.object({
    amount: z.number().int().positive(),
    currency: z.enum(['KES', 'USD', 'EUR', 'GBP', 'TZS', 'UGX'])
  }).optional(),
  destination: z.string(),
  description: z.string().optional(),
  idempotencyKey: z.string().optional()
});

// M-PESA STK Callback Schema
const MpesaStkCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number(),
      ResultDesc: z.string(),
      CallbackMetadata: z.object({
        Item: z.array(z.object({
          Name: z.string(),
          Value: z.union([z.string(), z.number()]).optional()
        }))
      }).optional()
    })
  })
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract tenant ID from request headers or query
 */
function getTenantId(req: Request): TenantId {
  const tenantId = req.headers['x-tenant-id'] as string || req.query.tenantId as string;
  if (!tenantId) {
    throw new Error('Tenant ID required');
  }
  return asTenantId(tenantId);
}

/**
 * Create a mock tenant aggregate for development
 * In production, this would be fetched from the tenant service
 */
function getMockTenantAggregate(tenantId: TenantId): TenantAggregate {
  // Mock implementation - in production, fetch from tenant service
  return {
    id: tenantId,
    getPlatformFeePercent: () => 5.0,  // 5% platform fee
    paymentSettings: {
      stripeAccountId: process.env.STRIPE_CONNECTED_ACCOUNT_ID || undefined
    }
  } as unknown as TenantAggregate;
}

// =============================================================================
// Initialize Logger
// =============================================================================

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' 
    ? { target: 'pino-pretty' }
    : undefined
});

// =============================================================================
// Create Express app
// =============================================================================

const app = express();

// =============================================================================
// Initialize Repositories
// =============================================================================

const paymentIntentRepository = new InMemoryPaymentIntentRepository();
const accountRepository = new InMemoryAccountRepository();
const ledgerRepository = new InMemoryLedgerRepository();
const statementRepository = new InMemoryStatementRepository();
const disbursementRepository = new InMemoryDisbursementRepository();
const eventPublisher = new InMemoryEventPublisher();

// =============================================================================
// Initialize Services
// =============================================================================

const paymentOrchestrationService = new PaymentOrchestrationService({
  paymentIntentRepository,
  eventPublisher,
  logger: {
    info: (msg, ctx) => logger.info(ctx, msg),
    warn: (msg, ctx) => logger.warn(ctx, msg),
    error: (msg, ctx) => logger.error(ctx, msg)
  }
});

const ledgerService = new LedgerService({
  ledgerRepository,
  accountRepository,
  eventPublisher,
  logger: {
    info: (msg, ctx) => logger.info(ctx, msg),
    warn: (msg, ctx) => logger.warn(ctx, msg),
    error: (msg, ctx) => logger.error(ctx, msg)
  }
});

const reconciliationService = new ReconciliationService({
  paymentIntentRepository,
  ledgerRepository,
  accountRepository,
  eventPublisher,
  logger: {
    info: (msg, ctx) => logger.info(ctx, msg),
    warn: (msg, ctx) => logger.warn(ctx, msg),
    error: (msg, ctx) => logger.error(ctx, msg)
  }
});

const statementGenerationService = new StatementGenerationService({
  ledgerRepository,
  accountRepository,
  statementRepository,
  eventPublisher,
  logger: {
    info: (msg, ctx) => logger.info(ctx, msg),
    warn: (msg, ctx) => logger.warn(ctx, msg),
    error: (msg, ctx) => logger.error(ctx, msg)
  }
});

const disbursementService = new DisbursementService({
  accountRepository,
  disbursementRepository,
  ledgerService,
  eventPublisher,
  logger: {
    info: (msg, ctx) => logger.info(ctx, msg),
    warn: (msg, ctx) => logger.warn(ctx, msg),
    error: (msg, ctx) => logger.error(ctx, msg)
  }
});

// =============================================================================
// Store providers for webhook handling
// =============================================================================

let stripeProvider: StripePaymentProvider | null = null;
let mpesaProvider: MpesaPaymentProvider | null = null;

// Register payment providers if configured
if (process.env.STRIPE_SECRET_KEY) {
  stripeProvider = new StripePaymentProvider({
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
  });
  paymentOrchestrationService.registerProvider(stripeProvider, { isDefault: true });
  reconciliationService.registerProvider(stripeProvider);
  disbursementService.registerProvider(stripeProvider, true);
  logger.info('Stripe payment provider registered');
}

if (process.env.MPESA_CONSUMER_KEY) {
  mpesaProvider = new MpesaPaymentProvider({
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
    shortCode: process.env.MPESA_SHORT_CODE || '',
    passKey: process.env.MPESA_PASS_KEY || '',
    environment: (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
    callbackBaseUrl: process.env.MPESA_CALLBACK_URL || ''
  });
  paymentOrchestrationService.registerProvider(mpesaProvider, { currencies: ['KES'] });
  logger.info('M-PESA payment provider registered');
}

// =============================================================================
// Initialize Background Jobs
// =============================================================================

const reconciliationJob = new ReconciliationJob(
  reconciliationService,
  {
    info: (msg, ctx) => logger.info(ctx, msg),
    warn: (msg, ctx) => logger.warn(ctx, msg),
    error: (msg, ctx) => logger.error(ctx, msg)
  }
);

const statementJob = new StatementGenerationJob(
  statementGenerationService,
  accountRepository,
  {
    info: (msg, ctx) => logger.info(ctx, msg),
    warn: (msg, ctx) => logger.warn(ctx, msg),
    error: (msg, ctx) => logger.error(ctx, msg)
  }
);

const disbursementJob = new DisbursementJob(
  disbursementService,
  {
    info: (msg, ctx) => logger.info(ctx, msg),
    warn: (msg, ctx) => logger.warn(ctx, msg),
    error: (msg, ctx) => logger.error(ctx, msg)
  }
);

// =============================================================================
// Middleware
// =============================================================================

app.use(helmet());

// Parse JSON for most routes, but keep raw body for webhooks
app.use((req, res, next) => {
  if (req.path.startsWith('/webhooks/stripe')) {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.use(pinoHttp({ logger }));

// =============================================================================
// Health Check Endpoint
// =============================================================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'payments-ledger',
    timestamp: new Date().toISOString(),
    providers: {
      stripe: !!stripeProvider,
      mpesa: !!mpesaProvider
    }
  });
});

// =============================================================================
// Payment Routes
// =============================================================================

/**
 * POST /api/v1/payments - Create a payment intent
 */
app.post('/api/v1/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = CreatePaymentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors
      });
    }

    const data = validation.data;
    const tenantId = asTenantId(data.tenantId);
    const tenant = getMockTenantAggregate(tenantId);

    const request: CreatePaymentRequest = {
      tenantId,
      customerId: asCustomerId(data.customerId),
      leaseId: data.leaseId ? asLeaseId(data.leaseId) : undefined,
      type: data.type,
      amount: Money.fromMinorUnits(data.amount.amount, data.amount.currency as CurrencyCode),
      description: data.description,
      paymentMethodId: data.paymentMethodId,
      statementDescriptor: data.statementDescriptor,
      metadata: data.metadata,
      idempotencyKey: data.idempotencyKey
    };

    const result = await paymentOrchestrationService.createPayment(request, tenant);

    res.status(201).json({
      paymentIntentId: result.paymentIntentId,
      status: result.status,
      clientSecret: result.clientSecret,
      redirectUrl: result.redirectUrl,
      instructions: result.instructions
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/payments/:id - Get payment details
 */
app.get('/api/v1/payments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const paymentIntentId = asPaymentIntentId(req.params.id);

    const paymentIntent = await paymentOrchestrationService.getPaymentIntent(
      paymentIntentId,
      tenantId
    );

    if (!paymentIntent) {
      return res.status(404).json({ error: 'Payment intent not found' });
    }

    res.json({
      id: paymentIntent.id,
      tenantId: paymentIntent.tenantId,
      customerId: paymentIntent.customerId,
      leaseId: paymentIntent.leaseId,
      type: paymentIntent.type,
      status: paymentIntent.status,
      amount: paymentIntent.amount.toData(),
      platformFee: paymentIntent.platformFee?.toData(),
      netAmount: paymentIntent.netAmount?.toData(),
      description: paymentIntent.description,
      paidAt: paymentIntent.paidAt,
      receiptUrl: paymentIntent.receiptUrl,
      failureReason: paymentIntent.failureReason,
      createdAt: paymentIntent.createdAt
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/payments/:id/confirm - Confirm a payment with payment method
 */
app.post('/api/v1/payments/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const paymentIntentId = asPaymentIntentId(req.params.id);
    const { paymentMethodId } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'paymentMethodId is required' });
    }

    const tenant = getMockTenantAggregate(tenantId);
    const result = await paymentOrchestrationService.processPayment(
      paymentIntentId,
      tenantId,
      paymentMethodId,
      tenant
    );

    res.json({
      paymentIntentId: result.paymentIntentId,
      status: result.status,
      clientSecret: result.clientSecret,
      redirectUrl: result.redirectUrl,
      instructions: result.instructions,
      receiptUrl: result.receiptUrl
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/payments/:id/process - Process a payment (alias for confirm)
 */
app.post('/api/v1/payments/:id/process', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const paymentIntentId = asPaymentIntentId(req.params.id);
    const { paymentMethodId } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'paymentMethodId is required' });
    }

    const tenant = getMockTenantAggregate(tenantId);
    const result = await paymentOrchestrationService.processPayment(
      paymentIntentId,
      tenantId,
      paymentMethodId,
      tenant
    );

    res.json({
      paymentIntentId: result.paymentIntentId,
      status: result.status,
      clientSecret: result.clientSecret,
      redirectUrl: result.redirectUrl,
      instructions: result.instructions,
      receiptUrl: result.receiptUrl
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/payments/:id/refund - Refund a payment
 */
app.post('/api/v1/payments/:id/refund', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const paymentIntentId = asPaymentIntentId(req.params.id);
    const { amount, reason, idempotencyKey } = req.body;

    const result = await paymentOrchestrationService.refundPayment({
      paymentIntentId,
      tenantId,
      amount: amount ? Money.fromMinorUnits(amount.amount, amount.currency) : undefined,
      reason,
      idempotencyKey
    });

    res.json({
      refundId: result.refundId,
      paymentIntentId: result.paymentIntentId,
      amount: result.amount.toData(),
      status: result.status
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Ledger Routes
// =============================================================================

/**
 * GET /api/v1/accounts/:id/entries - Get ledger entries for an account
 */
app.get('/api/v1/accounts/:id/entries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const accountId = asAccountId(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;

    const result = await ledgerService.getAccountEntries(
      accountId,
      tenantId,
      page,
      pageSize
    );

    res.json({
      entries: result.entries.map(entry => ({
        id: entry.id,
        journalId: entry.journalId,
        type: entry.type,
        direction: entry.direction,
        amount: entry.amount.toData(),
        balanceAfter: entry.balanceAfter.toData(),
        sequenceNumber: entry.sequenceNumber,
        effectiveDate: entry.effectiveDate,
        postedAt: entry.postedAt,
        description: entry.description,
        paymentIntentId: entry.paymentIntentId,
        leaseId: entry.leaseId,
        propertyId: entry.propertyId,
        unitId: entry.unitId
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/accounts/:id/entries - Create a ledger entry for a specific account
 * Convenience endpoint that wraps POST /api/v1/journal for a single account
 */
app.post('/api/v1/accounts/:id/entries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const accountId = asAccountId(req.params.id);
    const { type, direction, amount, description, effectiveDate, paymentIntentId, leaseId, propertyId, unitId, metadata, createdBy } = req.body;

    if (!type || !direction || !amount) {
      return res.status(400).json({
        error: 'Validation error',
        details: 'type, direction, and amount are required'
      });
    }

    if (!['DEBIT', 'CREDIT'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be DEBIT or CREDIT' });
    }

    const moneyAmount = Money.fromMinorUnits(amount.amount, amount.currency as CurrencyCode);

    const result = await ledgerService.postJournalEntry({
      tenantId,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      paymentIntentId: paymentIntentId ? asPaymentIntentId(paymentIntentId) : undefined,
      lines: [{
        accountId,
        type,
        direction,
        amount: moneyAmount,
        description: description || type,
        leaseId,
        propertyId,
        unitId,
        metadata
      }],
      createdBy: createdBy || 'system'
    });

    res.status(201).json({
      journalId: result.journalId,
      entries: result.entries.map(e => ({
        id: e.id,
        accountId: e.accountId,
        direction: e.direction,
        amount: e.amount.toData(),
        balanceAfter: e.balanceAfter.toData(),
        sequenceNumber: e.sequenceNumber
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/accounts/:id/balance - Get account balance
 */
app.get('/api/v1/accounts/:id/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const accountId = asAccountId(req.params.id);
    const asOfDate = req.query.asOf ? new Date(req.query.asOf as string) : undefined;

    if (asOfDate) {
      const balance = await ledgerService.getAccountBalanceAsOf(accountId, tenantId, asOfDate);
      if (!balance) {
        return res.status(404).json({ error: 'Account not found or no entries' });
      }
      res.json({
        accountId: balance.accountId,
        balance: balance.balance,
        currency: balance.currency,
        asOf: balance.asOf,
        lastEntryId: balance.lastEntryId
      });
    } else {
      const balance = await ledgerService.getAccountBalance(accountId, tenantId);
      if (!balance) {
        return res.status(404).json({ error: 'Account not found' });
      }
      res.json({
        accountId,
        balance: balance.toData(),
        asOf: new Date()
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/journal - Post a journal entry
 */
app.post('/api/v1/journal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { effectiveDate, paymentIntentId, lines, createdBy } = req.body;

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'At least one journal line is required' });
    }

    const result = await ledgerService.postJournalEntry({
      tenantId,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      paymentIntentId: paymentIntentId ? asPaymentIntentId(paymentIntentId) : undefined,
      lines: lines.map((line: {
        accountId: string;
        type: string;
        direction: 'DEBIT' | 'CREDIT';
        amount: { amount: number; currency: CurrencyCode };
        description: string;
        leaseId?: string;
        propertyId?: string;
        unitId?: string;
        metadata?: Record<string, unknown>;
      }) => ({
        ...line,
        type: line.type as any,
        accountId: asAccountId(line.accountId),
        amount: Money.fromMinorUnits(line.amount.amount, line.amount.currency)
      })) as any,
      createdBy: createdBy || 'system'
    });

    res.status(201).json({
      journalId: result.journalId,
      entries: result.entries.map(e => ({
        id: e.id,
        accountId: e.accountId,
        direction: e.direction,
        amount: e.amount.toData(),
        balanceAfter: e.balanceAfter.toData()
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/accounts/:id/verify - Verify account ledger integrity
 */
app.get('/api/v1/accounts/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const accountId = asAccountId(req.params.id);

    const [balanceResult, sequenceResult] = await Promise.all([
      ledgerService.verifyAccountIntegrity(accountId, tenantId),
      ledgerService.verifySequenceIntegrity(accountId, tenantId)
    ]);

    res.json({
      accountId,
      balanceValid: balanceResult.valid,
      sequenceValid: sequenceResult.valid,
      storedBalance: balanceResult.storedBalance?.toData(),
      calculatedBalance: balanceResult.calculatedBalance?.toData(),
      discrepancy: balanceResult.discrepancy?.toData(),
      sequenceGaps: sequenceResult.gaps,
      sequenceDuplicates: sequenceResult.duplicates
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Statement Routes
// =============================================================================

/**
 * GET /api/v1/statements - List statements
 */
app.get('/api/v1/statements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const ownerId = req.query.ownerId as string | undefined;
    const customerId = req.query.customerId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    if (ownerId) {
      const result = await statementGenerationService.getOwnerStatements(
        tenantId,
        asOwnerId(ownerId),
        page,
        pageSize
      );
      return res.json({
        statements: result.statements.map(s => ({
          id: s.id,
          type: s.type,
          status: s.status,
          periodType: s.periodType,
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
          openingBalance: s.openingBalance.toData(),
          closingBalance: s.closingBalance.toData(),
          generatedAt: s.generatedAt,
          sentAt: s.sentAt
        })),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore
      });
    }

    if (customerId) {
      const result = await statementGenerationService.getCustomerStatements(
        tenantId,
        asCustomerId(customerId),
        page,
        pageSize
      );
      return res.json({
        statements: result.statements.map(s => ({
          id: s.id,
          type: s.type,
          status: s.status,
          periodType: s.periodType,
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
          openingBalance: s.openingBalance.toData(),
          closingBalance: s.closingBalance.toData(),
          generatedAt: s.generatedAt,
          sentAt: s.sentAt
        })),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore
      });
    }

    return res.status(400).json({ error: 'Either ownerId or customerId query parameter is required' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/statements - Generate a statement
 */
app.post('/api/v1/statements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = GenerateStatementSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors
      });
    }

    const data = validation.data;
    const request: GenerateStatementRequest = {
      tenantId: asTenantId(data.tenantId),
      type: data.type,
      periodType: data.periodType,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      accountId: asAccountId(data.accountId),
      ownerId: data.ownerId ? asOwnerId(data.ownerId) : undefined,
      customerId: data.customerId ? asCustomerId(data.customerId) : undefined,
      includeDetails: data.includeDetails
    };

    const statement = await statementGenerationService.generateStatement(request);

    res.status(201).json({
      id: statement.id,
      type: statement.type,
      status: statement.status,
      periodType: statement.periodType,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      openingBalance: statement.openingBalance.toData(),
      closingBalance: statement.closingBalance.toData(),
      totalDebits: statement.totalDebits.toData(),
      totalCredits: statement.totalCredits.toData(),
      netChange: statement.netChange.toData(),
      lineItemCount: statement.lineItems.length,
      generatedAt: statement.generatedAt
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/statements/:id - Get statement details
 */
app.get('/api/v1/statements/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const statementId = asStatementId(req.params.id);

    const statement = await statementGenerationService.getStatement(statementId, tenantId);

    if (!statement) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    res.json({
      id: statement.id,
      tenantId: statement.tenantId,
      type: statement.type,
      status: statement.status,
      periodType: statement.periodType,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      ownerId: statement.ownerId,
      customerId: statement.customerId,
      accountId: statement.accountId,
      currency: statement.currency,
      openingBalance: statement.openingBalance.toData(),
      closingBalance: statement.closingBalance.toData(),
      totalDebits: statement.totalDebits.toData(),
      totalCredits: statement.totalCredits.toData(),
      netChange: statement.netChange.toData(),
      lineItems: statement.lineItems.map(item => ({
        date: item.date,
        type: item.type,
        description: item.description,
        reference: item.reference,
        debit: item.debit?.toData(),
        credit: item.credit?.toData(),
        balance: item.balance.toData()
      })),
      summaries: statement.summaries.map(s => ({
        label: s.label,
        amount: s.amount.toData(),
        percentage: s.percentage
      })),
      generatedAt: statement.generatedAt,
      sentAt: statement.sentAt,
      viewedAt: statement.viewedAt,
      documentUrl: statement.documentUrl
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/statements/:id/export - Export statement as PDF/CSV/JSON
 * Query params: format=pdf|csv|json, companyName, companyAddress
 */
app.get('/api/v1/statements/:id/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const statementId = asStatementId(req.params.id);
    const format = (req.query.format as string || 'pdf') as 'pdf' | 'csv' | 'json';

    if (!['pdf', 'csv', 'json'].includes(format)) {
      return res.status(400).json({ error: 'format must be pdf, csv, or json' });
    }

    const result = await statementGenerationService.exportStatement(
      statementId,
      tenantId,
      format,
      {
        companyName: req.query.companyName as string,
        companyAddress: req.query.companyAddress as string,
        companyEmail: req.query.companyEmail as string,
        companyLogo: req.query.companyLogo as string
      }
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/statements/:id/send - Send statement to recipient
 */
app.post('/api/v1/statements/:id/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const statementId = asStatementId(req.params.id);
    const { recipientEmail } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({ error: 'recipientEmail is required' });
    }

    await statementGenerationService.deliverStatement({
      statementId,
      tenantId,
      recipientEmail,
      method: 'EMAIL'
    });

    res.json({ success: true, message: 'Statement sent successfully' });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Disbursement Routes
// =============================================================================

/**
 * POST /api/v1/disbursements - Create a disbursement
 */
app.post('/api/v1/disbursements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = CreateDisbursementSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors
      });
    }

    const data = validation.data;
    const request: DisbursementRequest = {
      tenantId: asTenantId(data.tenantId),
      ownerId: asOwnerId(data.ownerId),
      amount: data.amount ? Money.fromMinorUnits(data.amount.amount, data.amount.currency as CurrencyCode) : undefined,
      destination: data.destination,
      description: data.description,
      idempotencyKey: data.idempotencyKey
    };

    const result = await disbursementService.processDisbursement(request);

    res.status(201).json({
      disbursementId: result.disbursementId,
      ownerId: result.ownerId,
      amount: result.amount.toData(),
      status: result.status,
      transferId: result.transferId,
      estimatedArrival: result.estimatedArrival,
      failureReason: result.failureReason
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/disbursements/:id - Get disbursement status
 * Note: In a full implementation, disbursements would be persisted to a database
 */
app.get('/api/v1/disbursements/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const disbursementId = req.params.id;

    const disbursement = await disbursementService.getDisbursement(disbursementId, tenantId);

    if (!disbursement) {
      return res.status(404).json({ error: 'Disbursement not found' });
    }

    res.json({
      id: disbursement.id,
      tenantId: disbursement.tenantId,
      ownerId: disbursement.ownerId,
      amount: {
        amount: disbursement.amountMinorUnits,
        currency: disbursement.currency
      },
      status: disbursement.status,
      destination: disbursement.destination,
      provider: disbursement.provider,
      transferId: disbursement.transferId,
      description: disbursement.description,
      initiatedAt: disbursement.initiatedAt,
      completedAt: disbursement.completedAt,
      failedAt: disbursement.failedAt,
      estimatedArrival: disbursement.estimatedArrival,
      failureReason: disbursement.failureReason,
      createdAt: disbursement.createdAt
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/owners/:id/disbursement-info - Get owner disbursement info
 */
app.get('/api/v1/owners/:id/disbursement-info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const ownerId = asOwnerId(req.params.id);

    const info = await disbursementService.getOwnerDisbursementInfo(tenantId, ownerId);

    res.json({
      ownerId: info.ownerId,
      availableBalance: info.availableBalance.toData(),
      pendingDisbursements: info.pendingDisbursements.toData(),
      lastDisbursementDate: info.lastDisbursementDate,
      nextScheduledDate: info.nextScheduledDate
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Reconciliation Routes
// =============================================================================

/**
 * POST /api/v1/reconciliation/verify-balances - Verify all ledger balances
 */
app.post('/api/v1/reconciliation/verify-balances', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);

    const result = await reconciliationService.verifyLedgerBalances(tenantId);

    res.json({
      accountsChecked: result.accountsChecked,
      valid: result.valid,
      invalid: result.invalid,
      discrepancies: result.discrepancies.map(d => ({
        accountId: d.accountId,
        storedBalance: d.storedBalance.toData(),
        calculatedBalance: d.calculatedBalance.toData(),
        discrepancy: d.discrepancy.toData()
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/reconciliation/provider - Reconcile with payment provider
 */
app.post('/api/v1/reconciliation/provider', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { providerName, olderThanMinutes } = req.body;

    if (!providerName) {
      return res.status(400).json({ error: 'providerName is required' });
    }

    const result = await reconciliationService.reconcileWithProvider(
      tenantId,
      providerName,
      olderThanMinutes || 30
    );

    res.json({
      checked: result.checked,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Webhook Routes
// =============================================================================

/**
 * POST /webhooks/stripe - Handle Stripe webhook events
 */
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!stripeProvider) {
      return res.status(503).json({ error: 'Stripe provider not configured' });
    }

    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    
    // Verify and parse the webhook
    let event;
    try {
      event = stripeProvider.parseWebhookEvent(req.body, signature, webhookSecret);
    } catch (err) {
      logger.warn({ err }, 'Stripe webhook signature verification failed');
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    logger.info({ eventType: event.type, eventId: event.id }, 'Stripe webhook received');

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data as { id: string; receipt_url?: string };
        await paymentOrchestrationService.handleWebhook(
          'stripe',
          paymentIntent.id,
          'SUCCEEDED',
          paymentIntent.receipt_url
        );
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data as { id: string; last_payment_error?: { message?: string } };
        await paymentOrchestrationService.handleWebhook(
          'stripe',
          paymentIntent.id,
          'FAILED',
          undefined,
          paymentIntent.last_payment_error?.message || 'Payment failed'
        );
        break;
      }
      case 'payment_intent.canceled': {
        const paymentIntent = event.data as { id: string; cancellation_reason?: string };
        await paymentOrchestrationService.handleWebhook(
          'stripe',
          paymentIntent.id,
          'CANCELLED',
          undefined,
          paymentIntent.cancellation_reason || 'Payment cancelled'
        );
        break;
      }
      default:
        logger.info({ eventType: event.type }, 'Unhandled Stripe event type');
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /webhooks/mpesa/stk - Handle M-PESA STK Push callback
 */
app.post('/webhooks/mpesa/stk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = MpesaStkCallbackSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn({ body: req.body }, 'Invalid M-PESA callback payload');
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const callback = validation.data.Body.stkCallback;
    logger.info({
      checkoutRequestId: callback.CheckoutRequestID,
      resultCode: callback.ResultCode,
      resultDesc: callback.ResultDesc
    }, 'M-PESA STK callback received');

    // ResultCode 0 means success
    const isSuccess = callback.ResultCode === 0;

    if (isSuccess) {
      // Extract metadata from callback
      const metadata = callback.CallbackMetadata?.Item || [];
      const amount = metadata.find(i => i.Name === 'Amount')?.Value;
      const mpesaReceiptNumber = metadata.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = metadata.find(i => i.Name === 'TransactionDate')?.Value;
      const phoneNumber = metadata.find(i => i.Name === 'PhoneNumber')?.Value;

      logger.info({
        checkoutRequestId: callback.CheckoutRequestID,
        amount,
        mpesaReceiptNumber,
        transactionDate,
        phoneNumber
      }, 'M-PESA payment successful');

      // Update payment status via orchestration service
      await paymentOrchestrationService.handleWebhook(
        'mpesa',
        callback.CheckoutRequestID,
        'SUCCEEDED',
        mpesaReceiptNumber?.toString()
      );
    } else {
      // Payment failed or was cancelled
      const status: PaymentStatus = callback.ResultCode === 1032 ? 'CANCELLED' : 'FAILED';
      await paymentOrchestrationService.handleWebhook(
        'mpesa',
        callback.CheckoutRequestID,
        status,
        undefined,
        callback.ResultDesc
      );
    }

    // M-PESA expects this specific response format
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    logger.error({ err: error }, 'Error processing M-PESA callback');
    // Still return success to M-PESA to prevent retries
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

/**
 * POST /webhooks/mpesa/b2c/result - Handle M-PESA B2C (disbursement) result
 */
app.post('/webhooks/mpesa/b2c/result', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ body: req.body }, 'M-PESA B2C result received');

    const result = req.body?.Result;
    if (!result) {
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const isSuccess = result.ResultCode === 0;
    const conversationId = result.ConversationID;
    const transactionId = result.TransactionID;

    logger.info({
      conversationId,
      transactionId,
      resultCode: result.ResultCode,
      resultDesc: result.ResultDesc
    }, `M-PESA B2C ${isSuccess ? 'succeeded' : 'failed'}`);

    // In a full implementation, update the disbursement status in the database
    // and publish appropriate events

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    logger.error({ err: error }, 'Error processing M-PESA B2C result');
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

/**
 * POST /webhooks/mpesa/b2c/timeout - Handle M-PESA B2C timeout
 */
app.post('/webhooks/mpesa/b2c/timeout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.warn({ body: req.body }, 'M-PESA B2C timeout received');

    // In a full implementation, mark the disbursement as needing reconciliation

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    logger.error({ err: error }, 'Error processing M-PESA B2C timeout');
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// =============================================================================
// Job Management Routes (Admin)
// =============================================================================

/**
 * POST /api/v1/admin/jobs/reconciliation - Trigger reconciliation job
 */
app.post('/api/v1/admin/jobs/reconciliation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { providerName } = req.body;

    if (!providerName) {
      return res.status(400).json({ error: 'providerName is required' });
    }

    const result = await reconciliationJob.runProviderReconciliation(tenantId, providerName);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/jobs/statements - Trigger statement generation job
 */
app.post('/api/v1/admin/jobs/statements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { year, month } = req.body;

    if (!year || !month) {
      return res.status(400).json({ error: 'year and month are required' });
    }

    const [ownerResult, customerResult] = await Promise.all([
      statementJob.generateOwnerMonthlyStatements(tenantId, year, month),
      statementJob.generateCustomerMonthlyStatements(tenantId, year, month)
    ]);

    res.json({
      ownerStatements: ownerResult,
      customerStatements: customerResult
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/jobs/disbursements - Trigger disbursement job
 */
app.post('/api/v1/admin/jobs/disbursements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { ownerDestinations } = req.body;

    if (!ownerDestinations || typeof ownerDestinations !== 'object') {
      return res.status(400).json({ error: 'ownerDestinations map is required' });
    }

    const destinationsMap = new Map<OwnerId, string>();
    for (const [ownerId, destination] of Object.entries(ownerDestinations)) {
      destinationsMap.set(asOwnerId(ownerId), destination as string);
    }

    const result = await disbursementJob.runScheduledDisbursements(tenantId, destinationsMap);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Additional API Routes (aliases and convenience endpoints)
// =============================================================================

/**
 * POST /api/v1/payments/webhook/mpesa - M-Pesa webhook (API-path alias)
 * Convenience endpoint that forwards to the M-PESA STK callback handler
 */
app.post('/api/v1/payments/webhook/mpesa', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = MpesaStkCallbackSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn({ body: req.body }, 'Invalid M-PESA callback payload via API path');
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const callback = validation.data.Body.stkCallback;
    logger.info({
      checkoutRequestId: callback.CheckoutRequestID,
      resultCode: callback.ResultCode,
      resultDesc: callback.ResultDesc
    }, 'M-PESA STK callback received via API path');

    const isSuccess = callback.ResultCode === 0;

    if (isSuccess) {
      const metadata = callback.CallbackMetadata?.Item || [];
      const mpesaReceiptNumber = metadata.find(i => i.Name === 'MpesaReceiptNumber')?.Value;

      await paymentOrchestrationService.handleWebhook(
        'mpesa',
        callback.CheckoutRequestID,
        'SUCCEEDED',
        mpesaReceiptNumber?.toString()
      );
    } else {
      const status: PaymentStatus = callback.ResultCode === 1032 ? 'CANCELLED' : 'FAILED';
      await paymentOrchestrationService.handleWebhook(
        'mpesa',
        callback.CheckoutRequestID,
        status,
        undefined,
        callback.ResultDesc
      );
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    logger.error({ err: error }, 'Error processing M-PESA callback via API path');
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

/**
 * GET /api/v1/statements/:tenantId - Get statements for a tenant
 * Note: tenantId in path (alternative to X-Tenant-Id header)
 * Supports query params: ownerId, customerId, type, page, pageSize
 */
app.get('/api/v1/statements/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = asTenantId(req.params.tenantId);
    const ownerId = req.query.ownerId as string | undefined;
    const customerId = req.query.customerId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    if (ownerId) {
      const result = await statementGenerationService.getOwnerStatements(
        tenantId,
        asOwnerId(ownerId),
        page,
        pageSize
      );
      return res.json({
        statements: result.statements.map(s => ({
          id: s.id,
          type: s.type,
          status: s.status,
          periodType: s.periodType,
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
          openingBalance: s.openingBalance.toData(),
          closingBalance: s.closingBalance.toData(),
          generatedAt: s.generatedAt,
          sentAt: s.sentAt
        })),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore
      });
    }

    if (customerId) {
      const result = await statementGenerationService.getCustomerStatements(
        tenantId,
        asCustomerId(customerId),
        page,
        pageSize
      );
      return res.json({
        statements: result.statements.map(s => ({
          id: s.id,
          type: s.type,
          status: s.status,
          periodType: s.periodType,
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
          openingBalance: s.openingBalance.toData(),
          closingBalance: s.closingBalance.toData(),
          generatedAt: s.generatedAt,
          sentAt: s.sentAt
        })),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore
      });
    }

    return res.status(400).json({ error: 'Either ownerId or customerId query parameter is required' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/statements/generate - Generate a statement (alias)
 */
app.post('/api/v1/statements/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = GenerateStatementSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors
      });
    }

    const data = validation.data;
    const request: GenerateStatementRequest = {
      tenantId: asTenantId(data.tenantId),
      type: data.type,
      periodType: data.periodType,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      accountId: asAccountId(data.accountId),
      ownerId: data.ownerId ? asOwnerId(data.ownerId) : undefined,
      customerId: data.customerId ? asCustomerId(data.customerId) : undefined,
      includeDetails: data.includeDetails
    };

    const statement = await statementGenerationService.generateStatement(request);

    res.status(201).json({
      id: statement.id,
      type: statement.type,
      status: statement.status,
      periodType: statement.periodType,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      openingBalance: statement.openingBalance.toData(),
      closingBalance: statement.closingBalance.toData(),
      totalDebits: statement.totalDebits.toData(),
      totalCredits: statement.totalCredits.toData(),
      netChange: statement.netChange.toData(),
      lineItemCount: statement.lineItems.length,
      generatedAt: statement.generatedAt
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/disbursements - List disbursements
 * Supports query params: ownerId, status, fromDate, toDate, page, pageSize
 */
app.get('/api/v1/disbursements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const ownerId = req.query.ownerId as string | undefined;
    const status = req.query.status as string | undefined;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined;
    const toDate = req.query.toDate ? new Date(req.query.toDate as string) : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await disbursementService.listDisbursements(
      tenantId,
      {
        ownerId: ownerId ? asOwnerId(ownerId) : undefined,
        status: status as any,
        fromDate,
        toDate
      },
      page,
      pageSize
    );

    res.json({
      disbursements: result.items.map(d => ({
        id: d.id,
        ownerId: d.ownerId,
        amount: {
          amount: d.amountMinorUnits,
          currency: d.currency
        },
        status: d.status,
        destination: d.destination,
        provider: d.provider,
        transferId: d.transferId,
        description: d.description,
        initiatedAt: d.initiatedAt,
        completedAt: d.completedAt,
        failedAt: d.failedAt,
        estimatedArrival: d.estimatedArrival,
        failureReason: d.failureReason,
        createdAt: d.createdAt
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/reconciliation/run - Run full reconciliation
 * Runs both ledger verification and provider reconciliation
 */
app.post('/api/v1/reconciliation/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { providerName, olderThanMinutes } = req.body;

    // Step 1: Verify ledger balances
    const ledgerResult = await reconciliationService.verifyLedgerBalances(tenantId);

    // Step 2: Reconcile with provider (if specified)
    let providerResult = null;
    if (providerName) {
      providerResult = await reconciliationService.reconcileWithProvider(
        tenantId,
        providerName,
        olderThanMinutes || 30
      );
    }

    res.json({
      ledgerVerification: {
        accountsChecked: ledgerResult.accountsChecked,
        valid: ledgerResult.valid,
        invalid: ledgerResult.invalid,
        discrepancies: ledgerResult.discrepancies.map(d => ({
          accountId: d.accountId,
          storedBalance: d.storedBalance.toData(),
          calculatedBalance: d.calculatedBalance.toData(),
          discrepancy: d.discrepancy.toData()
        }))
      },
      providerReconciliation: providerResult ? {
        providerName,
        checked: providerResult.checked,
        updated: providerResult.updated,
        failed: providerResult.failed,
        errors: providerResult.errors
      } : null,
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Error Handling Middleware
// =============================================================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  
  // Handle specific error types
  if (err.message.includes('not found')) {
    return res.status(404).json({
      error: 'Not found',
      message: err.message
    });
  }
  
  if (err.message.includes('not balanced') || err.message.includes('Currency mismatch')) {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV !== 'production' ? err.message : undefined
  });
});

// =============================================================================
// Start Server
// =============================================================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Payments & Ledger service started');
});

// =============================================================================
// Graceful Shutdown
// =============================================================================

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export { app };
