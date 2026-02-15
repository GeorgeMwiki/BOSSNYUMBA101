/**
 * Zod schemas for API request validation
 */

import type { Context } from 'hono';
import type { ZodError } from 'zod';
import { z } from 'zod';

/** Shared validation error response helper for consistent API error format */
export function validationErrorResponse(
  result: { success: false; error: ZodError },
  c: Context,
  message = 'Invalid request'
) {
  return c.json(
    {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
        details: result.error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    },
    400
  );
}

// Common pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

// Common path param validation for resource IDs
export const idParamSchema = z.object({
  id: z.string().min(1, 'Resource ID is required').max(100),
});

// Customer schemas
export const customerListQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
});

const baseCustomerSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'COMPANY']),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  idNumber: z.string().optional(),
  idType: z.enum(['NATIONAL_ID', 'PASSPORT', 'DRIVERS_LICENSE']).optional(),
  companyName: z.string().optional(),
  companyRegNumber: z.string().optional(),
  preferences: z.record(z.unknown()).optional(),
});

export const createCustomerSchema = baseCustomerSchema.refine(
  (data) => data.type !== 'COMPANY' || (data.companyName && data.companyRegNumber),
  { message: 'Company name and registration number required for COMPANY type', path: ['companyName'] }
);

export const updateCustomerSchema = baseCustomerSchema.partial();

export const kycStatusSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  reason: z.string().optional(),
});

export const blacklistSchema = z.object({
  reason: z.string().min(1, 'Blacklist reason is required').max(500),
});

// Lease schemas
export const leaseListQuerySchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']).optional(),
  propertyId: z.string().optional(),
  customerId: z.string().optional(),
});

const dateSchema = z.union([z.string(), z.coerce.date()]).transform((v) => new Date(v));

export const createLeaseSchema = z.object({
  unitId: z.string().min(1, 'Unit ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  startDate: dateSchema,
  endDate: dateSchema,
  rentAmount: z.number().positive('Rent amount must be positive'),
  depositAmount: z.number().min(0, 'Deposit cannot be negative'),
  paymentDueDay: z.number().int().min(1).max(28).default(5),
  terms: z.object({
    gracePeriodDays: z.number().int().min(0).optional(),
    noticePeriodDays: z.number().int().min(0).optional(),
    allowPets: z.boolean().optional(),
    allowSubletting: z.boolean().optional(),
    utilitiesIncluded: z.array(z.string()).optional(),
  }).optional(),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  { message: 'End date must be after start date', path: ['endDate'] }
);

export const updateLeaseSchema = z.object({
  startDate: z.union([z.string(), z.coerce.date()]).optional(),
  endDate: z.union([z.string(), z.coerce.date()]).optional(),
  rentAmount: z.number().positive().optional(),
  depositAmount: z.number().min(0).optional(),
  paymentDueDay: z.number().int().min(1).max(28).optional(),
  terms: z.record(z.unknown()).optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) > new Date(data.startDate);
    }
    return true;
  },
  { message: 'End date must be after start date', path: ['endDate'] }
);

export const expiringLeasesQuerySchema = paginationSchema.extend({
  days: z.coerce.number().int().min(1).max(365).default(60),
});

// Lease action schemas
export const renewLeaseSchema = z.object({
  extendMonths: z.number().int().min(1).max(60).optional(),
  newRentAmount: z.number().positive().optional(),
  newEndDate: z.union([z.string(), z.coerce.date()]).optional(),
}).refine(
  (data) => {
    if (data.extendMonths && data.newEndDate) return false;
    return true;
  },
  { message: 'Provide either extendMonths or newEndDate, not both', path: ['extendMonths'] }
);

export const terminateLeaseSchema = z.object({
  reason: z.string().min(1, 'Termination reason is required').max(500).optional(),
  endDate: z.union([z.string(), z.coerce.date()]).optional(),
});

// ============ Invoices schemas ============
export const invoiceStatusSchema = z.enum([
  'DRAFT',
  'SENT',
  'PENDING',
  'PAID',
  'PARTIALLY_PAID',
  'OVERDUE',
  'CANCELLED',
]);

/** ISO date string for date range filters */
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/, 'Invalid date format (use ISO 8601)')
  .optional();

export const listInvoicesQuerySchema = paginationSchema.extend({
  status: invoiceStatusSchema.optional(),
  customerId: z.string().optional(),
  leaseId: z.string().optional(),
  dateFrom: isoDateSchema,
  dateTo: isoDateSchema,
}).refine(
  (data) => {
    if (data.dateFrom && data.dateTo) {
      return new Date(data.dateFrom) <= new Date(data.dateTo);
    }
    return true;
  },
  { message: 'dateFrom must be before or equal to dateTo', path: ['dateTo'] }
);

export const invoiceLineItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  total: z.number().min(0),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  leaseId: z.string().optional(),
  type: z.string().min(1).default('RENT'),
  periodStart: z.string(),
  periodEnd: z.string(),
  dueDate: z.string(),
  subtotal: z.number().min(0),
  tax: z.number().min(0).default(0),
  currency: z.string().length(3).default('TZS'),
  lineItems: z.array(invoiceLineItemSchema).min(1),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const sendInvoiceSchema = z.preprocess(
  (data) => data ?? {},
  z.object({
    channel: z.enum(['email', 'sms', 'whatsapp']).default('email'),
    customMessage: z.string().max(1000).optional(),
  })
);

// ============ Payments schemas ============
export const paymentStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
]);

export const paymentMethodSchema = z.enum([
  'MPESA',
  'BANK_TRANSFER',
  'CARD',
  'CASH',
]);

export const listPaymentsQuerySchema = paginationSchema.extend({
  status: paymentStatusSchema.optional(),
  method: paymentMethodSchema.optional(),
  customerId: z.string().optional(),
});

export const reconciliationQuerySchema = paginationSchema.extend({
  reconciled: z.coerce.boolean().optional(), // false = unreconciled only
});

export const createManualPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  customerId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).default('TZS'),
  method: paymentMethodSchema,
  reference: z.string().min(1).optional(),
});

// Kenya: +254 7xx..., Tanzania: +255 7xx/6xx...; supports 0 prefix for local format
export const mpesaPhoneSchema = z.string().regex(
  /^(\+?254[17]\d{8}|0[17]\d{8}|\+?255[67]\d{7}|0[67]\d{7})$/,
  'Invalid M-Pesa phone (Kenya +254/TZ +255 format)'
);

export const initiateMpesaPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  customerId: z.string().min(1),
  amount: z.number().positive(),
  phoneNumber: mpesaPhoneSchema,
  description: z.string().max(255).optional(),
});

export const refundPaymentSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
});

// M-Pesa callback (Daraja API format)
export const mpesaCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number(),
      ResultDesc: z.string(),
      CallbackMetadata: z
        .object({
          Item: z.array(
            z.object({
              Name: z.string(),
              Value: z.union([z.number(), z.string()]),
            })
          ),
        })
        .optional(),
    }),
  }),
});
