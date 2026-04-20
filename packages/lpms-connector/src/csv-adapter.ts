/**
 * CSV LPMS adapter.
 *
 * WHY a custom minimal parser: papaparse is not installed in this
 * monorepo (verified in node_modules) and adding it pulls a full
 * dependency. Legacy LPMS CSVs are narrow — double-quoted strings with
 * `""` escapes, comma delimiter, optional CRLF — so a purpose-built
 * parser is safer (no surprising auto-typing, no regex pitfalls) and
 * keeps the package lean.
 *
 * WHY configurable column maps: every LPMS vendor (Yardi-Lite,
 * PropManager, TrebAfrica, etc.) ships different column names for the
 * same semantic field. The caller supplies a mapping at parse time;
 * this adapter stays vendor-agnostic.
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

/**
 * Per-entity column map. Each key is a field on the normalized record;
 * each value is the header string used in the source CSV. A column map
 * MAY omit optional fields — the adapter simply leaves them undefined.
 */
export interface CsvColumnMap {
  property: {
    externalId?: string;
    name: string;
    addressLine1?: string;
    city?: string;
    unitCount?: string;
    propertyType?: string;
  };
  unit: {
    externalId?: string;
    propertyName: string;
    label: string;
    bedrooms?: string;
    rentKes?: string;
    status?: string;
  };
  customer: {
    externalId?: string;
    name: string;
    phone?: string;
    email?: string;
    unitLabel?: string;
    propertyName?: string;
  };
  lease: {
    externalId?: string;
    customerName: string;
    unitLabel: string;
    propertyName: string;
    leaseStart?: string;
    leaseEnd?: string;
    rentKes?: string;
  };
  payment: {
    externalId?: string;
    customerName: string;
    amountKes: string;
    paidAt?: string;
    method?: string;
    reference?: string;
  };
}

/** One CSV per entity — the common LPMS export layout (one file = one table). */
export interface CsvInput {
  properties?: string;
  units?: string;
  customers?: string;
  leases?: string;
  payments?: string;
}

export interface CsvAdapterOptions {
  /** Header-to-field mapping, one entry per entity type. */
  columnMap: CsvColumnMap;
}

/** Default map that works for the reference legacy LPMS export. */
export const DEFAULT_CSV_COLUMN_MAP: CsvColumnMap = Object.freeze({
  property: {
    externalId: 'property_id',
    name: 'property_name',
    addressLine1: 'address',
    city: 'city',
    unitCount: 'unit_count',
    propertyType: 'type',
  },
  unit: {
    externalId: 'unit_id',
    propertyName: 'property_name',
    label: 'unit_label',
    bedrooms: 'bedrooms',
    rentKes: 'rent_kes',
    status: 'status',
  },
  customer: {
    externalId: 'customer_id',
    name: 'full_name',
    phone: 'phone',
    email: 'email',
    unitLabel: 'unit_label',
    propertyName: 'property_name',
  },
  lease: {
    externalId: 'lease_id',
    customerName: 'customer_name',
    unitLabel: 'unit_label',
    propertyName: 'property_name',
    leaseStart: 'start_date',
    leaseEnd: 'end_date',
    rentKes: 'rent_kes',
  },
  payment: {
    externalId: 'payment_id',
    customerName: 'customer_name',
    amountKes: 'amount_kes',
    paidAt: 'paid_at',
    method: 'method',
    reference: 'reference',
  },
}) as CsvColumnMap;

// ---------------------------------------------------------------------------
// Minimal RFC-4180-ish CSV parser. Pure function — accepts a string,
// returns an immutable 2-D array. No mutation of the input, no side
// effects.
// ---------------------------------------------------------------------------

