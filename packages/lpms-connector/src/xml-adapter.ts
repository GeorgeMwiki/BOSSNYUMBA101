/**
 * XML LPMS adapter.
 *
 * WHY fast-xml-parser: already a transitive dep per the root
 * package.json overrides (>=5.5.6). Its security stance (no external
 * entity expansion by default, no prototype pollution) matches the
 * project's security.md rule of "validate all untrusted input".
 *
 * Supported shape (vendor-agnostic):
 *   <export>
 *     <properties><property>...</property></properties>
 *     <units><unit>...</unit></units>
 *     <customers><customer>...</customer></customers>
 *     <leases><lease>...</lease></leases>
 *     <payments><payment>...</payment></payments>
 *   </export>
 *
 * Field names inside each element are looked up via the same alias
 * strategy used by the JSON adapter, so operators only maintain one
 * mental model.
 */

import { XMLParser } from 'fast-xml-parser';

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

export interface XmlAdapterOptions {
  /** Optional alias map — same shape as JSON adapter. */
  aliasMap?: Partial<XmlAliasMap>;
  /** Override the outer wrapper tag (default: "export"). */
  rootTag?: string;
}

export interface XmlAliasMap {
  property: Record<keyof PropertyRecord, readonly string[]>;
  unit: Record<keyof UnitRecord, readonly string[]>;
  customer: Record<keyof CustomerRecord, readonly string[]>;
  lease: Record<keyof LeaseRecord, readonly string[]>;
  payment: Record<keyof PaymentRecord, readonly string[]>;
}

