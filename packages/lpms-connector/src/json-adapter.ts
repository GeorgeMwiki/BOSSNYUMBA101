/**
 * JSON LPMS adapter.
 *
 * WHY: Modern LPMS products (PropManager Cloud, Rentec Direct exports,
 * etc.) ship JSON dumps. These typically arrive as either:
 *   (a) a single object with top-level arrays: { properties: [...], ... }
 *   (b) an array of mixed-type records tagged with a `type` discriminator
 * This adapter handles both shapes and maps them to the normalized
 * export. Vendor-specific key aliases are looked up via a small
 * `aliasMap` so callers can extend without subclassing.
 */

import {
  LpmsNormalizedExportSchema,
  type CustomerRecord,
  type LeaseRecord,
  type LpmsNormalizedExport,
  type PaymentRecord,
  type PropertyRecord,
  type UnitRecord,
} from './types.js';
import {
  LpmsParseError,
  type LpmsAdapter,
  type LpmsIngestionContext,
  type LpmsIngestionError,
  type LpmsIngestionResult,
} from './adapter.js';

export interface JsonAdapterOptions {
  /** Optional per-field aliases. If omitted, sensible defaults apply. */
  aliasMap?: Partial<JsonAliasMap>;
}

export interface JsonAliasMap {
  property: {
    externalId: readonly string[];
    name: readonly string[];
    addressLine1: readonly string[];
    city: readonly string[];
    unitCount: readonly string[];
    propertyType: readonly string[];
  };
  unit: {
    externalId: readonly string[];
    propertyName: readonly string[];
    label: readonly string[];
    bedrooms: readonly string[];
    rentKes: readonly string[];
    status: readonly string[];
  };
  customer: {
    externalId: readonly string[];
    name: readonly string[];
    phone: readonly string[];
    email: readonly string[];
    unitLabel: readonly string[];
    propertyName: readonly string[];
  };
  lease: {
    externalId: readonly string[];
    customerName: readonly string[];
    unitLabel: readonly string[];
    propertyName: readonly string[];
    leaseStart: readonly string[];
    leaseEnd: readonly string[];
    rentKes: readonly string[];
  };
  payment: {
    externalId: readonly string[];
    customerName: readonly string[];
    amountKes: readonly string[];
    paidAt: readonly string[];
    method: readonly string[];
    reference: readonly string[];
  };
}

const DEFAULT_JSON_ALIASES: JsonAliasMap = Object.freeze({
  property: {
    externalId: ['id', 'externalId', 'property_id', 'propertyId'],
    name: ['name', 'propertyName', 'title'],
    addressLine1: ['addressLine1', 'address', 'street'],
    city: ['city', 'town'],
    unitCount: ['unitCount', 'units', 'numberOfUnits'],
    propertyType: ['propertyType', 'type', 'kind'],
  },
  unit: {
    externalId: ['id', 'externalId', 'unit_id', 'unitId'],
    propertyName: ['propertyName', 'property', 'building'],
    label: ['label', 'unitLabel', 'name', 'number'],
    bedrooms: ['bedrooms', 'beds', 'bedroomCount'],
    rentKes: ['rentKes', 'rent', 'monthlyRent', 'baseRent'],
    status: ['status', 'state'],
  },
  customer: {
    externalId: ['id', 'externalId', 'customer_id', 'customerId'],
    name: ['name', 'fullName', 'displayName'],
    phone: ['phone', 'phoneNumber', 'mobile'],
    email: ['email', 'emailAddress'],
    unitLabel: ['unitLabel', 'unit'],
    propertyName: ['propertyName', 'property'],
  },
  lease: {
    externalId: ['id', 'externalId', 'lease_id', 'leaseId'],
    customerName: ['customerName', 'tenantName', 'customer'],
    unitLabel: ['unitLabel', 'unit'],
    propertyName: ['propertyName', 'property'],
    leaseStart: ['leaseStart', 'startDate', 'start'],
    leaseEnd: ['leaseEnd', 'endDate', 'end'],
    rentKes: ['rentKes', 'rent', 'monthlyRent'],
  },
  payment: {
    externalId: ['id', 'externalId', 'payment_id', 'paymentId'],
    customerName: ['customerName', 'tenantName', 'payer'],
    amountKes: ['amountKes', 'amount', 'total'],
    paidAt: ['paidAt', 'date', 'paymentDate'],
    method: ['method', 'channel', 'paymentMethod'],
    reference: ['reference', 'txnId', 'transactionId', 'ref'],
  },
}) as JsonAliasMap;