function parseCsv(source: string): readonly (readonly string[])[] {
  if (typeof source !== 'string') {
    throw new LpmsParseError('csv', 'input must be a string');
  }
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const n = source.length;

  while (i < n) {
    const ch = source[i];

    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row = [...row, field];
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // CRLF: consume the \n too, emit row.
      row = [...row, field];
      rows.push(row);
      row = [];
      field = '';
      i += source[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (ch === '\n') {
      row = [...row, field];
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (inQuotes) {
    throw new LpmsParseError('csv', 'unterminated quoted field');
  }
  // Flush trailing row if file does not end on newline and is non-empty.
  if (field.length > 0 || row.length > 0) {
    row = [...row, field];
    rows.push(row);
  }
  // Drop trailing fully-empty lines.
  return rows.filter(
    (r) => !(r.length === 1 && r[0] !== undefined && r[0].length === 0)
  );
}

interface ParsedTable {
  header: readonly string[];
  rows: readonly (readonly string[])[];
}

function toTable(source: string | undefined): ParsedTable | null {
  if (!source || source.trim().length === 0) return null;
  const all = parseCsv(source);
  if (all.length === 0) return null;
  const [header, ...rest] = all;
  if (!header) return null;
  return { header, rows: rest };
}

function cell(
  table: ParsedTable,
  row: readonly string[],
  headerName: string | undefined
): string | undefined {
  if (!headerName) return undefined;
  const idx = table.header.indexOf(headerName);
  if (idx < 0) return undefined;
  const v = row[idx];
  return v === undefined || v === '' ? undefined : v;
}

/** Lenient numeric coercion — empty/missing => undefined, garbage => NaN caught later. */
function toNum(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const cleaned = s.replace(/,/g, '').trim();
  if (cleaned === '') return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function toInt(s: string | undefined): number | undefined {
  const n = toNum(s);
  if (n === undefined) return undefined;
  return Math.trunc(n);
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class LpmsCsvAdapter
  implements LpmsAdapter<CsvInput, CsvAdapterOptions>
{
  public readonly kind = 'csv' as const;

  public parse(
    input: CsvInput,
    ctx: LpmsIngestionContext,
    options?: CsvAdapterOptions
  ): LpmsIngestionResult {
    if (!ctx || !ctx.tenantId) {
      throw new LpmsParseError('csv', 'tenantId is required');
    }
    const map = options?.columnMap ?? DEFAULT_CSV_COLUMN_MAP;
    const errors: LpmsIngestionError[] = [];

    const properties = this.parseProperties(input.properties, ctx, map, errors);
    const units = this.parseUnits(input.units, ctx, map, errors);
    const customers = this.parseCustomers(input.customers, ctx, map, errors);
    const leases = this.parseLeases(input.leases, ctx, map, errors);
    const payments = this.parsePayments(input.payments, ctx, map, errors);

    const candidate: LpmsNormalizedExport = {
      properties,
      units,
      customers,
      leases,
      payments,
    };

    const validated = LpmsNormalizedExportSchema.safeParse(candidate);
    if (!validated.success) {
      // Surface zod issues as ingestion errors rather than throwing —
      // gives the operator a per-field view.
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

  private parseProperties(
    src: string | undefined,
    ctx: LpmsIngestionContext,
    map: CsvColumnMap,
    errors: LpmsIngestionError[]
  ): PropertyRecord[] {
    const table = toTable(src);
    if (!table) return [];
    const out: PropertyRecord[] = [];
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (!row) continue;
      const name = cell(table, row, map.property.name);
      if (!name) {
        errors.push({
          entity: 'property',
          index: i,
          reason: `row missing required column "${map.property.name}"`,
        });
        continue;
      }
      out.push({
        tenantId: ctx.tenantId,
        ...(cell(table, row, map.property.externalId) && {
          externalId: cell(table, row, map.property.externalId)!,
        }),
        name,
        ...(cell(table, row, map.property.addressLine1) && {
          addressLine1: cell(table, row, map.property.addressLine1)!,
        }),
        ...(cell(table, row, map.property.city) && {
          city: cell(table, row, map.property.city)!,
        }),
        ...(toInt(cell(table, row, map.property.unitCount)) !== undefined && {
          unitCount: toInt(cell(table, row, map.property.unitCount))!,
        }),
        ...(cell(table, row, map.property.propertyType) && {
          propertyType: cell(table, row, map.property.propertyType)!,
        }),
      });
    }
    return out;
  }

  private parseUnits(
    src: string | undefined,
    ctx: LpmsIngestionContext,
    map: CsvColumnMap,
    errors: LpmsIngestionError[]
  ): UnitRecord[] {
    const table = toTable(src);
    if (!table) return [];
    const out: UnitRecord[] = [];
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (!row) continue;
      const propertyName = cell(table, row, map.unit.propertyName);
      const label = cell(table, row, map.unit.label);
      if (!propertyName || !label) {
        errors.push({
          entity: 'unit',
          index: i,
          reason: 'row missing propertyName or label',
        });
        continue;
      }
      out.push({
        tenantId: ctx.tenantId,
        ...(cell(table, row, map.unit.externalId) && {
          externalId: cell(table, row, map.unit.externalId)!,
        }),
        propertyName,
        label,
        ...(toInt(cell(table, row, map.unit.bedrooms)) !== undefined && {
          bedrooms: toInt(cell(table, row, map.unit.bedrooms))!,
        }),
        ...(toNum(cell(table, row, map.unit.rentKes)) !== undefined && {
          rentKes: toNum(cell(table, row, map.unit.rentKes))!,
        }),
        ...(cell(table, row, map.unit.status) && {
          status: cell(table, row, map.unit.status)!,
        }),
      });
    }
    return out;
  }

  private parseCustomers(
    src: string | undefined,
    ctx: LpmsIngestionContext,
    map: CsvColumnMap,
    errors: LpmsIngestionError[]
  ): CustomerRecord[] {
    const table = toTable(src);
    if (!table) return [];
    const out: CustomerRecord[] = [];
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (!row) continue;
      const name = cell(table, row, map.customer.name);
      if (!name) {
        errors.push({
          entity: 'customer',
          index: i,
          reason: `row missing required column "${map.customer.name}"`,
        });
        continue;
      }
      out.push({
        tenantId: ctx.tenantId,
        ...(cell(table, row, map.customer.externalId) && {
          externalId: cell(table, row, map.customer.externalId)!,
        }),
        name,
        ...(cell(table, row, map.customer.phone) && {
          phone: cell(table, row, map.customer.phone)!,
        }),
        ...(cell(table, row, map.customer.email) && {
          email: cell(table, row, map.customer.email)!,
        }),
        ...(cell(table, row, map.customer.unitLabel) && {
          unitLabel: cell(table, row, map.customer.unitLabel)!,
        }),
        ...(cell(table, row, map.customer.propertyName) && {
          propertyName: cell(table, row, map.customer.propertyName)!,
        }),
      });
    }
    return out;
  }

  private parseLeases(
    src: string | undefined,
    ctx: LpmsIngestionContext,
    map: CsvColumnMap,
    errors: LpmsIngestionError[]
  ): LeaseRecord[] {
    const table = toTable(src);
    if (!table) return [];
    const out: LeaseRecord[] = [];
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (!row) continue;
      const customerName = cell(table, row, map.lease.customerName);
      const unitLabel = cell(table, row, map.lease.unitLabel);
      const propertyName = cell(table, row, map.lease.propertyName);
      if (!customerName || !unitLabel || !propertyName) {
        errors.push({
          entity: 'lease',
          index: i,
          reason: 'row missing customerName, unitLabel, or propertyName',
        });
        continue;
      }
      out.push({
        tenantId: ctx.tenantId,
        ...(cell(table, row, map.lease.externalId) && {
          externalId: cell(table, row, map.lease.externalId)!,
        }),
        customerName,
        unitLabel,
        propertyName,
        ...(cell(table, row, map.lease.leaseStart) && {
          leaseStart: cell(table, row, map.lease.leaseStart)!,
        }),
        ...(cell(table, row, map.lease.leaseEnd) && {
          leaseEnd: cell(table, row, map.lease.leaseEnd)!,
        }),
        ...(toNum(cell(table, row, map.lease.rentKes)) !== undefined && {
          rentKes: toNum(cell(table, row, map.lease.rentKes))!,
        }),
      });
    }
    return out;
  }

  private parsePayments(
    src: string | undefined,
    ctx: LpmsIngestionContext,
    map: CsvColumnMap,
    errors: LpmsIngestionError[]
  ): PaymentRecord[] {
    const table = toTable(src);
    if (!table) return [];
    const out: PaymentRecord[] = [];
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (!row) continue;
      const customerName = cell(table, row, map.payment.customerName);
      const amount = toNum(cell(table, row, map.payment.amountKes));
      if (!customerName) {
        errors.push({
          entity: 'payment',
          index: i,
          reason: 'row missing customerName',
        });
        continue;
      }
      if (amount === undefined) {
        errors.push({
          entity: 'payment',
          index: i,
          reason: 'row missing numeric amount',
        });
        continue;
      }
      out.push({
        tenantId: ctx.tenantId,
        ...(cell(table, row, map.payment.externalId) && {
          externalId: cell(table, row, map.payment.externalId)!,
        }),
        customerName,
        amountKes: amount,
        ...(cell(table, row, map.payment.paidAt) && {
          paidAt: cell(table, row, map.payment.paidAt)!,
        }),
        ...(cell(table, row, map.payment.method) && {
          method: cell(table, row, map.payment.method)!,
        }),
        ...(cell(table, row, map.payment.reference) && {
          reference: cell(table, row, map.payment.reference)!,
        }),
      });
    }
    return out;
  }
}
