/**
 * Normalized LPMS export shape.
 *
 * WHY: LPMS vendors ship wildly different schemas — CSV column names differ
 * per product, JSON nesting varies, XML tag case is inconsistent. Rather
 * than teaching MigrationWriterService every dialect, each adapter
 * (CSV/JSON/XML) MUST produce this single normalized shape. The shape
 * mirrors `ExtractedBundle` in
 * `packages/database/src/services/migration-writer.service.ts` so the
 * writer can consume adapter output with zero mapping.
 *
 * We additionally expose `payments` because LPMS exports frequently
 * contain payment history even though the current writer does not yet
 * persist them. Carrying them through keeps the interface forward-
 * compatible without forcing a schema change later.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schemas — runtime validation at the adapter boundary.
//
// WHY: Immutable validation contract. Every adapter runs its raw parse
// output through these schemas before returning, so callers never see a
// half-parsed object. Optional fields are `.optional()` rather than
// defaulted — the writer chooses how to fill blanks using tenant context.
// ---------------------------------------------------------------------------

export const PropertyRecordSchema = z.object({
  tenantId: z.string().min(1),
  externalId: z.string().optional(),
  name: z.string().min(1),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  unitCount: z.number().int().nonnegative().optional(),
  propertyType: z.string().optional(),
});

export const UnitRecordSchema = z.object({
  tenantId: z.string().min(1),
  externalId: z.string().optional(),
  propertyName: z.string().min(1),
  label: z.string().min(1),
  bedrooms: z.number().int().nonnegative().optional(),
  rentKes: z.number().nonnegative().optional(),
  status: z.string().optional(),
});

export const CustomerRecordSchema = z.object({
  tenantId: z.string().min(1),
  externalId: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  unitLabel: z.string().optional(),
  propertyName: z.string().optional(),
});

export const LeaseRecordSchema = z.object({
  tenantId: z.string().min(1),
  externalId: z.string().optional(),
  customerName: z.string().min(1),
  unitLabel: z.string().min(1),
  propertyName: z.string().min(1),
  leaseStart: z.string().optional(),
  leaseEnd: z.string().optional(),
  rentKes: z.number().nonnegative().optional(),
});

export const PaymentRecordSchema = z.object({
  tenantId: z.string().min(1),
  externalId: z.string().optional(),
  customerName: z.string().min(1),
  amountKes: z.number().nonnegative(),
  paidAt: z.string().optional(),
  method: z.string().optional(),
  reference: z.string().optional(),
});

export const LpmsNormalizedExportSchema = z.object({
  properties: z.array(PropertyRecordSchema),
  units: z.array(UnitRecordSchema),
  customers: z.array(CustomerRecordSchema),
  leases: z.array(LeaseRecordSchema),
  payments: z.array(PaymentRecordSchema),
});

export type PropertyRecord = z.infer<typeof PropertyRecordSchema>;
export type UnitRecord = z.infer<typeof UnitRecordSchema>;
export type CustomerRecord = z.infer<typeof CustomerRecordSchema>;
export type LeaseRecord = z.infer<typeof LeaseRecordSchema>;
export type PaymentRecord = z.infer<typeof PaymentRecordSchema>;
export type LpmsNormalizedExport = z.infer<typeof LpmsNormalizedExportSchema>;

/**
 * Empty export — used as a base when building results with spread syntax.
 * Frozen to enforce the project's immutability rule: callers MUST spread
 * into a new object rather than push into the frozen arrays.
 */
export const EMPTY_EXPORT: LpmsNormalizedExport = Object.freeze({
  properties: Object.freeze([]) as readonly PropertyRecord[] as PropertyRecord[],
  units: Object.freeze([]) as readonly UnitRecord[] as UnitRecord[],
  customers: Object.freeze([]) as readonly CustomerRecord[] as CustomerRecord[],
  leases: Object.freeze([]) as readonly LeaseRecord[] as LeaseRecord[],
  payments: Object.freeze([]) as readonly PaymentRecord[] as PaymentRecord[],
}) as LpmsNormalizedExport;
