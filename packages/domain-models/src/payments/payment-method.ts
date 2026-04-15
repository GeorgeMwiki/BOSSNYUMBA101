/**
 * Payment Method domain model
 * Represents a saved payment method for a customer.
 *
 * Supported methods:
 *  - M-Pesa (Safaricom, Kenya)
 *  - Airtel Money (Airtel, Kenya/Tanzania/Uganda)
 *  - Tigo Pesa (Mixx by Yas, Tanzania)
 *  - Card (Visa, Mastercard, Amex)
 *  - Bank Account (ACH/RTGS/EFT)
 *  - Cash (manually recorded)
 */

import { z } from 'zod';
import type { Brand, TenantId, UserId, EntityMetadata, SoftDeletable } from '../common/types';
import type { CustomerId, PaymentChannel } from './payment-intent';

export type PaymentMethodId = Brand<string, 'PaymentMethodId'>;

export function asPaymentMethodId(id: string): PaymentMethodId {
  return id as PaymentMethodId;
}

// ---------------------------------------------------------------------------
// Enums & zod schemas
// ---------------------------------------------------------------------------

export const PaymentMethodTypeSchema = z.enum([
  'mpesa',
  'airtel_money',
  'tigo_pesa',
  'card',
  'bank_account',
  'cash',
]);

/** Payment method type */
export type PaymentMethodType = z.infer<typeof PaymentMethodTypeSchema>;

export const PaymentMethodStatusSchema = z.enum(['active', 'expired', 'disabled', 'unverified']);
export type PaymentMethodStatus = z.infer<typeof PaymentMethodStatusSchema>;

export const CardBrandSchema = z.enum(['visa', 'mastercard', 'amex', 'discover', 'unknown']);
export type CardBrand = z.infer<typeof CardBrandSchema>;

export const BankAccountKindSchema = z.enum(['checking', 'savings', 'current']);
export type BankAccountKind = z.infer<typeof BankAccountKindSchema>;

// ---------------------------------------------------------------------------
// Per-type detail schemas
// ---------------------------------------------------------------------------

/** Canonical E.164 regex for East African mobile operators we support. */
const EAST_AFRICAN_MOBILE_REGEX = /^\+(?:254|255|256)[17]\d{8}$/;
const MASKED_PHONE_REGEX = /^\+?\d{1,4}\*{2,}\d{2,4}$/;

const PhoneMaskedSchema = z
  .string()
  .min(6)
  .regex(MASKED_PHONE_REGEX, 'Phone number must be masked before persistence');

export const MpesaDetailsSchema = z.object({
  type: z.literal('mpesa'),
  phoneNumber: PhoneMaskedSchema,
});
export interface MpesaDetails extends z.infer<typeof MpesaDetailsSchema> {}

export const AirtelMoneyDetailsSchema = z.object({
  type: z.literal('airtel_money'),
  phoneNumber: PhoneMaskedSchema,
  country: z.enum(['KE', 'TZ', 'UG']),
});
export interface AirtelMoneyDetails extends z.infer<typeof AirtelMoneyDetailsSchema> {}

export const TigoPesaDetailsSchema = z.object({
  type: z.literal('tigo_pesa'),
  phoneNumber: PhoneMaskedSchema,
});
export interface TigoPesaDetails extends z.infer<typeof TigoPesaDetailsSchema> {}

export const CardDetailsSchema = z.object({
  type: z.literal('card'),
  brand: CardBrandSchema,
  last4: z.string().regex(/^\d{4}$/),
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z.number().int().min(2000).max(2100),
  fingerprint: z.string().min(8),
  cardholderName: z.string().min(1).max(120).optional(),
});
export interface CardDetails extends z.infer<typeof CardDetailsSchema> {}

export const BankAccountDetailsSchema = z.object({
  type: z.literal('bank_account'),
  bankName: z.string().min(1).max(120),
  bankCode: z.string().max(20).optional(),
  accountLast4: z.string().regex(/^\d{2,6}$/),
  accountType: BankAccountKindSchema,
  accountHolderName: z.string().min(1).max(120).optional(),
});
export interface BankAccountDetails extends z.infer<typeof BankAccountDetailsSchema> {}

