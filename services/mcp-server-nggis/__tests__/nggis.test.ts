import { describe, it, expect } from 'vitest';
import {
  NGGIS_TOOLS,
  verifyTitleDeedTool,
  searchPropertyTool,
} from '../src/tools/index.js';
import { MockNggisAdapter } from '../src/adapter.js';

const deps = { nggis: new MockNggisAdapter() };

describe('NGGIS tool registry', () => {
  it('exposes 2 tools (verify_title_deed + search_property)', () => {
    expect(NGGIS_TOOLS).toHaveLength(2);
    const names = NGGIS_TOOLS.map((t) => t.name);
    expect(names).toContain('nggis.verify_title_deed');
    expect(names).toContain('nggis.search_property');
  });
});

describe('nggis.verify_title_deed', () => {
  it('routes Lagos deeds to LASRRA', async () => {
    const result = await verifyTitleDeedTool.execute(
      { tenantId: 't1', deedNumber: 'LA-12345', stateCode: 'LA' },
      deps,
    );
    expect(result.verified).toBe(true);
    expect(result.registry).toMatch(/LASRRA/);
  });

  it('routes FCT (Abuja) deeds to ABGIS', async () => {
    const result = await verifyTitleDeedTool.execute(
      { tenantId: 't1', deedNumber: 'FC-67890', stateCode: 'FC' },
      deps,
    );
    expect(result.registry).toMatch(/ABGIS/);
  });

  it('flags pending_litigation encumbrance when deed contains "DISPUTE"', async () => {
    const result = await verifyTitleDeedTool.execute(
      { tenantId: 't1', deedNumber: 'LA-DISPUTE-1', stateCode: 'LA' },
      deps,
    );
    expect(result.verified).toBe(true);
    expect(result.encumbrances).toContain('pending_litigation');
  });

  it('returns verified=false for shape mismatches', async () => {
    const result = await verifyTitleDeedTool.execute(
      { tenantId: 't1', deedNumber: '!', stateCode: 'LA' },
      deps,
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toBe('invalid_deed_shape');
  });
});

describe('nggis.search_property', () => {
  it('returns matches scoped to the requested state', async () => {
    const result = await searchPropertyTool.execute(
      { tenantId: 't1', stateCode: 'LA', query: 'Ikeja' },
      deps,
    );
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0]?.deedNumber).toMatch(/^LA-/);
  });

  it('honours the limit cap', async () => {
    const result = await searchPropertyTool.execute(
      { tenantId: 't1', stateCode: 'FC', query: 'Wuse', limit: 1 },
      deps,
    );
    expect(result.matches).toHaveLength(1);
  });
});
