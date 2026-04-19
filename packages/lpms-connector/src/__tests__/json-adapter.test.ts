import { describe, expect, it } from 'vitest';

import { LpmsJsonAdapter } from '../json-adapter.js';
import {
  JSON_ARRAY_DUMP,
  JSON_OBJECT_DUMP,
  JSON_VENDOR_CUSTOM,
} from './fixtures/sample.json.js';

const TENANT = 'tenant-uuid-json';

describe('LpmsJsonAdapter', () => {
  it('parses an object-shape JSON dump and stamps tenantId on every row', () => {
    const adapter = new LpmsJsonAdapter();
    const result = adapter.parse(JSON_OBJECT_DUMP, { tenantId: TENANT });
    expect(result.ok).toBe(true);
    expect(result.counts.properties).toBe(2);
    expect(result.counts.units).toBe(1);
    expect(result.counts.customers).toBe(1);
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

  it('parses an array-shape JSON dump (tagged records)', () => {
    const adapter = new LpmsJsonAdapter();
    const result = adapter.parse(JSON_ARRAY_DUMP, { tenantId: TENANT });
    expect(result.ok).toBe(true);
    expect(result.counts.properties).toBe(1);
    expect(result.counts.units).toBe(1);
    expect(result.counts.customers).toBe(1);
    expect(result.counts.payments).toBe(1);
    expect(result.data.properties[0]?.name).toBe('Array Heights');
  });

  it('accepts a JSON string input and parses it', () => {
    const adapter = new LpmsJsonAdapter();
    const result = adapter.parse(JSON.stringify(JSON_OBJECT_DUMP), {
      tenantId: TENANT,
    });
    expect(result.ok).toBe(true);
    expect(result.counts.properties).toBe(2);
  });

  it('throws LpmsParseError on invalid JSON string', () => {
    const adapter = new LpmsJsonAdapter();
    expect(() => adapter.parse('{not-json', { tenantId: TENANT })).toThrow(
      /invalid JSON/i
    );
  });

  it('returns empty export for empty object input', () => {
    const adapter = new LpmsJsonAdapter();
    const result = adapter.parse({}, { tenantId: TENANT });
    expect(result.ok).toBe(true);
    expect(result.counts.properties).toBe(0);
  });

  it('honors vendor-specific alias maps', () => {
    const adapter = new LpmsJsonAdapter();
    const result = adapter.parse(JSON_VENDOR_CUSTOM, { tenantId: TENANT }, {
      aliasMap: {
        property: {
          externalId: ['buildingCode'],
          name: ['buildingTitle'],
          addressLine1: [],
          city: [],
          unitCount: [],
          propertyType: [],
        },
      },
    });
    expect(result.ok).toBe(true);
    expect(result.data.properties).toHaveLength(1);
    expect(result.data.properties[0]?.name).toBe('Acacia Towers');
    expect(result.data.properties[0]?.externalId).toBe('B-77');
  });

  it('surfaces row-level errors for records missing required fields', () => {
    const adapter = new LpmsJsonAdapter();
    const input = { properties: [{ id: 'P-1' }, { name: 'Has Name' }] };
    const result = adapter.parse(input, {
      tenantId: TENANT,
      bestEffort: true,
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some(
        (e) => e.entity === 'property' && /name/.test(e.reason)
      )
    ).toBe(true);
    expect(result.data.properties).toHaveLength(1);
    expect(result.data.properties[0]?.name).toBe('Has Name');
  });

  it('requires tenantId in context', () => {
    const adapter = new LpmsJsonAdapter();
    // @ts-expect-error — intentionally wrong to assert the guard.
    expect(() => adapter.parse(JSON_OBJECT_DUMP, {})).toThrow(/tenantId/i);
  });
});
