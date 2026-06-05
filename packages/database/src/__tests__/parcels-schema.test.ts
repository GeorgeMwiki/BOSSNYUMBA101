/**
 * Guards the post-0252b parcels table reconciliation.
 *
 * Migration 0252b_muzima_parcels_rename_preempt.sql renamed the Muzima
 * spatial table `parcels` -> `muzima_parcels` so the Piece-N land-
 * subdivision engine (0253_parcels.sql) can own the `parcels` name on a
 * fresh DB. The Drizzle model for the Muzima shape must therefore map
 * `muzima_parcels`, and the buildings FK (which followed the rename by OID)
 * must resolve to it — never to the unrelated Piece-N `parcels` table.
 */

import { describe, it, expect } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { muzimaParcels, mapLayers } from '../schemas/parcels.schema.js';
import { buildings } from '../schemas/buildings.schema.js';

describe('parcels schema — 0252b muzima_parcels rename', () => {
  it('the Muzima model targets the renamed muzima_parcels table', () => {
    expect(getTableName(muzimaParcels)).toBe('muzima_parcels');
  });

  it('the Muzima model no longer claims the Piece-N `parcels` name', () => {
    // `parcels` now belongs to the Piece-N engine (pure-domain
    // @bossnyumba/geo-parcels); no Drizzle model here may map it.
    expect(getTableName(muzimaParcels)).not.toBe('parcels');
  });

  it('map_layers (same 0164d cluster) is unaffected by the rename', () => {
    expect(getTableName(mapLayers)).toBe('map_layers');
  });

  it('buildings.parcel_id FK resolves to muzima_parcels, not parcels', () => {
    expect(getTableName(buildings)).toBe('buildings');
    const fks = getTableConfig(buildings).foreignKeys;
    const targets = fks.map((fk) => getTableName(fk.reference().foreignTable));
    expect(targets).toContain('muzima_parcels');
    expect(targets).not.toContain('parcels');
  });

  it('the Muzima shape columns survive the rename (boundary/centroid/h3)', () => {
    const cols = getTableConfig(muzimaParcels).columns.map((c) => c.name);
    expect(cols).toEqual(
      expect.arrayContaining(['boundary', 'centroid', 'h3_r10']),
    );
    // Piece-N's distinctive columns must NOT be on this model.
    expect(cols).not.toContain('land_area_id');
    expect(cols).not.toContain('parent_parcel_id');
  });
});
