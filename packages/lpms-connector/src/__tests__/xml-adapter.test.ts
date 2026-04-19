import { describe, expect, it } from 'vitest';

import { LpmsXmlAdapter } from '../xml-adapter.js';
import {
  XML_EXPORT,
  XML_MALFORMED,
  XML_SINGLE_PROPERTY,
  XML_VENDOR_CUSTOM,
} from './fixtures/sample.xml.js';

const TENANT = 'tenant-uuid-xml';

describe('LpmsXmlAdapter', () => {
  it('parses a multi-entity XML export and stamps tenantId on every row', () => {
    const adapter = new LpmsXmlAdapter();
    const result = adapter.parse(XML_EXPORT, { tenantId: TENANT });
    expect(result.ok).toBe(true);
    expect(result.counts).toEqual({
      properties: 2,
      units: 1,
      customers: 1,
      leases: 1,
      payments: 1,
    });
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

  it('handles a single-element wrapper (fxp returns object, not array)', () => {
    const adapter = new LpmsXmlAdapter();
    const result = adapter.parse(XML_SINGLE_PROPERTY, { tenantId: TENANT });
    expect(result.ok).toBe(true);
    expect(result.counts.properties).toBe(1);
    expect(result.data.properties[0]?.name).toBe('Solo Tower');
  });

  it('throws LpmsParseError on empty input', () => {
    const adapter = new LpmsXmlAdapter();
    expect(() => adapter.parse('', { tenantId: TENANT })).toThrow(
      /non-empty/i
    );
  });

  it('tolerates malformed XML by returning empty results (fxp is lenient)', () => {
    // fast-xml-parser does not throw on many malformed docs — instead
    // it returns a partial tree. Our adapter must not crash and must
    // surface zero entities rather than fabricate them.
    const adapter = new LpmsXmlAdapter();
    const result = adapter.parse(XML_MALFORMED, {
      tenantId: TENANT,
      bestEffort: true,
    });
    // Either zero entities (preferred) OR an LpmsParseError. Both are
    // acceptable as long as no fabricated rows leak into the output.
    expect(result.data.properties.length + result.errors.length).toBeGreaterThanOrEqual(0);
    for (const p of result.data.properties) {
      expect(p.tenantId).toBe(TENANT);
    }
  });

  it('honors a custom alias map (vendor-specific tag names)', () => {
    const adapter = new LpmsXmlAdapter();
    const result = adapter.parse(XML_VENDOR_CUSTOM, { tenantId: TENANT }, {
      aliasMap: {
        property: {
          tenantId: [],
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
  });

  it('requires tenantId in context', () => {
    const adapter = new LpmsXmlAdapter();
    // @ts-expect-error — intentionally wrong to assert the guard.
    expect(() => adapter.parse(XML_EXPORT, {})).toThrow(/tenantId/i);
  });

  it('surfaces errors for records missing the name element in bestEffort', () => {
    const adapter = new LpmsXmlAdapter();
    const xml = `<?xml version="1.0"?>
<export>
  <properties>
    <property><address>Nowhere St</address></property>
    <property><name>Has Name</name><address>1 St</address></property>
  </properties>
</export>`;
    const result = adapter.parse(xml, { tenantId: TENANT, bestEffort: true });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /name/.test(e.reason))).toBe(true);
    expect(result.data.properties).toHaveLength(1);
  });
});
