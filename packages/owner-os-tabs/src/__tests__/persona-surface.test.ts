/**
 * persona-surface tests — verifies persona-adaptive ordering preserves
 * base order for ties and bubbles up persona-relevant tabs.
 */

import { describe, expect, it } from 'vitest';

import {
  SURFACE_PERSONAS,
  coerceSurfacePersona,
  orderTabsForPersona,
} from '../persona-surface.js';
import { defaultTabsFor } from '../scale-defaults.js';

describe('orderTabsForPersona', () => {
  it('owner sees finance / rent / treasury / forecast bubble up on a T4 surface', () => {
    const base = defaultTabsFor('t4_industrial_property');
    const ordered = orderTabsForPersona('owner', base);
    // owner-weighted: chat first, then finance / rent / treasury / forecast etc.
    expect(ordered[0]).toBe('chat');
    const top6 = ordered.slice(0, 6);
    expect(top6).toContain('rent');
    expect(top6).toContain('finance');
    expect(top6).toContain('treasury');
  });

  it('manager sees maintenance / manager-dispatch / inspections bubble up', () => {
    const base = defaultTabsFor('t4_industrial_property');
    const ordered = orderTabsForPersona('manager', base);
    expect(ordered[0]).toBe('chat');
    const top6 = ordered.slice(0, 6);
    expect(top6).toContain('maintenance');
    expect(top6).toContain('manager-dispatch');
  });

  it('tenant sees rent / leases / maintenance bubble up', () => {
    // `leases` is a tenant-weighted tab but is not part of any default
    // scale tier (see scale-defaults.ts — no tier delta includes it), so
    // we exercise reordering against an explicit base ladder that does.
    // orderTabsForPersona is a pure reorder; it can only bubble up tabs
    // that already exist in the base set.
    const base = [
      'docs',
      'leases',
      'maintenance',
      'rent',
      'chat',
      'reminders',
    ] as const;
    const ordered = orderTabsForPersona('tenant', base);
    expect(ordered[0]).toBe('chat');
    // tenant weights: rent 95 > leases 92 > maintenance 90 — they bubble
    // above the unweighted `docs`/`reminders` tail.
    const top4 = ordered.slice(0, 4);
    expect(top4).toContain('rent');
    expect(top4).toContain('leases');
    expect(top4).toContain('maintenance');
  });

  it('returns a frozen array (immutability rule)', () => {
    const ordered = orderTabsForPersona(
      'owner',
      defaultTabsFor('t1_single_unit'),
    );
    expect(Object.isFrozen(ordered)).toBe(true);
  });

  it('preserves base order for tabs of equal persona weight', () => {
    // Two tabs we know are NOT in any persona weight map keep their
    // input order (ties broken by base index).
    const base = ['ancillary', 'succession', 'asset-register'] as const;
    const ordered = orderTabsForPersona('owner', base);
    expect(ordered).toEqual(['ancillary', 'succession', 'asset-register']);
  });

  it('different personas produce different orderings on the same base', () => {
    const base = defaultTabsFor('t4_industrial_property');
    const ownerSeq = orderTabsForPersona('owner', base).join(',');
    const managerSeq = orderTabsForPersona('manager', base).join(',');
    const tenantSeq = orderTabsForPersona('tenant', base).join(',');
    expect(ownerSeq).not.toBe(managerSeq);
    expect(ownerSeq).not.toBe(tenantSeq);
    expect(managerSeq).not.toBe(tenantSeq);
  });
});

describe('coerceSurfacePersona', () => {
  it('returns the persona when valid', () => {
    for (const persona of SURFACE_PERSONAS) {
      expect(coerceSurfacePersona(persona)).toBe(persona);
    }
  });

  it('falls back to owner for garbage input', () => {
    expect(coerceSurfacePersona(null)).toBe('owner');
    expect(coerceSurfacePersona(undefined)).toBe('owner');
    expect(coerceSurfacePersona('admin')).toBe('owner');
    expect(coerceSurfacePersona('')).toBe('owner');
  });
});
