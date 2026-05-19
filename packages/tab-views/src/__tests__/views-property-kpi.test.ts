/**
 * PropertyKpiGridView unit tests.
 */

import { describe, expect, it } from 'vitest';
import {
  PropertyKpiGridView,
  type PropertyKpiData,
} from '../views/property-kpi-grid-view.js';
import { ownerCustomer } from '../types/principal.js';
import type { RenderContext } from '../types/tab-view.js';

function ctx(): RenderContext {
  return {
    principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }),
    entityType: 'property',
  };
}

function data(over: Partial<PropertyKpiData> = {}): PropertyKpiData {
  return {
    occupancyPct: 87.5,
    occupancyDelta: 2.1,
    revenueCents: 412_000_00,
    revenueDelta: 18_000_00,
    arrearsCount: 4,
    arrearsDelta: -1,
    activeLeases: 32,
    newLeasesThisPeriod: 3,
    periodLabel: 'May 2026',
    currency: 'KES',
    ...over,
  };
}

describe('PropertyKpiGridView.validateQuery', () => {
  it('defaults to month/KES', () => {
    const r = PropertyKpiGridView.validateQuery(undefined, ctx());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query).toEqual({ period: 'month', currency: 'KES' });
  });

  it('accepts the four periods', () => {
    for (const p of ['month', 'quarter', 'year', 'last-30d']) {
      const r = PropertyKpiGridView.validateQuery({ period: p }, ctx());
      expect(r.ok, `period=${p}`).toBe(true);
    }
  });

  it('rejects unknown period', () => {
    const r = PropertyKpiGridView.validateQuery({ period: 'decade' }, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe('unknown-field');
  });

  it('rejects malformed currency', () => {
    const r1 = PropertyKpiGridView.validateQuery({ currency: 'kes' }, ctx());
    expect(r1.ok).toBe(false);
    const r2 = PropertyKpiGridView.validateQuery({ currency: 'EUROS' }, ctx());
    expect(r2.ok).toBe(false);
  });

  it('accepts a 3-letter ISO-4217 currency', () => {
    const r = PropertyKpiGridView.validateQuery({ currency: 'USD' }, ctx());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.currency).toBe('USD');
  });
});

describe('PropertyKpiGridView.renderToBlocks', () => {
  it('emits a kpi-grid block with 5 tiles', () => {
    const blocks = PropertyKpiGridView.renderToBlocks(data(), ctx());
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.kind).toBe('kpi-grid');
    const tiles = (blocks[0] as unknown as { tiles: { label: string }[] }).tiles;
    expect(tiles.length).toBe(5);
    expect(tiles.map((t) => t.label)).toEqual([
      'Occupancy',
      'Revenue',
      'Arrears',
      'Active Leases',
      'New Leases',
    ]);
  });

  it('formats revenue tile as currency in the requested currency', () => {
    const blocks = PropertyKpiGridView.renderToBlocks(data({ currency: 'TZS' }), ctx());
    const tiles = (blocks[0] as unknown as { tiles: { format: string; currency?: string }[] }).tiles;
    const revTile = tiles[1];
    expect(revTile?.format).toBe('currency');
    expect(revTile?.currency).toBe('TZS');
  });

  it('uses up/down/flat delta direction based on delta sign', () => {
    const blocks = PropertyKpiGridView.renderToBlocks(
      data({ occupancyDelta: 1.2, arrearsDelta: -2, revenueDelta: 0 }),
      ctx(),
    );
    const tiles = (blocks[0] as unknown as { tiles: { deltaDirection?: string }[] }).tiles;
    expect(tiles[0]?.deltaDirection).toBe('up');
    expect(tiles[2]?.deltaDirection).toBe('down');
    expect(tiles[1]?.deltaDirection).toBe('flat');
  });

  it('title includes the period label', () => {
    const blocks = PropertyKpiGridView.renderToBlocks(data({ periodLabel: 'Q2 2026' }), ctx());
    expect((blocks[0] as { title?: string }).title).toBe('Properties — Q2 2026');
  });
});
