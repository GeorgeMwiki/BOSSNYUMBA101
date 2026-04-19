import { describe, expect, it } from 'vitest';

import { LpmsCsvAdapter, type CsvColumnMap } from '../csv-adapter.js';
import {
  CUSTOMERS_CSV,
  LEASES_CSV,
  MALFORMED_CSV,
  PAYMENTS_CSV,
  PROPERTIES_CSV,
  PROPERTIES_CSV_ALTERNATE,
  UNITS_CSV,
} from './fixtures/sample.csv.js';

const TENANT = 'tenant-uuid-abc';

describe('LpmsCsvAdapter', () => {
  it('parses a full LPMS export happy path and stamps tenantId on every row', () => {
    const adapter = new LpmsCsvAdapter();
    const result = adapter.parse(
      {
        properties: PROPERTIES_CSV,
        units: UNITS_CSV,
        customers: CUSTOMERS_CSV,
        leases: LEASES_CSV,
        payments: PAYMENTS_CSV,
      },
      { tenantId: TENANT }
    );
    expect(result.ok).toBe(true);
    expect(result.counts).toEqual({
      properties: 2,
      units: 2,
      customers: 2,
      leases: 1,
      payments: 2,
    });
    // Tenant isolation: every emitted row MUST carry our tenantId.
    const all = [
      ...result.data.properties,
      ...result.data.units,
      ...result.data.customers,
      ...result.data.leases,
      ...result.data.payments,
    ];
    for (const row of all) {
      expect(row.tenantId).toBe(TENANT);
    }
  });

  it('preserves quoted-comma values inside CSV cells', () => {
    const adapter = new LpmsCsvAdapter();
    const result = adapter.parse(
      { properties: PROPERTIES_CSV },
      { tenantId: TENANT }
    );
    const second = result.data.properties[1];
    expect(second?.name).toBe('Oak Ridge, West');
  });

  it('returns empty arrays when input is empty', () => {
    const adapter = new LpmsCsvAdapter();
    const result = adapter.parse({}, { tenantId: TENANT });
    expect(result.ok).toBe(true);
    expect(result.counts.properties).toBe(0);
    expect(result.data.units).toHaveLength(0);
  });

  it('surfaces row-level errors for rows missing required columns', () => {
    const adapter = new LpmsCsvAdapter();
    const bad = 'property_id,property_name\nP-001,\n';
    const result = adapter.parse(
      { properties: bad },
      { tenantId: TENANT, bestEffort: true }
    );
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.entity === 'property' && e.index === 0)
    ).toBe(true);
  });

  it('throws LpmsParseError on structurally malformed CSV (unterminated quote)', () => {
    const adapter = new LpmsCsvAdapter();
    expect(() =>
      adapter.parse({ properties: MALFORMED_CSV }, { tenantId: TENANT })
    ).toThrow(/unterminated/i);
  });

  it('honors a custom column map', () => {
    const adapter = new LpmsCsvAdapter();
    const customMap: CsvColumnMap = {
      property: {
        externalId: 'code',
        name: 'title',
        addressLine1: 'street',
        city: 'town',
        unitCount: 'count',
        propertyType: 'kind',
      },
      unit: {
        propertyName: 'property_name',
        label: 'unit_label',
      },
      customer: { name: 'full_name' },
      lease: {
        customerName: 'customer_name',
        unitLabel: 'unit_label',
        propertyName: 'property_name',
      },
      payment: { customerName: 'customer_name', amountKes: 'amount_kes' },
    };
    const result = adapter.parse(
      { properties: PROPERTIES_CSV_ALTERNATE },
      { tenantId: TENANT },
      { columnMap: customMap }
    );
    expect(result.ok).toBe(true);
    expect(result.data.properties).toHaveLength(1);
    const first = result.data.properties[0];
    expect(first?.name).toBe('Palm Court');
    expect(first?.city).toBe('Mombasa');
    expect(first?.externalId).toBe('P-010');
  });

  it('requires tenantId in context', () => {
    const adapter = new LpmsCsvAdapter();
    // @ts-expect-error — intentionally wrong to assert the guard.
    expect(() => adapter.parse({ properties: PROPERTIES_CSV }, {})).toThrow(
      /tenantId/i
    );
  });

  it('coerces numeric columns (rent, bedrooms) robustly', () => {
    const adapter = new LpmsCsvAdapter();
    const units = `unit_id,property_name,unit_label,bedrooms,rent_kes,status
U-10,Sunset Heights,C1,"3","45,000",vacant
`;
    const result = adapter.parse({ units }, { tenantId: TENANT });
    const unit = result.data.units[0];
    expect(unit?.bedrooms).toBe(3);
    expect(unit?.rentKes).toBe(45000);
  });
});