export const CashDetailsSchema = z.object({
  type: z.literal('cash'),
  receivedBy: z.string().min(1).max(120).optional(),
  location: z.string().min(1).max(120).optional(),
});
export interface CashDetails extends z.infer<typeof CashDetailsSchema> {}

/** Discriminated union of all payment method details. */
export const PaymentMethodDetailsSchema = z.discriminatedUnion('type', [
  MpesaDetailsSchema,
  AirtelMoneyDetailsSchema,
  TigoPesaDetailsSchema,
  CardDetailsSchema,
  BankAccountDetailsSchema,
  CashDetailsSchema,
]);

export type PaymentMethodDetails = z.infer<typeof PaymentMethodDetailsSchema>;

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

/**
 * Payment Method entity
 */
export interface PaymentMethod extends EntityMetadata, SoftDeletable {
  readonly id: PaymentMethodId;
  readonly tenantId: TenantId;
  readonly customerId: CustomerId;
  readonly type: PaymentMethodType;
  readonly status: PaymentMethodStatus;
  readonly isDefault: boolean;
  readonly displayName: string;
  readonly details: PaymentMethodDetails;
  readonly lastUsedAt: string | null;
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

interface BaseCreateOptions {
  tenantId: TenantId;
  customerId: CustomerId;
  isDefault?: boolean;
}

function now(): string {
  return new Date().toISOString();
}

function baseEntity(
  id: PaymentMethodId,
  base: BaseCreateOptions,
  type: PaymentMethodType,
  status: PaymentMethodStatus,
  displayName: string,
  details: PaymentMethodDetails,
  createdBy: UserId
): PaymentMethod {
  const ts = now();
  return {
    id,
    tenantId: base.tenantId,
    customerId: base.customerId,
    type,
    status,
    isDefault: base.isDefault ?? false,
    displayName,
    details,
    lastUsedAt: null,
    createdAt: ts,
    updatedAt: ts,
    createdBy,
    updatedBy: createdBy,
    deletedAt: null,
    deletedBy: null,
  };
}

/** Mask a raw phone number in E.164 format: +254712345678 -> +254****5678. */
export function maskPhoneNumber(phone: string): string {
  const cleaned = phone.startsWith('+') ? phone : `+${phone}`;
  if (cleaned.length < 8) return cleaned;
  const prefix = cleaned.slice(0, 4);
  const suffix = cleaned.slice(-4);
  return `${prefix}****${suffix}`;
}

function assertRawPhone(phone: string): void {
  if (!EAST_AFRICAN_MOBILE_REGEX.test(phone)) {
    throw new Error(
      `Phone number "${phone}" is not a valid East African mobile number (+254/+255/+256, 10 national digits).`
    );
  }
}

/** Create a new M-Pesa payment method */
export function createMpesaMethod(
  id: PaymentMethodId,
  data: BaseCreateOptions & { phoneNumber: string },
  createdBy: UserId
): PaymentMethod {
  assertRawPhone(data.phoneNumber);
  const masked = maskPhoneNumber(data.phoneNumber);
  const details = MpesaDetailsSchema.parse({ type: 'mpesa', phoneNumber: masked });
  return baseEntity(id, data, 'mpesa', 'active', `M-Pesa ${masked}`, details, createdBy);
}

/** Create a new Airtel Money payment method */
export function createAirtelMoneyMethod(
  id: PaymentMethodId,
  data: BaseCreateOptions & { phoneNumber: string; country: AirtelMoneyDetails['country'] },
  createdBy: UserId
): PaymentMethod {
  assertRawPhone(data.phoneNumber);
  const masked = maskPhoneNumber(data.phoneNumber);
  const details = AirtelMoneyDetailsSchema.parse({
    type: 'airtel_money',
    phoneNumber: masked,
    country: data.country,
  });
  return baseEntity(id, data, 'airtel_money', 'active', `Airtel Money ${masked}`, details, createdBy);
}

/** Create a new Tigo Pesa payment method */
export function createTigoPesaMethod(
  id: PaymentMethodId,
  data: BaseCreateOptions & { phoneNumber: string },
  createdBy: UserId
): PaymentMethod {
  assertRawPhone(data.phoneNumber);
  const masked = maskPhoneNumber(data.phoneNumber);
  const details = TigoPesaDetailsSchema.parse({ type: 'tigo_pesa', phoneNumber: masked });
  return baseEntity(id, data, 'tigo_pesa', 'active', `Tigo Pesa ${masked}`, details, createdBy);
}

/** Create a new card payment method */
export function createCardMethod(
  id: PaymentMethodId,
  data: BaseCreateOptions & {
    brand: CardBrand;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
    fingerprint: string;
    cardholderName?: string;
  },
  createdBy: UserId
): PaymentMethod {
  const details = CardDetailsSchema.parse({
    type: 'card',
    brand: data.brand,
    last4: data.last4,
    expiryMonth: data.expiryMonth,
    expiryYear: data.expiryYear,
    fingerprint: data.fingerprint,
    cardholderName: data.cardholderName,
  });
  const displayName = `${data.brand.toUpperCase()} ****${data.last4}`;
  return baseEntity(id, data, 'card', 'active', displayName, details, createdBy);
}

/** Create a new bank account payment method */
export function createBankAccountMethod(
  id: PaymentMethodId,
  data: BaseCreateOptions & {
    bankName: string;
    bankCode?: string;
    accountLast4: string;
    accountType: BankAccountKind;
    accountHolderName?: string;
  },
  createdBy: UserId
): PaymentMethod {
  const details = BankAccountDetailsSchema.parse({
    type: 'bank_account',
    bankName: data.bankName,
    bankCode: data.bankCode,
    accountLast4: data.accountLast4,
    accountType: data.accountType,
    accountHolderName: data.accountHolderName,
  });
  const displayName = `${data.bankName} ****${data.accountLast4}`;
  return baseEntity(id, data, 'bank_account', 'unverified', displayName, details, createdBy);
}

/** Create a new cash record */
export function createCashMethod(
  id: PaymentMethodId,
  data: BaseCreateOptions & { receivedBy?: string; location?: string },
  createdBy: UserId
): PaymentMethod {
  const details = CashDetailsSchema.parse({
    type: 'cash',
    receivedBy: data.receivedBy,
    location: data.location,
  });
  const displayName = data.location ? `Cash (${data.location})` : 'Cash';
  return baseEntity(id, data, 'cash', 'active', displayName, details, createdBy);
}

// ---------------------------------------------------------------------------
// Invariants and helpers
// ---------------------------------------------------------------------------

/** Check if card is expired */
export function isCardExpired(method: PaymentMethod, asOf: Date = new Date()): boolean {
  if (method.details.type !== 'card') return false;
  // A card is valid through the last day of its expiration month.
  const lastMonthMoment = new Date(
    method.details.expiryYear,
    method.details.expiryMonth, // first day of the following month
    1
  );
  return lastMonthMoment <= asOf;
}

/** Get channel for payment method */
export function getPaymentChannel(method: PaymentMethod): PaymentChannel {
  switch (method.type) {
    case 'mpesa':
    case 'airtel_money':
    case 'tigo_pesa':
      return 'mpesa'; // All treated as "mobile money" in payment-intent channel taxonomy.
    case 'card':
      return 'card';
    case 'bank_account':
    case 'cash':
      return 'bank_transfer';
  }
}

/** True when a method may be used to initiate a new debit. */
export function isChargeable(method: PaymentMethod, asOf: Date = new Date()): boolean {
  if (method.deletedAt) return false;
  if (method.status !== 'active') return false;
  if (method.type === 'card' && isCardExpired(method, asOf)) return false;
  return true;
}

/** Zod schema for the full PaymentMethod entity (used by service boundaries). */
export const PaymentMethodSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  customerId: z.string(),
  type: PaymentMethodTypeSchema,
  status: PaymentMethodStatusSchema,
  isDefault: z.boolean(),
  displayName: z.string().min(1),
  details: PaymentMethodDetailsSchema,
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
  deletedAt: z.string().nullable(),
  deletedBy: z.string().nullable(),
});