const DEFAULT_XML_ALIASES: XmlAliasMap = Object.freeze({
  property: {
    tenantId: [],
    externalId: ['id', 'externalId', 'propertyId', 'property_id'],
    name: ['name', 'propertyName', 'title'],
    addressLine1: ['addressLine1', 'address', 'street'],
    city: ['city', 'town'],
    unitCount: ['unitCount', 'units', 'numberOfUnits'],
    propertyType: ['propertyType', 'type', 'kind'],
  },
  unit: {
    tenantId: [],
    externalId: ['id', 'externalId', 'unitId', 'unit_id'],
    propertyName: ['propertyName', 'property', 'building'],
    label: ['label', 'unitLabel', 'name', 'number'],
    bedrooms: ['bedrooms', 'beds'],
    rentKes: ['rentKes', 'rent', 'monthlyRent'],
    status: ['status', 'state'],
  },
  customer: {
    tenantId: [],
    externalId: ['id', 'externalId', 'customerId', 'customer_id'],
    name: ['name', 'fullName'],
    phone: ['phone', 'phoneNumber', 'mobile'],
    email: ['email'],
    unitLabel: ['unitLabel', 'unit'],
    propertyName: ['propertyName', 'property'],
  },
  lease: {
    tenantId: [],
    externalId: ['id', 'externalId', 'leaseId', 'lease_id'],
    customerName: ['customerName', 'tenantName'],
    unitLabel: ['unitLabel', 'unit'],
    propertyName: ['propertyName', 'property'],
    leaseStart: ['leaseStart', 'startDate'],
    leaseEnd: ['leaseEnd', 'endDate'],
    rentKes: ['rentKes', 'rent'],
  },
  payment: {
    tenantId: [],
    externalId: ['id', 'externalId', 'paymentId', 'payment_id'],
    customerName: ['customerName', 'payer'],
    amountKes: ['amountKes', 'amount'],
    paidAt: ['paidAt', 'date'],
    method: ['method', 'channel'],
    reference: ['reference', 'txnId', 'ref'],
  },
}) as XmlAliasMap;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asArray(val: unknown): unknown[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function extractRecords(root: unknown, group: string, item: string): unknown[] {
  if (!root || typeof root !== 'object') return [];
  const g = (root as Record<string, unknown>)[group];
  if (g === undefined || g === null) return [];
  if (typeof g !== 'object') return [];
  const items = (g as Record<string, unknown>)[item];
  return asArray(items);
}

function pickString(
  rec: Record<string, unknown>,
  keys: readonly string[]
): string | undefined {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
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
  partial: Partial<XmlAliasMap> | undefined
): XmlAliasMap {
  if (!partial) return DEFAULT_XML_ALIASES;
  return {
    property: { ...DEFAULT_XML_ALIASES.property, ...(partial.property ?? {}) },
    unit: { ...DEFAULT_XML_ALIASES.unit, ...(partial.unit ?? {}) },
    customer: { ...DEFAULT_XML_ALIASES.customer, ...(partial.customer ?? {}) },
    lease: { ...DEFAULT_XML_ALIASES.lease, ...(partial.lease ?? {}) },
    payment: { ...DEFAULT_XML_ALIASES.payment, ...(partial.payment ?? {}) },
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class LpmsXmlAdapter implements LpmsAdapter<string, XmlAdapterOptions> {
  public readonly kind = 'xml' as const;

  public parse(
    input: string,
    ctx: LpmsIngestionContext,
    options?: XmlAdapterOptions
  ): LpmsIngestionResult {
    if (!ctx || !ctx.tenantId) {
      throw new LpmsParseError('xml', 'tenantId is required');
    }
    if (typeof input !== 'string' || input.trim().length === 0) {
      throw new LpmsParseError('xml', 'input must be a non-empty string');
    }

    // fast-xml-parser options: coerce numbers to strings
    // (we do our own numeric coercion for consistency with CSV/JSON), keep
    // attribute access off (LPMS exports usually use elements, and
    // attribute parsing widens the attack surface for little benefit).
    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
      processEntities: false,
    });

    let parsed: unknown;
    try {
      parsed = parser.parse(input);
    } catch (e) {
      throw new LpmsParseError(
        'xml',
        'invalid XML input',
        e instanceof Error ? e : undefined
      );
    }

    const rootTag = options?.rootTag ?? 'export';
    const aliases = mergeAliases(options?.aliasMap);
    const errors: LpmsIngestionError[] = [];

    const root =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)[rootTag] ?? parsed
        : parsed;

    const propsRaw = extractRecords(root, 'properties', 'property');
    const unitsRaw = extractRecords(root, 'units', 'unit');
    const customersRaw = extractRecords(root, 'customers', 'customer');
    const leasesRaw = extractRecords(root, 'leases', 'lease');
    const paymentsRaw = extractRecords(root, 'payments', 'payment');

    const properties = this.mapProperties(propsRaw, ctx, aliases, errors);
    const units = this.mapUnits(unitsRaw, ctx, aliases, errors);
    const customers = this.mapCustomers(customersRaw, ctx, aliases, errors);
    const leases = this.mapLeases(leasesRaw, ctx, aliases, errors);
    const payments = this.mapPayments(paymentsRaw, ctx, aliases, errors);

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
    aliases: XmlAliasMap,
    errors: LpmsIngestionError[]
  ): PropertyRecord[] {
    const out: PropertyRecord[] = [];
    for (let i = 0; i < src.length; i++) {
      const raw = src[i];
      if (!raw || typeof raw !== 'object') {
        errors.push({ entity: 'property', index: i, reason: 'not an element' });
        continue;
      }
      const rec = raw as Record<string, unknown>;
      const name = pickString(rec, aliases.property.name);
      if (!name) {
        errors.push({
          entity: 'property',
          index: i,
          reason: 'missing required element: name',
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
    aliases: XmlAliasMap,
    errors: LpmsIngestionError[]
  ): UnitRecord[] {
    const out: UnitRecord[] = [];
    for (let i = 0; i < src.length; i++) {
      const raw = src[i];
      if (!raw || typeof raw !== 'object') {
        errors.push({ entity: 'unit', index: i, reason: 'not an element' });
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
    aliases: XmlAliasMap,
    errors: LpmsIngestionError[]
  ): CustomerRecord[] {
    const out: CustomerRecord[] = [];
    for (let i = 0; i < src.length; i++) {
      const raw = src[i];
      if (!raw || typeof raw !== 'object') {
        errors.push({ entity: 'customer', index: i, reason: 'not an element' });
        continue;
      }
      const rec = raw as Record<string, unknown>;
      const name = pickString(rec, aliases.customer.name);
      if (!name) {
        errors.push({
          entity: 'customer',
          index: i,
          reason: 'missing required element: name',
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
    aliases: XmlAliasMap,
    errors: LpmsIngestionError[]
  ): LeaseRecord[] {
    const out: LeaseRecord[] = [];
    for (let i = 0; i < src.length; i++) {
      const raw = src[i];
      if (!raw || typeof raw !== 'object') {
        errors.push({ entity: 'lease', index: i, reason: 'not an element' });
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
    aliases: XmlAliasMap,
    errors: LpmsIngestionError[]
  ): PaymentRecord[] {
    const out: PaymentRecord[] = [];
    for (let i = 0; i < src.length; i++) {
      const raw = src[i];
      if (!raw || typeof raw !== 'object') {
        errors.push({ entity: 'payment', index: i, reason: 'not an element' });
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