// ---------------------------------------------------------------------------
// Helpers — all pure, no mutation of caller objects.
// ---------------------------------------------------------------------------

function pickString(
  rec: Record<string, unknown>,
  keys: readonly string[]
): string | undefined {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

function pickNumber(
  rec: Record<string, unknown>,
  keys: readonly string[]
): number | undefined {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim().length > 0) {
      const n = Number(v.replace(/,/g, '').trim());
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function pickInt(
  rec: Record<string, unknown>,
  keys: readonly string[]
): number | undefined {
  const n = pickNumber(rec, keys);
  return n === undefined ? undefined : Math.trunc(n);
}

function mergeAliases(
  partial: Partial<JsonAliasMap> | undefined
): JsonAliasMap {
  if (!partial) return DEFAULT_JSON_ALIASES;
  return {
    property: { ...DEFAULT_JSON_ALIASES.property, ...(partial.property ?? {}) },
    unit: { ...DEFAULT_JSON_ALIASES.unit, ...(partial.unit ?? {}) },
    customer: { ...DEFAULT_JSON_ALIASES.customer, ...(partial.customer ?? {}) },
    lease: { ...DEFAULT_JSON_ALIASES.lease, ...(partial.lease ?? {}) },
    payment: { ...DEFAULT_JSON_ALIASES.payment, ...(partial.payment ?? {}) },
  };
}

interface RawDumpShape {
  properties?: unknown[];
  units?: unknown[];
  customers?: unknown[];
  tenants?: unknown[];
  leases?: unknown[];
  payments?: unknown[];
}

function normalizeRootShape(raw: unknown): RawDumpShape {
  if (raw === null || typeof raw !== 'object') {
    throw new LpmsParseError('json', 'root must be object or array');
  }
  // Array form: tag each record with a discriminator via a `type` field.
  if (Array.isArray(raw)) {
    const buckets: RawDumpShape = {
      properties: [],
      units: [],
      customers: [],
      leases: [],
      payments: [],
    };
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const t = (item as Record<string, unknown>).type;
      if (t === 'property') buckets.properties!.push(item);
      else if (t === 'unit') buckets.units!.push(item);
      else if (t === 'customer' || t === 'tenant') buckets.customers!.push(item);
      else if (t === 'lease') buckets.leases!.push(item);
      else if (t === 'payment') buckets.payments!.push(item);
    }
    return buckets;
  }
  const obj = raw as Record<string, unknown>;
  const out: RawDumpShape = {};
  if (Array.isArray(obj.properties)) out.properties = obj.properties;
  if (Array.isArray(obj.units)) out.units = obj.units;
  // accept both `customers` and legacy `tenants`
  if (Array.isArray(obj.customers)) out.customers = obj.customers;
  else if (Array.isArray(obj.tenants)) out.customers = obj.tenants;
  if (Array.isArray(obj.leases)) out.leases = obj.leases;
  if (Array.isArray(obj.payments)) out.payments = obj.payments;
  return out;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class LpmsJsonAdapter
  implements LpmsAdapter<string | object, JsonAdapterOptions>
{
  public readonly kind = 'json' as const;

  public parse(
    input: string | object,
    ctx: LpmsIngestionContext,
    options?: JsonAdapterOptions
  ): LpmsIngestionResult {
    if (!ctx || !ctx.tenantId) {
      throw new LpmsParseError('json', 'tenantId is required');
    }

    let raw: unknown;
    if (typeof input === 'string') {
      try {
        raw = JSON.parse(input);
      } catch (e) {
        throw new LpmsParseError(
          'json',
          'invalid JSON input',
          e instanceof Error ? e : undefined
        );
      }
    } else {
      raw = input;
    }

    const shape = normalizeRootShape(raw);
    const aliases = mergeAliases(options?.aliasMap);
    const errors: LpmsIngestionError[] = [];

    const properties = this.mapProperties(shape.properties ?? [], ctx, aliases, errors);
    const units = this.mapUnits(shape.units ?? [], ctx, aliases, errors);
    const customers = this.mapCustomers(shape.customers ?? [], ctx, aliases, errors);
    const leases = this.mapLeases(shape.leases ?? [], ctx, aliases, errors);
    const payments = this.mapPayments(shape.payments ?? [], ctx, aliases, errors);

    const candidate: LpmsNormalizedExport = {
      properties,
      units,
      customers,
      leases,
      payments,
    };

    const validated = LpmsNormalizedExportSchema.safeParse(candidate);
    if (!validated.success) {
      const issueErrors: LpmsIngestionError[] = validated.error.issues.map(
        (issue) => ({
          entity: (issue.path[0] as LpmsIngestionError['entity']) ?? 'property',
          index:
            typeof issue.path[1] === 'number' ? (issue.path[1] as number) : -1,
          reason: `${issue.path.join('.')}: ${issue.message}`,
        })
      );
      const allErrors = [...errors, ...issueErrors];
      if (!ctx.bestEffort) {
        return {
          ok: false,
          data: { properties: [], units: [], customers: [], leases: [], payments: [] },
          errors: allErrors,
          counts: { properties: 0, units: 0, customers: 0, leases: 0, payments: 0 },
        };
      }
      return {
        ok: allErrors.length === 0,
        data: candidate,
        errors: allErrors,
        counts: this.countsOf(candidate),
      };
    }

    return {
      ok: errors.length === 0,
      data: validated.data,
      errors,
      counts: this.countsOf(validated.data),
    };
  }

  private countsOf(e: LpmsNormalizedExport): LpmsIngestionResult['counts'] {
    return {
      properties: e.properties.length,
      units: e.units.length,
      customers: e.customers.length,
      leases: e.leases.length,
      payments: e.payments.length,
    };
  }

  private mapProperties(
    src: readonly unknown[],
    ctx: LpmsIngestionContext,
    aliases: JsonAliasMap,
    errors: LpmsIngestionError[]
  ): PropertyRecord[] {
    const out: PropertyRecord[] = [];
    for (let i = 0; i < src.length; i++) {
      const raw = src[i];
      if (!raw || typeof raw !== 'object') {
        errors.push({ entity: 'property', index: i, reason: 'not an object' });
        continue;
      }
      const rec = raw as Record<string, unknown>;
      const name = pickString(rec, aliases.property.name);
      if (!name) {
        errors.push({
          entity: 'property',
          index: i,
          reason: 'missing required field: name',
        });
        continue;
      }
      const externalId = pickString(rec, aliases.property.externalId);
      const addressLine1 = pickString(rec, aliases.property.addressLine1);
      const city = pickString(rec, aliases.property.city);
      const unitCount = pickInt(rec, aliases.property.unitCount);
      const propertyType = pickString(rec, aliases.property.propertyType);
      out.push({
        tenantId: ctx.tenantId,
        ...(externalId && { externalId }),
        name,
        ...(addressLine1 && { addressLine1 }),
        ...(city && { city }),
        ...(unitCount !== undefined && { unitCount }),
        ...(propertyType && { propertyType }),
      });
    }
    return out;
  }

  private mapUnits(
    src: readonly unknown[],
    ctx: LpmsIngestionContext,
    aliases: JsonAliasMap,
    errors: LpmsIngestionError[]
  ): UnitRecord[] {
    const out: UnitRecord[] = [];
    for (let i = 0; i < src.length; i++) {
      const raw = src[i];
      if (!raw || typeof raw !== 'object') {
        errors.push({ entity: 'unit', index: i, reason: 'not an object' });
        continue;
      }
      const rec = raw as Record<string, unknown>;
      const propertyName = pickString(rec, aliases.unit.propertyName);
      const label = pickString(rec, aliases.unit.label);
      if (!propertyName || !label) {
        errors.push({
          entity: 'unit',
          index: i,
          reason: 'missing propertyName or label',
        });
        continue;
      }
      out.push({
        tenantId: ctx.tenantId,
        ...(pickString(rec, aliases.unit.externalId) && {
          externalId: pickString(rec, aliases.unit.externalId)!,
        }),
        propertyName,
        label,
        ...(pickInt(rec, aliases.unit.bedrooms) !== undefined && {
          bedrooms: pickInt(rec, aliases.unit.bedrooms)!,
        }),
        ...(pickNumber(rec, aliases.unit.rentKes) !== undefined && {
          rentKes: pickNumber(rec, aliases.unit.rentKes)!,
        }),
        ...(pickString(rec, aliases.unit.status) && {
          status: pickString(rec, aliases.unit.status)!,
        }),
      });
    }
    return out;
  }

  private mapCustomers(
    src: readonly unknown[],
    ctx: LpmsIngestionContext,
    aliases: JsonAliasMap,
    errors: LpmsIngestionError[]
  ): CustomerRecord[] {
    const out: CustomerRecord[] = [];
    for (let i = 0; i < src.length; i++) {
      const raw = src[i];
      if (!raw || typeof raw !== 'object') {
        errors.push({ entity: 'customer', index: i, reason: 'not an object' });
        continue;
      }
      const rec = raw as Record<string, unknown>;
      const name = pickString(rec, aliases.customer.name);
      if (!name) {
        errors.push({
          entity: 'customer',
          index: i,
          reason: 'missing required field: name',
        });
        continue;
      }
      out.push({
        tenantId: ctx.tenantId,
        ...(pickString(rec, aliases.customer.externalId) && {
          externalId: pickString(rec, aliases.customer.externalId)!,
        }),
        name,
        ...(pickString(rec, aliases.customer.phone) && {
          phone: pickString(rec, aliases.customer.phone)!,
        }),
        ...(pickString(rec, aliases.customer.email) && {
          email: pickString(rec, aliases.customer.email)!,
        }),
        ...(pickString(rec, aliases.customer.unitLabel) && {
          unitLabel: pickString(rec, aliases.customer.unitLabel)!,
        }),
        ...(pickString(rec, aliases.customer.propertyName) && {
          propertyName: pickString(rec, aliases.customer.propertyName)!,
        }),
      });
    }
    return out;
  }

  private mapLeases(
    src: readonly unknown[],
    ctx: LpmsIngestionContext,
    aliases: JsonAliasMap,
    errors: LpmsIngestionError[]
  ): LeaseRecord[] {
    const out: LeaseRecord[] = [];
    for (let i = 0; i < src.length; i++) {
      const raw = src[i];
      if (!raw || typeof raw !== 'object') {
        errors.push({ entity: 'lease', index: i, reason: 'not an object' });
        continue;
      }
      const rec = raw as Record<string, unknown>;
      const customerName = pickString(rec, aliases.lease.customerName);
      const unitLabel = pickString(rec, aliases.lease.unitLabel);
      const propertyName = pickString(rec, aliases.lease.propertyName);
      if (!customerName || !unitLabel || !propertyName) {
        errors.push({
          entity: 'lease',
          index: i,
          reason: 'missing customerName, unitLabel, or propertyName',
        });
        continue;
      }
      out.push({
        tenantId: ctx.tenantId,
        ...(pickString(rec, aliases.lease.externalId) && {
          externalId: pickString(rec, aliases.lease.externalId)!,
        }),
        customerName,
        unitLabel,
        propertyName,
        ...(pickString(rec, aliases.lease.leaseStart) && {
          leaseStart: pickString(rec, aliases.lease.leaseStart)!,
        }),
        ...(pickString(rec, aliases.lease.leaseEnd) && {
          leaseEnd: pickString(rec, aliases.lease.leaseEnd)!,
        }),
        ...(pickNumber(rec, aliases.lease.rentKes) !== undefined && {
          rentKes: pickNumber(rec, aliases.lease.rentKes)!,
        }),
      });
    }
    return out;
  }

  private mapPayments(
    src: readonly unknown[],
    ctx: LpmsIngestionContext,
    aliases: JsonAliasMap,
    errors: LpmsIngestionError[]
  ): PaymentRecord[] {
    const out: PaymentRecord[] = [];
    for (let i = 0; i < src.length; i++) {
      const raw = src[i];
      if (!raw || typeof raw !== 'object') {
        errors.push({ entity: 'payment', index: i, reason: 'not an object' });
        continue;
      }
      const rec = raw as Record<string, unknown>;
      const customerName = pickString(rec, aliases.payment.customerName);
      const amount = pickNumber(rec, aliases.payment.amountKes);
      if (!customerName) {
        errors.push({
          entity: 'payment',
          index: i,
          reason: 'missing customerName',
        });
        continue;
      }
      if (amount === undefined) {
        errors.push({
          entity: 'payment',
          index: i,
          reason: 'missing numeric amount',
        });
        continue;
      }
      out.push({
        tenantId: ctx.tenantId,
        ...(pickString(rec, aliases.payment.externalId) && {
          externalId: pickString(rec, aliases.payment.externalId)!,
        }),
        customerName,
        amountKes: amount,
        ...(pickString(rec, aliases.payment.paidAt) && {
          paidAt: pickString(rec, aliases.payment.paidAt)!,
        }),
        ...(pickString(rec, aliases.payment.method) && {
          method: pickString(rec, aliases.payment.method)!,
        }),
        ...(pickString(rec, aliases.payment.reference) && {
          reference: pickString(rec, aliases.payment.reference)!,
        }),
      });
    }
    return out;
  }
}
