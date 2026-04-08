import { z } from 'zod';

/**
 * Zod schemas for Tanzania Revenue Authority (TRA) VAT submission.
 *
 * Sandbox base URL is configured via env `TRA_API_URL`.
 * Credentials: `TRA_USERNAME`, `TRA_PASSWORD`, `TRA_TIN`.
 *
 * NOTE: TRA's real VFD/EFDMS payloads are XML-first; this module models the
 * JSON-wrapped shape returned by the TRA partner gateway we integrate with.
 */

export const TraAuthRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  tin: z.string().regex(/^\d{9}$/, 'TRA TIN must be 9 digits'),
});
export type TraAuthRequest = z.infer<typeof TraAuthRequestSchema>;

export const TraAuthResponseSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.string().datetime(),
});
export type TraAuthResponse = z.infer<typeof TraAuthResponseSchema>;

export const TraVatLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  vatRate: z.number().min(0).max(1), // e.g. 0.18
  netAmount: z.number().nonnegative(),
  vatAmount: z.number().nonnegative(),
  grossAmount: z.number().nonnegative(),
});
export type TraVatLineItem = z.infer<typeof TraVatLineItemSchema>;

export const TraVatSubmissionSchema = z.object({
  tin: z.string().regex(/^\d{9}$/),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().datetime(),
  customerName: z.string().min(1),
  customerTin: z.string().regex(/^\d{9}$/).optional(),
  currency: z.string().length(3).default('TZS'),
  lineItems: z.array(TraVatLineItemSchema).min(1),
  totalNet: z.number().nonnegative(),
  totalVat: z.number().nonnegative(),
  totalGross: z.number().nonnegative(),
});
export type TraVatSubmission = z.infer<typeof TraVatSubmissionSchema>;

export const TraSubmissionResponseSchema = z.object({
  receiptNumber: z.string().min(1),
  status: z.enum(['ACCEPTED', 'PENDING', 'REJECTED']),
  submittedAt: z.string().datetime(),
  verificationUrl: z.string().url().optional(),
  message: z.string().optional(),
});
export type TraSubmissionResponse = z.infer<typeof TraSubmissionResponseSchema>;

export const TraStatusQuerySchema = z.object({
  receiptNumber: z.string().min(1),
});
export type TraStatusQuery = z.infer<typeof TraStatusQuerySchema>;

export const TraStatusResponseSchema = z.object({
  receiptNumber: z.string().min(1),
  status: z.enum(['ACCEPTED', 'PENDING', 'REJECTED']),
  updatedAt: z.string().datetime(),
  message: z.string().optional(),
});
export type TraStatusResponse = z.infer<typeof TraStatusResponseSchema>;
