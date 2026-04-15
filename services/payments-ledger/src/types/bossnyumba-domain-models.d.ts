// Ambient declaration shim for @bossnyumba/domain-models.
// The upstream package ships dist/*.js without emitted .d.ts files, so we
// provide permissive types here for the symbols consumed by this service.
declare module '@bossnyumba/domain-models' {
  export type TenantId = string;
  export type OwnerId = string;
  export type AccountId = string;
  export type CustomerId = string;
  export type UserId = string;
  export type LeaseId = string;
  export type PropertyId = string;
  export type PaymentIntentId = string;
  export type StatementId = string;
  export type LedgerEntryId = string;

  export type CurrencyCode = 'KES' | 'USD' | 'EUR' | 'GBP' | 'TZS' | 'UGX';
  export interface Money {
    amount: number;
    currency: CurrencyCode;
    readonly amountMajorUnits: number;
    readonly amountMinorUnits: number;
    [k: string]: any;
  }
  export const Money: {
    new (amount: number, currency: CurrencyCode): Money;
    prototype: Money;
    fromMinorUnits(amount: number, currency: CurrencyCode): Money;
    fromMajorUnits(amount: number, currency: CurrencyCode): Money;
    zero(currency: CurrencyCode): Money;
    [k: string]: any;
  };

  export type LedgerEntryType = string;

  export type AccountType = any;
  export type AccountStatus = any;
  export type EntryDirection = 'DEBIT' | 'CREDIT';
  export type PaymentStatus = any;
  export type PaymentIntentType = any;
  export type StatementPeriodType = any;
  export type StatementStatus = any;
  export type StatementType = any;

  export interface Account {
    id: AccountId;
    tenantId: TenantId;
    type: any;
    status: any;
    [k: string]: any;
  }
  export type LedgerEntry = any;
  export type PaymentIntent = any;
  export type Statement = any;
  export type CreateJournalEntryRequest = any;

  export const AccountAggregate: any;
  export type AccountAggregate = any;
  export const PaymentIntentAggregate: any;
  export type PaymentIntentAggregate = any;
  export const StatementAggregate: any;
  export type StatementAggregate = any;
  export const StatementBuilder: any;
  export const JournalTemplates: any;

  export function asAccountId(v: string): AccountId;
  export function asCustomerId(v: string): CustomerId;
  export function asLeaseId(v: string): LeaseId;
  export function asOwnerId(v: string): OwnerId;
  export function asPaymentIntentId(v: string): PaymentIntentId;
  export function asStatementId(v: string): StatementId;
  export function asTenantId(v: string): TenantId;
  export function createJournalId(...args: any[]): string;
  export function validateJournalBalance(...args: any[]): boolean;
}
